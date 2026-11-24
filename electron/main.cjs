const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { createSettingsStore } = require('./settings.cjs');
const { createChannelStore, parseChannelInput } = require('./channels.cjs');
const { testYoutubeKey, findClaude } = require('./checks.cjs');
const { createYoutubeClient, createQuotaCounter } = require('./youtube.cjs');
const { syncChannel } = require('./sync.cjs');
const { createJobManager, installAssets, listIdeas } = require('./jobs.cjs');
const { createContentStore } = require('./content.cjs');
const { createUpdater } = require('./updater.cjs');

const isDev = process.env.YTHUB_DEV === '1';
const smoke = process.env.YTHUB_SMOKE === '1';

// Der Smoke-Test läuft mit eigenem, leerem Profil, damit er nichts vom Benutzer anfasst.
if (smoke) {
  const tmp = path.join(app.getPath('temp'), 'ythub-smoke');
  fs.rmSync(tmp, { recursive: true, force: true });
  app.setPath('userData', path.join(tmp, 'userData'));
  app.setPath('documents', path.join(tmp, 'Documents'));
}

let settings;
let channels;
let quota;
let youtube;
let jobs;
let content;
let updater;

function prepareDataDir() {
  const dir = channels.ensureDataDir();
  installAssets(dir, path.join(__dirname, 'assets'));
  return dir;
}

function broadcastJobs() {
  if (win && !win.isDestroyed()) win.webContents.send('jobs:update', jobs.list());
}
let win;

// ---- Abgleich mit YouTube -------------------------------------------------
const DAY = 86400000;
let syncState = { running: false, done: 0, total: 0, current: null, lastRun: null, error: null };

