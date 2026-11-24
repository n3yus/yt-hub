// Aufträge an Claude Code. Jeder Auftrag ist eine Datei auftraege/<id>.md (für Claude)
// plus auftraege/<id>.json (Status für die App). Claude meldet sich über
// auftraege/<id>.result.json zurück – das funktioniert im Hintergrund und im Terminal.
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const ALLOWED_TOOLS = 'WebSearch WebFetch Read Write Edit Glob Grep Skill TodoWrite';
const LANG = { de: 'Deutsch', en: 'Englisch' };

const TYPES = {
  research: { label: 'Ideen recherchieren', skill: 'ythub-ideen', needsOwn: true },
  'from-video': { label: 'Idee aus Video', skill: 'ythub-ideen', needsOwn: true },
  profile: { label: 'Kanal-Profil entwerfen', skill: 'ythub-profil' },
  script: { label: 'Skript schreiben', skill: 'ythub-skript', needsOwn: true },
  revise: { label: 'Skript überarbeiten', skill: 'ythub-skript', needsOwn: true },
  free: { label: 'Freier Auftrag', skill: null },
};

// ---- Dateien im Datenordner -------------------------------------------------

const versionOf = (text) => Number((/ythub-version:\s*(\d+)/.exec(text || '') || [])[1] || 0);

// Kopiert CLAUDE.md und die Skills in den Datenordner – nur wenn sie fehlen oder veraltet sind.
function installAssets(dataDir, assetsDir) {
  const copyIfNewer = (src, dest, versionFile) => {
    const destVersion = fs.existsSync(versionFile) ? versionOf(fs.readFileSync(versionFile, 'utf8')) : -1;
    const srcVersion = versionOf(fs.readFileSync(path.join(src, path.basename(versionFile)), 'utf8'));
    if (destVersion >= srcVersion) return;
    copyDir(src, dest);
  };
  // Eigene Kopierfunktion, weil fs.cpSync nicht aus dem asar-Archiv der installierten App lesen kann.
  const copyDir = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      if (e.isDirectory()) copyDir(path.join(from, e.name), path.join(to, e.name));
      else fs.writeFileSync(path.join(to, e.name), fs.readFileSync(path.join(from, e.name)));
    }
  };
  const claudeMd = path.join(dataDir, 'CLAUDE.md');
  const src = fs.readFileSync(path.join(assetsDir, 'CLAUDE.md'), 'utf8');
  if (!fs.existsSync(claudeMd) || versionOf(fs.readFileSync(claudeMd, 'utf8')) < versionOf(src)) fs.writeFileSync(claudeMd, src, 'utf8');

  const skillsSrc = path.join(assetsDir, 'skills');
  for (const name of fs.readdirSync(skillsSrc)) {
    const dest = path.join(dataDir, '.claude', 'skills', name);
    copyIfNewer(path.join(skillsSrc, name), dest, path.join(dest, 'SKILL.md'));
  }
}

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*?)\s*(#.*)?$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function listIdeas(channelDir) {
  const dir = path.join(channelDir, 'ideas');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const fm = frontmatter(text);
      const h1 = (/^#\s+(.+)$/m.exec(text) || [])[1];
      return { file: `ideas/${f}`, title: fm.titel || h1 || f, status: fm.status || 'neu', score: fm.gesamt ? Number(fm.gesamt) : null, format: fm.format || null };
    })
    .sort((a, b) => (a.file < b.file ? 1 : -1));
}

// ---- Auftrag-Text --------------------------------------------------------

