// Kanäle im Datenordner. Jeder Kanal ist ein Ordner unter <dataDir>/channels/<slug>/.
const fs = require('fs');
const path = require('path');

// Erkennt @handle, youtube.com/@handle, /channel/UC…, /c/name, /user/name.
function parseChannelInput(input) {
  const s = String(input || '').trim();
  if (!s) return null;

  if (/^@[\w.\-·]{3,30}$/.test(s)) return { kind: 'handle', value: s, url: `https://www.youtube.com/${s}` };
  if (/^UC[\w-]{22}$/.test(s)) return { kind: 'id', value: s, url: `https://www.youtube.com/channel/${s}` };

  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  if (host !== 'youtube.com') return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (!parts.length) return null;

  const [first, second] = parts;
  if (first.startsWith('@')) return { kind: 'handle', value: decodeURIComponent(first), url: `https://www.youtube.com/${first}` };
  if (first === 'channel' && second && /^UC[\w-]{22}$/.test(second)) return { kind: 'id', value: second, url: `https://www.youtube.com/channel/${second}` };
  if ((first === 'c' || first === 'user') && second) return { kind: first === 'c' ? 'custom' : 'user', value: second, url: `https://www.youtube.com/${first}/${second}` };
  return null;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'kanal';
}

function channelMdTemplate(c) {
  const own = c.type === 'own';
  return `# ${c.name}

> ${own ? 'Eigener Kanal' : 'Beobachteter Kanal'} · ${c.url}

## Nische
${c.niche || '_noch offen_'}

## Zielgruppe
_noch offen_

## Ton & Stil
_noch offen_

## Formate
_z. B. Long-Form 10–15 min, Shorts_

${own ? "## Do's & Don'ts\n_noch offen_\n" : '## Was macht diesen Kanal erfolgreich?\n_noch offen_\n'}`;
}

function readVideos(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'videos.json'), 'utf8')).videos || [];
  } catch {
    return [];
  }
}

function createChannelStore(getDataDir) {
  const channelsDir = () => path.join(getDataDir(), 'channels');

  function ensureDataDir() {
    const root = getDataDir();
    for (const d of ['channels', 'auftraege', path.join('.claude', 'skills')]) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
    }
    const readme = path.join(root, 'README.md');
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(readme, '# YT Hub – Datenordner\n\nHier legt YT Hub deine Kanäle, Ideen, Skripte und Aufträge an Claude Code ab.\n', 'utf8');
    }
    return root;
  }

  function list() {
    const dir = channelsDir();
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(dir, entry.name, 'channel.json'), 'utf8'));
        const countFiles = (sub) => {
          try { return fs.readdirSync(path.join(dir, entry.name, sub)).filter((f) => f.endsWith('.md') && !/-v\d+\.md$/.test(f)).length; } catch { return 0; }
        };
        const vids = readVideos(path.join(dir, entry.name));
        const monthAgo = Date.now() - 30 * 86400000;
        out.push({
          ...meta,
          slug: entry.name,
          counts: {
            ideas: countFiles('ideas'),
            scripts: countFiles('scripts'),
            outliers30d: vids.filter((v) => v.outlier && new Date(v.publishedAt).getTime() >= monthAgo).length,
          },
          lastUpload: vids[0]?.publishedAt || null,
        });
      } catch {
        // Ordner ohne gültige channel.json ignorieren
      }
    }
    return out.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  }

  function add({ input, name, type, niche }, { youtubeId = null, title = null } = {}) {
    const parsed = parseChannelInput(input);
    if (!parsed) throw new Error('Bitte einen YouTube-Link (z. B. youtube.com/@kanal) oder ein @Handle eingeben.');
    if (type !== 'own' && type !== 'watch') throw new Error('Bitte „Eigener Kanal“ oder „Beobachten“ wählen.');

    const existing = list().find(
      (c) =>
        (c.source.kind === parsed.kind && c.source.value.toLowerCase() === parsed.value.toLowerCase()) ||
        (youtubeId && c.youtubeId === youtubeId)
    );
    if (existing) throw new Error(`Dieser Kanal ist schon im Hub: „${existing.name}“.`);

    const displayName = (name || '').trim() || title || parsed.value.replace(/^@/, '');
    ensureDataDir();
    let slug = slugify(displayName);
    let n = 2;
    while (fs.existsSync(path.join(channelsDir(), slug))) slug = `${slugify(displayName)}-${n++}`;

    const dir = path.join(channelsDir(), slug);
    const meta = {
      name: displayName,
      type,
      url: parsed.url,
      source: { kind: parsed.kind, value: parsed.value },
      youtubeId: youtubeId || (parsed.kind === 'id' ? parsed.value : null),
      customName: !!(name || '').trim(),
      niche: (niche || '').trim(),
      addedAt: new Date().toISOString(),
    };

    fs.mkdirSync(dir, { recursive: true });
    for (const sub of type === 'own' ? ['ideas', 'research', 'scripts'] : ['ideas', 'research']) {
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'channel.json'), JSON.stringify(meta, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'channel.md'), channelMdTemplate(meta), 'utf8');
    if (type === 'own') {
      fs.writeFileSync(path.join(dir, 'style-guide.md'), `# Style-Guide: ${displayName}\n\n_Wird später von Claude aus deinen Videos abgeleitet._\n`, 'utf8');
      fs.writeFileSync(path.join(dir, 'competitors.json'), '[]\n', 'utf8');
    }
    return { ...meta, slug, counts: { ideas: 0, scripts: 0 } };
  }

  function dirOf(slug) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Ungültiger Kanal.');
    const dir = path.join(channelsDir(), slug);
    if (!fs.existsSync(path.join(dir, 'channel.json'))) throw new Error('Kanal nicht gefunden.');
    return dir;
  }

  // Alle Videos der gewählten Kanäle, neueste zuerst, mit Kanal-Infos.
  function feed({ types = ['watch'] } = {}) {
    const items = [];
    for (const c of list()) {
      if (!types.includes(c.type)) continue;
      for (const v of readVideos(path.join(channelsDir(), c.slug))) {
        items.push({ ...v, channel: { slug: c.slug, name: c.name, thumbnail: c.thumbnail || null, type: c.type } });
      }
    }
    return items.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  function setMeta(slug, patch) {
    const file = path.join(dirOf(slug), 'channel.json');
    const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...meta, ...patch }, null, 2), 'utf8');
  }

  return { ensureDataDir, list, add, dirOf, feed, setMeta };
}

module.exports = { createChannelStore, parseChannelInput, slugify };
