// Ideen, Skripte, Recherche-Berichte und Kommentare in einem Kanal-Ordner.
// Alles sind Markdown-Dateien mit einfachem Frontmatter, die auch Claude schreibt.
const fs = require('fs');
const path = require('path');

const IDEA_STATUS = ['neu', 'favorit', 'in-arbeit', 'produziert', 'veroeffentlicht', 'verworfen'];
const SCRIPT_STATUS = ['entwurf', 'ueberarbeitung', 'fertig'];
const EDITABLE = /^(ideas|scripts|research)\/[^/\\]+\.md$|^(channel|style-guide)\.md$/;

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const fm = {};
  if (!m) return { fm, body: text };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*?)\s*(#.*)?$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { fm, body: text.slice(m[0].length) };
}

// Setzt ein Feld im Frontmatter (legt Frontmatter bzw. Feld an, falls nötig), Rest bleibt unverändert.
function setFrontmatterField(text, key, value) {
  const line = `${key}: ${value}`;
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return `---\n${line}\n---\n\n${text}`;
  const re = new RegExp(`^${key}:.*$`, 'm');
  const inner = re.test(m[1]) ? m[1].replace(re, () => line) : `${m[1]}\n${line}`;
  return text.replace(m[1], () => inner);
}

const slug = (s) =>
  String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'idee';

const today = () => new Date().toISOString().slice(0, 10);
const firstHeading = (body) => (/^#\s+(.+)$/m.exec(body) || [])[1];

function createContentStore(channelDir) {
  const resolve = (slugName, rel) => {
    if (!EDITABLE.test(rel)) throw new Error('Diese Datei kann hier nicht bearbeitet werden.');
    return path.join(channelDir(slugName), rel);
  };
  const listMd = (slugName, sub) => {
    const dir = path.join(channelDir(slugName), sub);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  };

  function listIdeas(slugName) {
    return listMd(slugName, 'ideas')
      .map((f) => {
        const full = path.join(channelDir(slugName), 'ideas', f);
        const text = fs.readFileSync(full, 'utf8');
        const { fm, body } = parseFrontmatter(text);
        const hook = (/##\s*Hook[^\n]*\n+([^\n#][^\n]*)/.exec(body) || [])[1] || '';
        return {
          file: `ideas/${f}`,
          title: fm.titel || firstHeading(body) || f.replace(/\.md$/, ''),
          status: IDEA_STATUS.includes(fm.status) ? fm.status : 'neu',
          score: fm.gesamt ? Number(String(fm.gesamt).replace(',', '.')) : null,
          format: fm.format === 'short' ? 'short' : fm.format === 'lang' ? 'lang' : null,
          created: fm.erstellt || fs.statSync(full).mtime.toISOString().slice(0, 10),
          hook: hook.replace(/^[„"]|[“"]$/g, '').slice(0, 220),
          script: fm.skript || (/^skript:\s*(.+)$/m.exec(text) || [])[1] || null,
        };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (a.created < b.created ? 1 : -1));
  }

  function listScripts(slugName) {
    const files = listMd(slugName, 'scripts');
    return files
      .filter((f) => !/-v\d+\.md$/.test(f))
      .map((f) => {
        const full = path.join(channelDir(slugName), 'scripts', f);
        const { fm, body } = parseFrontmatter(fs.readFileSync(full, 'utf8'));
        const base = f.replace(/\.md$/, '');
        return {
          file: `scripts/${f}`,
          title: fm.titel || firstHeading(body) || base,
          status: SCRIPT_STATUS.includes(fm.status) ? fm.status : 'entwurf',
          version: Number(fm.version) || 1,
          minutes: fm.minuten ? Number(fm.minuten) : null,
          words: fm.woerter ? Number(fm.woerter) : null,
          format: fm.format || null,
          idea: fm.idee || null,
          updated: fs.statSync(full).mtime.toISOString(),
          versions: files.filter((v) => v.startsWith(base + '-v') && /-v\d+\.md$/.test(v)).map((v) => `scripts/${v}`).sort(),
          openComments: readComments(slugName, `scripts/${f}`).filter((c) => !c.sentInJob).length,
        };
      })
      .sort((a, b) => (a.updated < b.updated ? 1 : -1));
  }

  function listResearch(slugName) {
    return listMd(slugName, 'research')
      .map((f) => {
        const text = fs.readFileSync(path.join(channelDir(slugName), 'research', f), 'utf8');
        const { body } = parseFrontmatter(text);
        return { file: `research/${f}`, title: firstHeading(body) || f.replace(/\.md$/, '') };
      })
      .sort((a, b) => (a.file < b.file ? 1 : -1));
  }

  function read(slugName, rel) {
    const full = resolve(slugName, rel);
    if (!fs.existsSync(full)) return { exists: false, text: '', fm: {}, body: '' };
    const text = fs.readFileSync(full, 'utf8');
    return { exists: true, text, ...parseFrontmatter(text), updated: fs.statSync(full).mtime.toISOString() };
  }

  function write(slugName, rel, text) {
    const full = resolve(slugName, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text, 'utf8');
    return read(slugName, rel);
  }

  function setStatus(slugName, rel, status) {
    const allowed = rel.startsWith('ideas/') ? IDEA_STATUS : SCRIPT_STATUS;
    if (!allowed.includes(status)) throw new Error('Unbekannter Status.');
    const doc = read(slugName, rel);
    if (!doc.exists) throw new Error('Datei nicht gefunden.');
    return write(slugName, rel, setFrontmatterField(doc.text, 'status', status));
  }

  function createIdea(slugName, { title, notes, format }) {
    title = String(title || '').trim();
    if (!title) throw new Error('Bitte einen Titel eingeben.');
    let name = `${today()}-${slug(title)}`;
    let n = 2;
    while (fs.existsSync(path.join(channelDir(slugName), 'ideas', `${name}.md`))) name = `${today()}-${slug(title)}-${n++}`;
    const text = `---
titel: "${title.replace(/"/g, "'")}"
status: neu
format: ${format === 'short' ? 'short' : 'lang'}
erstellt: ${today()}
quelle: eigene Idee
---

# ${title}

## Notizen
${String(notes || '').trim() || '_noch keine_'}
`;
    return { file: `ideas/${name}.md`, doc: write(slugName, `ideas/${name}.md`, text) };
  }

  // ---- Kommentare zu Skripten (liegen neben dem Skript als .comments.json) ----
  const commentsFile = (slugName, rel) => {
    if (!/^scripts\/[^/\\]+\.md$/.test(rel)) throw new Error('Kommentare gibt es nur für Skripte.');
    return path.join(channelDir(slugName), rel.replace(/\.md$/, '.comments.json'));
  };
  function readComments(slugName, rel) {
    try { return JSON.parse(fs.readFileSync(commentsFile(slugName, rel), 'utf8')); } catch { return []; }
  }
  function writeComments(slugName, rel, list) {
    const clean = (Array.isArray(list) ? list : []).map((c) => ({
      id: String(c.id), quote: String(c.quote || '').slice(0, 400), text: String(c.text || '').slice(0, 2000),
      createdAt: c.createdAt || new Date().toISOString(), sentInJob: c.sentInJob || null,
    }));
    fs.writeFileSync(commentsFile(slugName, rel), JSON.stringify(clean, null, 2), 'utf8');
    return clean;
  }

  return { listIdeas, listScripts, listResearch, read, write, setStatus, createIdea, readComments, writeComments, resolve };
}

module.exports = { createContentStore, parseFrontmatter, setFrontmatterField, IDEA_STATUS, SCRIPT_STATUS };