function broadcastSync(patch) {
  syncState = { ...syncState, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('sync:status', { ...syncState, quota: quota.get() });
}

// Gleicht die Kanäle nacheinander ab. Bricht ab, wenn Key fehlt/ungültig ist oder das Kontingent aufgebraucht ist.
async function syncChannels({ slugs = null, onlyStale = false } = {}) {
  if (syncState.running) return syncState;
  if (!settings.getYoutubeKey()) return syncState;
  let list = channels.list();
  if (slugs) list = list.filter((c) => slugs.includes(c.slug));
  if (onlyStale) list = list.filter((c) => !c.lastSync || Date.now() - new Date(c.lastSync).getTime() > DAY);
  if (!list.length) return syncState;

  broadcastSync({ running: true, done: 0, total: list.length, current: null, error: null });
  const failures = [];
  for (const c of list) {
    broadcastSync({ current: c.name });
    try {
      await syncChannel({ dir: channels.dirOf(c.slug), youtube });
    } catch (err) {
      if (['noKey', 'keyInvalid', 'quota', 'network'].includes(err.reason)) {
        broadcastSync({ running: false, current: null, error: err.message, lastRun: new Date().toISOString() });
        return syncState;
      }
      failures.push(`${c.name}: ${err.message}`);
    }
    broadcastSync({ done: syncState.done + 1 });
  }
  broadcastSync({
    running: false,
    current: null,
    lastRun: new Date().toISOString(),
    error: failures.length ? failures.join(' · ') : null,
  });
  return syncState;
}

function autoSync() {
  const mode = settings.load().checkInterval;
  if (mode === 'on-open') return syncChannels();
  if (mode === 'daily') return syncChannels({ onlyStale: true });
}

function registerIpc() {
  const handle = (name, fn) =>
    ipcMain.handle(name, async (_e, ...args) => {
      try {
        return { ok: true, data: await fn(...args) };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    });

  handle('settings:get', () => settings.publicView());
  handle('settings:update', (patch) => {
    const view = settings.update(patch || {});
    prepareDataDir();
    return view;
  });
  handle('settings:setYoutubeKey', (key) => {
    settings.setYoutubeKey(String(key || '').trim());
    // Neuer Key: Kanäle ohne YouTube-Daten gleich nachholen.
    if (key) syncChannels({ slugs: channels.list().filter((c) => !c.lastSync).map((c) => c.slug) });
    return settings.publicView();
  });
  handle('settings:quota', () => quota.get());
  handle('settings:testYoutubeKey', (key) => testYoutubeKey(String(key || '').trim() || settings.getYoutubeKey()));
  handle('settings:chooseDataDir', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Datenordner wählen',
      defaultPath: settings.load().dataDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return settings.publicView();
    settings.update({ dataDir: res.filePaths[0] });
    prepareDataDir();
    return settings.publicView();
  });
  handle('claude:find', () => findClaude());

  handle('channels:list', () => channels.list());
  handle('channels:add', async (input) => {
    input = input || {};
    // Mit Key: Kanal zuerst bei YouTube suchen – so fallen Tippfehler und Dubletten sofort auf.
    let resolved = {};
    if (settings.getYoutubeKey()) {
      const parsed = parseChannelInput(input.input);
      if (parsed) {
        try {
          const ch = await youtube.resolveChannel(parsed);
          resolved = { youtubeId: ch.id, title: ch.snippet.title };
        } catch (err) {
          if (err.reason === 'notFound') throw err;
          // Netzwerk/Kontingent: trotzdem anlegen, Daten kommen beim nächsten Abgleich.
        }
      }
    }
    const channel = channels.add(input, resolved);
    if (resolved.youtubeId) {
      try {
        await syncChannel({ dir: channels.dirOf(channel.slug), youtube });
      } catch {}
      broadcastSync({});
    }
    return channels.list().find((c) => c.slug === channel.slug) || channel;
  });
  handle('channels:sync', (slugs) => syncChannels({ slugs: slugs || null }));
  handle('sync:status', () => ({ ...syncState, quota: quota.get() }));
  handle('feed:list', (opts) => channels.feed(opts || {}));
  handle('channels:openFolder', async (slug) => {
    const err = await shell.openPath(slug ? channels.dirOf(slug) : channels.ensureDataDir());
    if (err) throw new Error(err);
    return true;
  });
  handle('channels:remove', async (slug) => {
    await shell.trashItem(channels.dirOf(slug)); // in den Papierkorb, nicht endgültig
    return channels.list();
  });

  handle('app:openExternal', async (url) => {
    const u = new URL(url);
    if (u.protocol !== 'https:') throw new Error('Nur https-Links werden geöffnet.');
    await shell.openExternal(u.toString());
    return true;
  });
  handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
  handle('update:status', () => updater.getStatus());
  handle('update:check', () => updater.check());
  handle('update:install', () => { if (jobs) jobs.stopAll(); updater.install(); return true; });

  // ---- Aufträge an Claude Code ----
  handle('jobs:list', () => jobs.list());
  handle('jobs:get', (id) => jobs.get(id));
  handle('jobs:create', async (input) => {
    input = input || {};
    const job = await jobs.create(input);
    // Überarbeitung: Kommentare als „geschickt“ markieren und Skript-Status setzen.
    if (input.type === 'revise') {
      const sent = new Set((input.comments || []).map((c) => c.id));
      const list = content.readComments(input.channel, input.script).map((c) => (sent.has(c.id) ? { ...c, sentInJob: job.id } : c));
      content.writeComments(input.channel, input.script, list);
      try { content.setStatus(input.channel, input.script, 'ueberarbeitung'); } catch {}
    }
    return job;
  });
  handle('jobs:cancel', (id) => jobs.cancel(id));
  handle('jobs:retry', (id) => jobs.retry(id));
  handle('jobs:remove', (id) => jobs.remove(id));
  handle('jobs:openPath', async (rel) => {
    const err = await shell.openPath(jobs.resolveDataPath(rel));
    if (err) throw new Error(err);
    return true;
  });
  handle('ideas:list', (slug) => listIdeas(channels.dirOf(slug)));

  // ---- Inhalte: Ideen-Board, Skripte, Kommentare ----
  handle('content:ideas', (slug) => content.listIdeas(slug));
  handle('content:scripts', (slug) => content.listScripts(slug));
  handle('content:research', (slug) => content.listResearch(slug));
  handle('content:read', (slug, rel) => content.read(slug, rel));
  handle('content:write', (slug, rel, text) => content.write(slug, rel, String(text)));
  handle('content:setStatus', (slug, rel, status) => content.setStatus(slug, rel, status));
  handle('content:createIdea', (slug, input) => content.createIdea(slug, input || {}));
  handle('content:trash', async (slug, rel) => {
    const full = content.resolve(slug, rel);
    await shell.trashItem(full);
    const side = full.replace(/\.md$/, '.comments.json');
    if (fs.existsSync(side)) await shell.trashItem(side);
    return true;
  });
  handle('content:open', async (slug, rel) => {
    const err = await shell.openPath(content.resolve(slug, rel));
    if (err) throw new Error(err);
    return true;
  });
  handle('comments:get', (slug, rel) => content.readComments(slug, rel));
  handle('comments:set', (slug, rel, list) => content.writeComments(slug, rel, list));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'YT Hub',
    backgroundColor: '#0f1115',
    show: !smoke,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Fremde Links nie im App-Fenster öffnen.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) e.preventDefault();
  });

  // Laufende Hintergrund-Aufträge nicht stillschweigend abbrechen.
  win.on('close', (e) => {
    if (smoke || !jobs || jobs.runningCount() === 0) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Auftrag abbrechen und beenden', 'Weiterarbeiten lassen'],
      defaultId: 1,
      cancelId: 1,
      title: 'YT Hub',
      message: 'Claude arbeitet gerade an einem Auftrag.',
      detail: 'Wenn du YT Hub jetzt schließt, wird der Auftrag abgebrochen.',
    });
    if (choice === 1) e.preventDefault();
    else jobs.stopAll();
  });

  if (isDev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  if (smoke) runSmoke();
}