function taskText(type, input, channel) {
  const dir = channel ? `channels/${channel.slug}/` : '';
  switch (type) {
    case 'research':
      return `Recherchiere neue Videoideen für den Kanal **${channel.name}** (\`${dir}\`).
Speichere ${input.count || 5} bis ${(input.count || 5) + 3} gute Ideen in \`${dir}ideas/\` und einen Recherche-Bericht in \`${dir}research/\`.`;
    case 'from-video': {
      const v = input.video || {};
      return `Leite aus diesem erfolgreichen Video eines beobachteten Kanals 1–3 Videoideen für den eigenen Kanal **${channel.name}** (\`${dir}\`) ab:

- Titel: ${v.title}
- Kanal: ${v.channelName} (\`channels/${v.channelSlug}/\`)
- Link: ${v.url}
- Aufrufe: ${v.views ?? 'unbekannt'}${v.score ? ` (${v.score}× der Median des Kanals)` : ''}
- Veröffentlicht: ${v.publishedAt || 'unbekannt'}

Finde heraus, warum es funktioniert (Thema, Titel, Hook, Versprechen), und übertrage das – nicht kopieren, eigener Blickwinkel.
Speichere die Ideen in \`${dir}ideas/\`.`;
    }
    case 'profile':
      return `Entwirf das Kanal-Profil für **${channel.name}** (\`${dir}\`, ${channel.type === 'own' ? 'eigener Kanal' : 'beobachteter Kanal'}): \`${dir}channel.md\`${channel.type === 'own' ? ` und \`${dir}style-guide.md\`` : ''}.`;
    case 'script':
      return `Schreibe ein Skript für den Kanal **${channel.name}** (\`${dir}\`) auf Basis der Idee \`${dir}${input.idea}\`.
${input.minutes ? `Ziel-Länge: ca. ${input.minutes} Minuten.` : 'Ziel-Länge: wie in der Idee bzw. typisch für den Kanal.'}
Speichere es in \`${dir}scripts/\`.`;
    case 'revise': {
      const list = (input.comments || [])
        .map((c, i) => `${i + 1}. Zur Stelle „${String(c.quote).replace(/\s+/g, ' ').slice(0, 200)}“:\n   ${c.text}`)
        .join('\n');
      return `Überarbeite das Skript \`${dir}${input.script}\` für den Kanal **${channel.name}** (Regeln für Überarbeitungen im Skill beachten).
Setze die Kommentare des Creators gezielt um; alles andere bleibt, wie es ist.${list ? `\n\nKommentare:\n${list}` : ''}`;
    }
    case 'free':
      return `${input.text || ''}${channel ? `\n\nBezug: Kanal **${channel.name}** (\`${dir}\`).` : ''}`;
    default:
      throw new Error('Unbekannter Auftragstyp.');
  }
}

function jobMarkdown(job, input, language) {
  const t = TYPES[job.type];
  const lines = [
    `# Auftrag ${job.id}`,
    '',
    `- Typ: ${t.label}`,
    job.channel ? `- Kanal: ${job.channel.name} (\`channels/${job.channel.slug}/\`, ${job.channel.type === 'own' ? 'eigener Kanal' : 'beobachtet'})` : null,
    t.skill ? `- Skill: \`${t.skill}\` (unter \`.claude/skills/${t.skill}/\`)` : null,
    `- Sprache: ${LANG[language] || language}`,
    `- Erstellt: ${job.createdAt}`,
    '',
    '## Aufgabe',
    '',
    taskText(job.type, input, job.channel),
    '',
  ].filter((l) => l !== null);
  if (input.note && input.note.trim()) lines.push('## Notiz des Benutzers', '', input.note.trim(), '');
  lines.push(
    '## Zum Schluss',
    '',
    `Schreibe \`auftraege/${job.id}.result.json\` mit \`status\`, \`summary\` und \`outputs\` (Format siehe \`CLAUDE.md\`) – auch wenn etwas schiefgeht.`,
    ''
  );
  return lines.join('\n');
}

const prompt = (id) => `Lies die Datei auftraege/${id}.md und fuehre den Auftrag darin vollstaendig aus. Halte dich an CLAUDE.md.`;

// ---- Fortschritt aus Claude-Ausgabe ------------------------------------------

function describeTool(name, input = {}) {
  const short = (s, n = 90) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');
  const rel = (p) => short(String(p || '').replace(/\\/g, '/').replace(/^.*?(channels\/|auftraege\/|\.claude\/)/, '$1'));
  switch (name) {
    case 'WebSearch': return `🔎 Websuche: ${short(input.query)}`;
    case 'WebFetch': return `🌐 Lese Webseite: ${short(input.url)}`;
    case 'Read': return `📄 Lese ${rel(input.file_path)}`;
    case 'Write': return `✍️ Schreibe ${rel(input.file_path)}`;
    case 'Edit': return `✏️ Bearbeite ${rel(input.file_path)}`;
    case 'Glob': return `📁 Suche Dateien: ${short(input.pattern)}`;
    case 'Grep': return `🔍 Durchsuche Dateien: ${short(input.pattern)}`;
    case 'Skill': return `🧩 Nutze Skill ${input.skill || input.name || ''}`;
    case 'TodoWrite': return '🗒️ Plant die nächsten Schritte';
    case 'ToolSearch': return '🧰 Lädt Werkzeuge';
    default: return `🔧 ${name}`;
  }
}