// Startet die App unsichtbar, klickt die wichtigsten Wege durch und speichert Screenshots.
// Nutzt ein Test-YouTube mit festen Daten (kein Netz, kein Kontingent).
async function runSmoke() {
  const out = process.env.YTHUB_SMOKE_OUT || path.join(app.getPath('temp'), 'ythub-smoke', 'shots');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => {
    await wait(700);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(out, `${name}.png`), img.toPNG());
  };
  const js = (code) => win.webContents.executeJavaScript(code);
  const loaded = () => new Promise((r) => win.webContents.once('did-finish-load', r));
  const report = {};
  try {
    await loaded();
    await shot('01-erster-start');
    await js(`window.ythub.updateSettings({ setupDone: true }).then(() => location.reload())`);
    await loaded();
    await shot('02-dashboard-leer');
    await js(`document.querySelector('[data-test=add-channel]').click()`);
    await shot('03-plus-dialog');

    // Echter Google-Test mit falschem Key, dann Test-Key speichern (verschlüsselt).
    report.badKey = await js(`window.ythub.testYoutubeKey('AIzaFALSCHERKEY0000')`);
    await js(`window.ythub.setYoutubeKey('AIzaSmokeTestKey1234')`);
    report.keyDecryptsBack = settings.getYoutubeKey() === 'AIzaSmokeTestKey1234';
    report.keyPlaintextInFile = fs.readFileSync(settings.file, 'utf8').includes('AIzaSmokeTestKey1234');

    report.add = await js(`(async () => {
      const r = [];
      for (const input of [
        { input: 'https://www.youtube.com/@MeinKanal', type: 'own', niche: 'Tech-Erklärvideos' },
        { input: '@Vorbild', type: 'watch' },
        { input: 'youtube.com/@ShortsProfi', type: 'watch' },
        { input: 'https://www.youtube.com/channel/UCvorbild00000000000000a', type: 'watch' },
        { input: '@gibtesnicht', type: 'watch' },
        { input: 'https://example.com/x', type: 'own' },
      ]) {
        try { const c = await window.ythub.addChannel(input); r.push('OK: ' + c.slug + ' / ' + c.name + ' / ' + (c.stats ? c.stats.subscribers : 'keine Daten')); }
        catch (e) { r.push('FEHLER: ' + e.message); }
      }
      return r;
    })()`);
    report.sync = await js(`window.ythub.syncChannels()`);
    await js(`location.reload()`);
    await loaded();
    await shot('04-dashboard-kanaele');
    await js(`location.hash = '#/feed'`);
    await shot('05-feed');
    await js(`location.hash = '#/feed?channel=grosses-vorbild&outliers=1'`);
    await shot('06-feed-ausreisser');
    await js(`location.hash = '#/settings'`);
    await shot('07-einstellungen');

    // Auftrag-Dialoge
    const openDialog = (detail) => js(`window.dispatchEvent(new CustomEvent('ythub:new-job', { detail: ${JSON.stringify(detail)} }))`);
    const closeDialog = () => js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
    await openDialog({ type: 'research', channel: 'mein-tech-kanal' });
    await shot('08-auftrag-dialog');
    await closeDialog();
    const v = channels.feed({ types: ['watch'] }).find((x) => x.outlier === 'strong');
    await openDialog({ type: 'from-video', video: { id: v.id, title: v.title, url: `https://www.youtube.com/watch?v=${v.id}`, views: v.views, score: v.score, channelName: v.channel.name, channelSlug: v.channel.slug } });
    await shot('09-dialog-idee-aus-video');
    await closeDialog();
    report.assets = fs.existsSync(path.join(settings.load().dataDir, '.claude', 'skills', 'ythub-ideen', 'SKILL.md')) && fs.existsSync(path.join(settings.load().dataDir, 'CLAUDE.md'));

    // Ideen-Board und Skript-Ansicht mit Beispieldateien.
    const ch = 'mein-tech-kanal';
    const fixture = (title, status, score, format, hook) => `---\ntitel: "${title}"\nstatus: ${status}\nformat: ${format}\ngesamt: ${score}\nerstellt: 2026-11-2${Math.round(score)}\n---\n\n# ${title}\n\n## Hook (erste 15 Sekunden)\n${hook}\n\n## Titelvorschläge\n1. ${title}\n2. Variante B\n\n## Warum jetzt?\n- Ausreißer bei [Großes Vorbild](https://www.youtube.com/@vorbild)\n`;
    await js(`(async () => {
      const w = (f, t) => window.ythub.writeDoc('${ch}', f, t);
      await w('ideas/2026-11-20-akku-trick.md', ${JSON.stringify(fixture('Der Akku-Trick, den dein Handy versteckt', 'neu', 4.3, 'short', 'Dein Handy hat eine Einstellung, die den Akku 20 % länger leben lässt – und sie ist standardmäßig aus.'))});
      await w('ideas/2026-11-21-ki-setup.md', ${JSON.stringify(fixture('Ich teste das billigste KI-Setup', 'favorit', 3.8, 'lang', 'Für eigene KI brauchst du angeblich 2.000 Euro. Ich versuche es mit 300.'))});
      await w('ideas/2026-11-22-windows.md', ${JSON.stringify(fixture('7 versteckte Windows-Funktionen', 'in-arbeit', 3.4, 'lang', 'Diese sieben Funktionen sind seit Jahren in Windows – und fast niemand nutzt sie.') + 'skript: scripts/2026-11-23-windows.md\n')});
      await w('ideas/2026-11-19-router.md', ${JSON.stringify(fixture('Router-Einstellungen für schnelleres WLAN', 'verworfen', 2.9, 'lang', 'Dein WLAN ist langsam? Liegt fast nie am Anbieter.'))});
      await window.ythub.createIdea('${ch}', { title: 'Meine eigene Idee: Desk-Setup-Tour', format: 'lang', notes: 'Zuschauer fragen oft danach.' });
      await w('scripts/2026-11-23-windows.md', ${JSON.stringify(`---\ntitel: "7 versteckte Windows-Funktionen"\nidee: "ideas/2026-11-22-windows.md"\nstatus: entwurf\nversion: 2\nformat: lang\nwoerter: 160\nminuten: 1\n---\n\n# 7 versteckte Windows-Funktionen\n\n## Titel-Optionen\n1. 7 Windows-Funktionen, die du nie benutzt hast\n2. Windows kann DAS?\n\n## Skript\n\n### Hook\nDiese sieben Funktionen sind seit Jahren in Windows – und fast niemand nutzt sie. Nummer fünf spart dir jeden Tag Zeit. [B-Roll: schneller Zusammenschnitt aller sieben]\n\n### Kapitel 1: Zwischenablage-Verlauf\nDrück Windows plus V. Statt nur dem letzten kopierten Text siehst du jetzt alles, was du heute kopiert hast. [Grafik: Tastenkombination]\n\n### Kapitel 2: Fenster einrasten\nZieh ein Fenster an den oberen Rand – und Windows schlägt dir fertige Layouts vor. Perfekt für zwei Monitore.\n\n### Schluss\nWelche Funktion kanntest du noch nicht? Schreib es in die Kommentare – und abonnier, wenn du mehr solche Tricks willst.\n\n## Beschreibung\nSieben Windows-Funktionen, die dir jeden Tag Zeit sparen.\n\n## Tags\nwindows, tipps, produktivität\n`)});
      await w('scripts/2026-11-23-windows-v1.md', '---\\ntitel: "Alt"\\nversion: 1\\n---\\n\\n# Alte Fassung\\n\\n## Skript\\nKurz und alt.\\n');
      await window.ythub.setComments('${ch}', 'scripts/2026-11-23-windows.md', [{ id: 'c1', quote: 'Drück Windows plus V.', text: 'Hier ein konkretes Beispiel aus dem Alltag einbauen.' }]);
      await w('research/2026-11-24-recherche.md', '# Recherche 24.11.2026\\n\\n## Was gerade läuft\\n- Versteckte Funktionen\\n- Billig-Tests\\n\\n| Idee | Wert |\\n|---|---|\\n| Akku-Trick | 4,3 |\\n');
      await w('channel.md', '# Mein Tech-Kanal\\n\\n## Nische\\nTech-Erklärvideos für Einsteiger\\n\\n## Zielgruppe\\nEinsteiger, 18–35\\n');
    })()`);
    await js(`location.hash = '#/kanal/${ch}'`);
    await shot('13-kanal-ideen-board');
    await js(`document.querySelector('.idea').click()`);
    await shot('14-idee-details');
    await js(`location.hash = '#/kanal/${ch}?tab=skripte'`);
    await shot('15-skripte');
    await js(`location.hash = '#/kanal/${ch}/skript?file=' + encodeURIComponent('scripts/2026-11-23-windows.md')`);
    await shot('16-skript-ansicht');
    await js(`location.hash = '#/kanal/${ch}?tab=profil'`);
    await shot('17-profil');
    report.ideasApi = await js(`window.ythub.ideas('${ch}')`);
    report.scriptsApi = await js(`window.ythub.scripts('${ch}')`);
    report.moveStatus = (await js(`window.ythub.setDocStatus('${ch}', 'ideas/2026-11-20-akku-trick.md', 'favorit')`)).fm.status;
    report.badPath = await js(`window.ythub.readDoc('${ch}', '../../../settings.json').then(() => 'GELESEN (Fehler!)', (e) => 'abgelehnt: ' + e.message)`);

    // Echter Claude-Code-Auftrag: Skript schreiben + mit Kommentar überarbeiten (YTHUB_SMOKE_CLAUDE=script, kostet etwas).
    if (process.env.YTHUB_SMOKE_CLAUDE === 'script') {
      const waitJob = async (id) => {
        const started = Date.now();
        let j = jobs.get(id);
        while (['wartet', 'läuft'].includes(j.status) && Date.now() - started < 9 * 60000) {
          await wait(3000);
          j = jobs.get(id);
        }
        return { status: j.status, summary: j.summary, outputs: j.outputs, error: j.error, warning: j.warning, costUsd: j.costUsd, durationMs: j.durationMs, steps: j.progress.map((p) => p.text) };
      };
      const sj = await js(`window.ythub.createJob({ type: 'script', channel: '${ch}', idea: 'ideas/2026-11-20-akku-trick.md', minutes: 1, mode: 'background',
        note: 'Testlauf: ein Short mit ca. 120 Wörtern, keine Websuche nötig.' })`);
      report.scriptJob = await waitJob(sj.id);
      const scripts = await js(`window.ythub.scripts('${ch}')`);
      const made = scripts.find((s) => s.idea && s.idea.includes('akku')) || scripts.find((s) => !s.file.includes('windows'));
      report.madeScript = made && made.file;
      if (made) {
        await js(`window.ythub.setComments('${ch}', '${made.file}', [{ id: 'k1', quote: '', text: 'Den Hook als Frage formulieren.' }])`);
        const comments = await js(`window.ythub.getComments('${ch}', '${made.file}')`);
        const rj = await js(`window.ythub.createJob({ type: 'revise', channel: '${ch}', script: '${made.file}', comments: ${JSON.stringify(comments)}, mode: 'background', title: 'Überarbeiten (Test)' })`);
        await js(`location.hash = '#/kanal/${ch}/skript?file=' + encodeURIComponent('${made.file}')`);
        await wait(8000);
        await shot('18-skript-wird-ueberarbeitet');
        report.reviseJob = await waitJob(rj.id);
        await js(`location.reload()`);
        await loaded();
        await shot('19-skript-nach-ueberarbeitung');
        const doc = await js(`window.ythub.readDoc('${ch}', '${made.file}')`);
        report.revisedScript = doc.text;
        report.commentsAfter = await js(`window.ythub.getComments('${ch}', '${made.file}')`);
        report.ideaAfter = (await js(`window.ythub.readDoc('${ch}', 'ideas/2026-11-20-akku-trick.md')`)).fm;
      }
    }

    // Echter Claude-Code-Auftrag (nur mit YTHUB_SMOKE_CLAUDE=1, kostet ein paar Cent).
    if (process.env.YTHUB_SMOKE_CLAUDE === '1') {
      const job = await js(`window.ythub.createJob({ type: 'research', channel: 'mein-tech-kanal', count: 3, mode: 'background',
        note: 'Testlauf: halte dich kurz – höchstens 3 Websuchen, genau 3 Ideen, kurzer Bericht.' })`);
      await js(`location.hash = '#/auftraege?job=${job.id}'`);
      await wait(25000);
      await shot('10-auftrag-laeuft');
      const started = Date.now();
      let j = jobs.get(job.id);
      while (['wartet', 'läuft'].includes(j.status) && Date.now() - started < 9 * 60000) {
        await wait(3000);
        j = jobs.get(job.id);
      }
      await wait(1500);
      await shot('11-auftrag-fertig');
      await js(`location.hash = '#/'`);
      await shot('12-dashboard-nach-auftrag');
      report.job = { status: j.status, summary: j.summary, outputs: j.outputs, error: j.error, warning: j.warning, costUsd: j.costUsd, durationMs: j.durationMs, steps: j.progress.map((p) => p.text) };
      const ideaDir = path.join(settings.load().dataDir, 'channels', 'mein-tech-kanal', 'ideas');
      const ideaFiles = fs.existsSync(ideaDir) ? fs.readdirSync(ideaDir) : [];
      report.ideas = ideaFiles;
      if (ideaFiles[0]) report.firstIdea = fs.readFileSync(path.join(ideaDir, ideaFiles[0]), 'utf8');
    }

    const feed = channels.feed({ types: ['watch'] });
    report.feed = { videos: feed.length, outliers: feed.filter((v) => v.outlier).map((v) => `${v.channel.name}: ${v.title} (${v.score}×)`) };
    report.quota = quota.get();
    const tree = [];
    const walk = (d, p = '') => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        tree.push(p + e.name + (e.isDirectory() ? '/' : ''));
        if (e.isDirectory()) walk(path.join(d, e.name), p + e.name + '/');
      }
    };
    walk(settings.load().dataDir);
    report.dataDir = tree;
  } catch (err) {
    report.error = String(err && err.stack);
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  app.quit();
}

app.whenReady().then(() => {
  settings = createSettingsStore({
    userDataDir: app.getPath('userData'),
    documentsDir: app.getPath('documents'),
    safeStorage,
  });
  channels = createChannelStore(() => settings.load().dataDir);
  content = createContentStore((slug) => channels.dirOf(slug));
  prepareDataDir();
  quota = createQuotaCounter(app.getPath('userData'));
  youtube = smoke
    ? require('./fake-youtube.cjs').createFakeYoutubeClient()
    : createYoutubeClient({ getKey: () => settings.getYoutubeKey(), quota });
  jobs = createJobManager({
    getDataDir: () => settings.load().dataDir,
    getLanguage: () => settings.load().language,
    getChannel: (slug) => channels.list().find((c) => c.slug === slug) || null,
    findClaude,
    onChange: broadcastJobs,
  });
  updater = createUpdater({
    app,
    onStatus: (st) => win && !win.isDestroyed() && win.webContents.send('update:status', st),
  });
  registerIpc();
  createWindow();
  jobs.recover();
  setInterval(() => jobs.poll(), 3000); // Ergebnisse von Terminal-Aufträgen einsammeln
  if (!smoke) {
    win.webContents.once('did-finish-load', () => autoSync());
    // Bei „täglich“ auch bei lange offener App einmal pro Stunde nachsehen.
    setInterval(() => settings.load().checkInterval === 'daily' && syncChannels({ onlyStale: true }), 3600000);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