// ---- Verwaltung ---------------------------------------------------------------

function createJobManager({ getDataDir, getLanguage, getChannel, findClaude, onChange }) {
  const dir = () => path.join(getDataDir(), 'auftraege');
  const stateFile = (id) => path.join(dir(), `${id}.json`);
  const resultFile = (id) => path.join(dir(), `${id}.result.json`);
  const running = new Map(); // id -> child process
  let claudeExe = null;

  const read = (id) => {
    try { return JSON.parse(fs.readFileSync(stateFile(id), 'utf8')); } catch { return null; }
  };
  const save = (job) => {
    fs.mkdirSync(dir(), { recursive: true });
    const tmp = stateFile(job.id) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(job, null, 2), 'utf8');
    fs.renameSync(tmp, stateFile(job.id));
    changed();
  };
  let changeTimer = null;
  const changed = () => {
    if (changeTimer) return;
    changeTimer = setTimeout(() => { changeTimer = null; onChange(); }, 300);
  };

  function list() {
    if (!fs.existsSync(dir())) return [];
    return fs
      .readdirSync(dir())
      .filter((f) => /^[\w-]+\.json$/.test(f) && !f.endsWith('.result.json'))
      .map((f) => read(f.replace(/\.json$/, '')))
      .filter(Boolean)
      .map(({ progress, ...j }) => ({ ...j, lastStep: progress?.[progress.length - 1]?.text || null, steps: progress?.length || 0 }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  function get(id) {
    return read(id);
  }

  function newId(type) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    let id = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${type}`;
    let n = 2;
    while (fs.existsSync(stateFile(id))) id = id.replace(/(-\d+)?$/, `-${n++}`);
    return id;
  }

  async function create(input) {
    const t = TYPES[input.type];
    if (!t) throw new Error('Unbekannter Auftragstyp.');
    const channel = input.channel ? getChannel(input.channel) : null;
    if (input.type !== 'free' && !channel) throw new Error('Bitte einen Kanal wählen.');
    if (t.needsOwn && channel.type !== 'own') throw new Error('Dieser Auftrag geht nur für eigene Kanäle.');
    if (input.type === 'script' && !input.idea) throw new Error('Bitte eine Idee wählen.');
    if (input.type === 'revise' && !input.script) throw new Error('Kein Skript angegeben.');
    if (input.type === 'revise' && !(input.comments || []).length && !String(input.note || '').trim())
      throw new Error('Bitte zuerst Kommentare setzen oder eine Notiz schreiben.');
    if (input.type === 'free' && !String(input.text || '').trim()) throw new Error('Bitte beschreiben, was Claude tun soll.');

    const job = {
      id: newId(input.type),
      type: input.type,
      title: input.title || t.label,
      ref: input.script || input.idea || null,
      channel: channel ? { slug: channel.slug, name: channel.name, type: channel.type } : null,
      mode: input.mode === 'terminal' ? 'terminal' : 'background',
      status: 'wartet',
      createdAt: new Date().toISOString(),
      note: input.note || '',
      progress: [],
      outputs: [],
    };
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(path.join(dir(), `${job.id}.md`), jobMarkdown(job, input, getLanguage()), 'utf8');
    save(job);
    if (job.mode === 'terminal') await launchTerminal(job);
    else pump();
    return job;
  }

  async function ensureClaude() {
    if (claudeExe && fs.existsSync(claudeExe)) return claudeExe;
    const found = await findClaude();
    if (!found.found) throw new Error('Claude Code wurde nicht gefunden. Bitte installieren und anmelden (siehe Einstellungen).');
    claudeExe = found.path;
    return claudeExe;
  }

  // Ein Hintergrund-Auftrag nach dem anderen.
  async function pump() {
    if ([...running.keys()].length) return;
    const next = list().filter((j) => j.status === 'wartet' && j.mode === 'background').pop(); // ältester zuerst
    if (!next) return;
    await runBackground(read(next.id));
  }

  async function runBackground(job) {
    let exe;
    try {
      exe = await ensureClaude();
    } catch (err) {
      return finish(job, { status: 'fehler', error: err.message });
    }
    job.status = 'läuft';
    job.startedAt = new Date().toISOString();
    job.progress.push({ t: job.startedAt, text: '▶ Claude Code gestartet' });
    save(job);

    const child = spawn(
      exe,
      ['-p', prompt(job.id), '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', ALLOWED_TOOLS, '--name', `YT Hub: ${job.title}`],
      { cwd: getDataDir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    running.set(job.id, child);
    const rawLog = fs.createWriteStream(path.join(dir(), `${job.id}.log`), { flags: 'a' });
    let buf = '';
    let stderr = '';
    let lastResult = null;
    let saveTimer = null;
    const saveSoon = () => {
      if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; save(job); }, 700);
    };

    child.stdout.on('data', (chunk) => {
      rawLog.write(chunk);
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type === 'assistant') {
          for (const c of msg.message?.content || []) {
            if (c.type === 'tool_use') job.progress.push({ t: new Date().toISOString(), text: describeTool(c.name, c.input) });
            else if (c.type === 'text' && c.text.trim()) job.progress.push({ t: new Date().toISOString(), text: `💬 ${c.text.trim().slice(0, 300)}` });
          }
          if (job.progress.length > 300) job.progress = job.progress.slice(-300);
          saveSoon();
        } else if (msg.type === 'result') {
          lastResult = msg;
        }
      }
    });
    child.stderr.on('data', (c) => { stderr = (stderr + c.toString('utf8')).slice(-4000); });

    child.on('error', (err) => {
      running.delete(job.id);
      finish(job, { status: 'fehler', error: `Claude Code konnte nicht gestartet werden: ${err.message}` });
      pump();
    });
    child.on('close', (code) => {
      clearTimeout(saveTimer);
      rawLog.end();
      running.delete(job.id);
      const current = read(job.id) || job;
      if (current.status === 'abgebrochen') return pump();
      job.progress = current.progress.length > job.progress.length ? current.progress : job.progress;
      if (lastResult) {
        job.costUsd = lastResult.total_cost_usd ?? null;
        job.durationMs = lastResult.duration_ms ?? null;
      }
      const res = readResult(job.id);
      if (res) finish(job, res);
      else if (code === 0 && lastResult && !lastResult.is_error)
        finish(job, { status: 'fertig', summary: String(lastResult.result || '').slice(0, 1000), outputs: [], warning: 'Claude hat keine Ergebnis-Datei geschrieben.' });
      else
        finish(job, { status: 'fehler', error: (lastResult && lastResult.is_error && String(lastResult.result || '')) || stderr.trim().split('\n').slice(-3).join(' ') || `Claude Code wurde mit Code ${code} beendet.` });
      pump();
    });
  }

  function readResult(id) {
    try {
      const r = JSON.parse(fs.readFileSync(resultFile(id), 'utf8'));
      return {
        status: r.status === 'fehler' ? 'fehler' : 'fertig',
        summary: String(r.summary || ''),
        outputs: Array.isArray(r.outputs) ? r.outputs.map(String) : [],
        error: r.status === 'fehler' ? String(r.summary || 'Claude meldet einen Fehler.') : null,
      };
    } catch {
      return null;
    }
  }

  function finish(job, res) {
    const current = read(job.id) || job;
    const done = {
      ...current,
      progress: job.progress || current.progress,
      costUsd: job.costUsd ?? current.costUsd ?? null,
      durationMs: job.durationMs ?? current.durationMs ?? null,
      status: res.status,
      summary: res.summary || null,
      outputs: (res.outputs || []).filter((o) => isInside(path.resolve(getDataDir(), o))),
      error: res.error || null,
      warning: res.warning || null,
      finishedAt: new Date().toISOString(),
    };
    done.progress.push({ t: done.finishedAt, text: res.status === 'fertig' ? '✅ Fertig' : `⚠ ${res.error || 'Fehler'}` });
    save(done);
  }

  async function launchTerminal(job) {
    let exe;
    try {
      exe = await ensureClaude();
    } catch (err) {
      return finish(job, { status: 'fehler', error: err.message });
    }
    const cwd = getDataDir();
    try {
      if (process.platform === 'win32') {
        const launcher = path.join(dir(), `${job.id}.cmd`);
        fs.writeFileSync(launcher, `@echo off\r\nchcp 65001 >nul\r\ntitle YT Hub - ${job.title.replace(/[&|<>^%"]/g, '')}\r\ncd /d "${cwd}"\r\n"${exe}" "${prompt(job.id)}"\r\n`, 'utf8');
        spawn('cmd.exe', ['/c', 'start', '"YT Hub"', 'cmd.exe', '/k', `"${launcher}"`], { windowsVerbatimArguments: true, detached: true, stdio: 'ignore', cwd }).unref();
      } else if (process.platform === 'darwin') {
        const cmd = `cd ${JSON.stringify(cwd)} && ${JSON.stringify(exe)} ${JSON.stringify(prompt(job.id))}`;
        spawn('osascript', ['-e', `tell application "Terminal" to do script ${JSON.stringify(cmd)}`, '-e', 'tell application "Terminal" to activate'], { detached: true, stdio: 'ignore' }).unref();
      } else {
        const cmd = `cd ${JSON.stringify(cwd)} && ${JSON.stringify(exe)} ${JSON.stringify(prompt(job.id))}; exec bash`;
        spawn('x-terminal-emulator', ['-e', 'bash', '-lc', cmd], { detached: true, stdio: 'ignore' }).unref();
      }
    } catch (err) {
      return finish(job, { status: 'fehler', error: `Terminal konnte nicht geöffnet werden: ${err.message}` });
    }
    job.status = 'im Terminal';
    job.startedAt = new Date().toISOString();
    job.progress.push({ t: job.startedAt, text: '🖥 In Claude Code (Terminal) geöffnet – warte auf das Ergebnis' });
    save(job);
  }

  function cancel(id) {
    const job = read(id);
    if (!job) throw new Error('Auftrag nicht gefunden.');
    const child = running.get(id);
    if (child) {
      if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
      else child.kill('SIGTERM');
    }
    if (['wartet', 'läuft', 'im Terminal'].includes(job.status)) {
      job.status = 'abgebrochen';
      job.finishedAt = new Date().toISOString();
      job.progress.push({ t: job.finishedAt, text: '■ Abgebrochen' });
      save(job);
    }
    return list();
  }

  async function retry(id) {
    const job = read(id);
    if (!job) throw new Error('Auftrag nicht gefunden.');
    if (running.has(id)) throw new Error('Der Auftrag läuft noch.');
    try { fs.rmSync(resultFile(id)); } catch {}
    Object.assign(job, { status: 'wartet', startedAt: null, finishedAt: null, summary: null, error: null, warning: null, outputs: [], costUsd: null });
    job.progress.push({ t: new Date().toISOString(), text: '↻ Erneut gestartet' });
    save(job);
    if (job.mode === 'terminal') await launchTerminal(job);
    else pump();
    return list();
  }

  function remove(id) {
    if (running.has(id)) throw new Error('Der Auftrag läuft noch.');
    for (const ext of ['.json', '.md', '.log', '.result.json', '.cmd']) {
      try { fs.rmSync(path.join(dir(), id + ext)); } catch {}
    }
    changed();
    return list();
  }

  // Nach Neustart: Hintergrund-Aufträge ohne Prozess abschließen; Terminal-Aufträge und Ergebnisse überwachen.
  function recover() {
    for (const j of list()) {
      if (j.status === 'läuft') {
        const job = read(j.id);
        const res = readResult(j.id);
        finish(job, res || { status: 'abgebrochen', error: 'YT Hub wurde geschlossen, während der Auftrag lief.' });
      }
    }
    pump();
  }

  function poll() {
    for (const j of list()) {
      if (j.status === 'im Terminal' && fs.existsSync(resultFile(j.id))) finish(read(j.id), readResult(j.id));
    }
  }

  function isInside(p) {
    const root = path.resolve(getDataDir()) + path.sep;
    return path.resolve(p).startsWith(root);
  }

  function resolveDataPath(rel) {
    const p = path.resolve(getDataDir(), rel);
    if (!isInside(p)) throw new Error('Pfad liegt außerhalb des Datenordners.');
    return p;
  }

  function stopAll() {
    for (const id of running.keys()) cancel(id);
  }

  return { list, get, create, cancel, retry, remove, recover, poll, resolveDataPath, stopAll, runningCount: () => running.size };
}

module.exports = { createJobManager, installAssets, listIdeas, TYPES, frontmatter, describeTool };
