// Cloud-Sync des Datenordners mit Google Drive (Zwei-Wege, mit Konfliktkopien).
//
// Jede Datei liegt in Drive im Ordner „YT Hub Sync“, ihr relativer Pfad steht in appProperties.
// Der Abgleich vergleicht MD5-Prüfsummen mit dem Stand des letzten Syncs (sync-state.json im
// Benutzerprofil). So erkennt er, welche Seite sich geändert hat:
//   nur lokal geändert  → hochladen        nur in Drive geändert → herunterladen
//   beide geändert      → lokale Fassung gewinnt, Drive-Fassung wird als Konfliktkopie gespeichert
//   lokal gelöscht      → in Drive in den Papierkorb   in Drive gelöscht → lokal in den Papierkorb
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { friendlyGoogleMessage } = require('./google.cjs');

const FOLDER_NAME = 'YT Hub Sync';
const MAX_SIZE = 10 * 1024 * 1024;
const SKIP_DIRS = new Set(['.claude', '.git', 'node_modules']);
const SKIP_FILE = /(\.log|\.tmp|\.cmd|~)$|^(desktop\.ini|thumbs\.db|\.ds_store)$/i;

// Caches, die jeder Rechner selbst neu von YouTube holt – nicht synchronisieren (sonst ständig Konflikte).
const CACHE_FILE = /(^|\/)(videos|analytics)\.json$/;
// Von der App gepflegte Verwaltungsdateien: bei Konflikt gewinnt still die lokale Fassung, ohne Kopie.
const SILENT_CONFLICT = /(^|\/)channel\.json$|^auftraege\//;

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

// Alle zu synchronisierenden Dateien im Datenordner: { 'channels/x/a.md': { md5, size } }
function scanLocal(root) {
  const out = {};
  const walk = (dir, rel) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), r);
      } else if (e.isFile() && !SKIP_FILE.test(e.name) && !CACHE_FILE.test(r)) {
        const full = path.join(dir, e.name);
        const size = fs.statSync(full).size;
        if (size <= MAX_SIZE) out[r] = { md5: md5(fs.readFileSync(full)), size };
      }
    }
  };
  walk(root, '');
  return out;
}

function conflictName(rel) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-');
  const ext = path.posix.extname(rel);
  return `${rel.slice(0, rel.length - ext.length)} (Konflikt Drive ${stamp})${ext}`;
}

// Entscheidet pro Datei, was zu tun ist. Reine Funktion – leicht zu testen.
function plan(local, remote, state) {
  const actions = [];
  const paths = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(state)]);
  for (const p of paths) {
    const l = local[p];
    const r = remote[p];
    const s = state[p];
    const lChanged = l && (!s || l.md5 !== s.md5);
    const rChanged = r && (!s || r.md5 !== s.md5);

    if (l && r) {
      if (l.md5 === r.md5) actions.push({ op: 'record', path: p });
      else if (lChanged && !rChanged) actions.push({ op: 'upload', path: p });
      else if (rChanged && !lChanged) actions.push({ op: 'download', path: p });
      else actions.push({ op: SILENT_CONFLICT.test(p) ? 'upload' : 'conflict', path: p }); // beide geändert oder erster Abgleich mit Unterschieden
    } else if (l && !r) {
      if (s && !lChanged) actions.push({ op: 'deleteLocal', path: p }); // in Drive gelöscht
      else actions.push({ op: 'upload', path: p }); // neu oder lokal geändert (gewinnt gegen Löschen)
    } else if (!l && r) {
      if (s && !rChanged) actions.push({ op: 'deleteRemote', path: p }); // lokal gelöscht
      else actions.push({ op: 'download', path: p }); // neu in Drive oder dort geändert
    } else {
      actions.push({ op: 'forget', path: p }); // auf beiden Seiten weg
    }
  }
  return actions;
}

// drive: { ensureFolder(), list(folderId), upload(folderId, rel, buf, existingId?), download(id), trash(id) }
async function syncFolder({ root, drive, stateFile, trashLocal, onProgress = () => {} }) {
  const state = (() => {
    try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return { files: {} }; }
  })();
  const folderId = state.folderId && (await drive.folderExists(state.folderId)) ? state.folderId : await drive.ensureFolder(FOLDER_NAME);
  // Anderer Drive-Ordner oder anderer Datenordner → wie erster Abgleich behandeln (nichts löschen).
  if (folderId !== state.folderId || path.resolve(root) !== state.root) state.files = {};
  state.folderId = folderId;
  state.root = path.resolve(root);

  const local = scanLocal(root);
  const remoteList = await drive.list(folderId);
  const remote = {};
  for (const f of remoteList) {
    const p = f.appProperties?.ythubPath;
    if (!p || remote[p] || CACHE_FILE.test(p)) continue; // Dubletten und Caches ignorieren
    remote[p] = { md5: f.md5Checksum, id: f.id };
  }

  const actions = plan(local, remote, state.files);
  const stats = { uploaded: 0, downloaded: 0, conflicts: 0, deletedLocal: 0, deletedRemote: 0, errors: [] };
  const work = actions.filter((a) => !['record', 'forget'].includes(a.op));
  let done = 0;

  const writeLocal = (rel, buf) => {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const tmp = full + '.ythub-sync.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, full);
  };
  const readLocal = (rel) => fs.readFileSync(path.join(root, ...rel.split('/')));

  for (const a of actions) {
    const p = a.path;
    try {
      switch (a.op) {
        case 'record':
          state.files[p] = { md5: local[p].md5, id: remote[p].id };
          break;
        case 'forget':
          delete state.files[p];
          break;
        case 'upload': {
          const id = await drive.upload(folderId, p, readLocal(p), remote[p]?.id || state.files[p]?.id);
          state.files[p] = { md5: local[p].md5, id };
          stats.uploaded++;
          break;
        }
        case 'download': {
          const buf = await drive.download(remote[p].id);
          writeLocal(p, buf);
          state.files[p] = { md5: md5(buf), id: remote[p].id };
          stats.downloaded++;
          break;
        }
        case 'conflict': {
          // Drive-Fassung als Kopie sichern, lokale Fassung hochladen.
          const buf = await drive.download(remote[p].id);
          const copy = conflictName(p);
          writeLocal(copy, buf);
          const id = await drive.upload(folderId, p, readLocal(p), remote[p].id);
          state.files[p] = { md5: local[p].md5, id };
          // Kopie gleich mit hochladen, damit sie auch auf den anderen Rechnern auftaucht.
          state.files[copy] = { md5: md5(buf), id: await drive.upload(folderId, copy, buf, null) };
          stats.conflicts++;
          break;
        }
        case 'deleteLocal':
          await trashLocal(path.join(root, ...p.split('/')));
          delete state.files[p];
          stats.deletedLocal++;
          break;
        case 'deleteRemote':
          await drive.trash(remote[p].id);
          delete state.files[p];
          stats.deletedRemote++;
          break;
      }
    } catch (err) {
      if (err.fatal) throw err; // z. B. API deaktiviert oder Anmeldung ungültig – Abbruch
      stats.errors.push(`${p}: ${err.message}`);
    }
    if (!['record', 'forget'].includes(a.op)) onProgress(++done, work.length);
  }

  state.lastSync = new Date().toISOString();
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
  return { ...stats, files: Object.keys(state.files).length, at: state.lastSync };
}

// ---- Google-Drive-REST-Client ----
function createDriveClient(getToken) {
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  async function req(url, opts = {}, raw = false) {
    const token = await getToken();
    if (!token) {
      const e = new Error('Google Drive ist nicht verbunden.');
      e.fatal = true;
      throw e;
    }
    let res;
    try {
      res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) }, signal: AbortSignal.timeout(60000) });
    } catch {
      const e = new Error('Keine Verbindung zu Google Drive.');
      e.fatal = true;
      throw e;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const reason = body.error?.errors?.[0]?.reason || body.error?.status || '';
      const e = new Error(friendlyGoogleMessage(body.error?.message, reason) || `Drive-Fehler ${res.status}`);
      e.status = res.status;
      e.reason = reason;
      e.fatal = res.status === 401 || reason === 'accessNotConfigured' || reason === 'SERVICE_DISABLED' || reason === 'storageQuotaExceeded' || reason === 'userRateLimitExceeded';
      throw e;
    }
    if (raw) return Buffer.from(await res.arrayBuffer());
    return res.status === 204 ? null : res.json();
  }

  const q = (s) => encodeURIComponent(s);

  return {
    async folderExists(id) {
      try {
        const f = await req(`${API}/files/${id}?fields=id,trashed`);
        return !f.trashed;
      } catch (err) {
        if (err.fatal) throw err;
        return false;
      }
    },
    async ensureFolder(name) {
      const found = await req(`${API}/files?q=${q(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&spaces=drive`);
      if (found.files?.[0]) return found.files[0].id;
      const created = await req(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', description: 'Daten von YT Hub (Cloud-Sync). Nicht von Hand ändern.' }),
      });
      return created.id;
    },
    async list(folderId) {
      const out = [];
      let pageToken = '';
      do {
        const res = await req(`${API}/files?q=${q(`'${folderId}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name,md5Checksum,appProperties)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`);
        out.push(...(res.files || []));
        pageToken = res.nextPageToken || '';
      } while (pageToken);
      return out;
    },
    async upload(folderId, rel, buf, existingId) {
      const boundary = `ythub${crypto.randomBytes(8).toString('hex')}`;
      const meta = existingId
        ? { appProperties: { ythubPath: rel } }
        : { name: rel.replace(/\//g, ' › '), parents: [folderId], appProperties: { ythubPath: rel } };
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
        buf,
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      const url = existingId ? `${UPLOAD}/files/${existingId}?uploadType=multipart&fields=id` : `${UPLOAD}/files?uploadType=multipart&fields=id`;
      try {
        const res = await req(url, { method: existingId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
        return res.id;
      } catch (err) {
        if (existingId && err.status === 404) return this.upload(folderId, rel, buf, null); // Datei in Drive verschwunden → neu anlegen
        throw err;
      }
    },
    download: (id) => req(`${API}/files/${id}?alt=media`, {}, true),
    trash: (id) =>
      req(`${API}/files/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }),
  };
}

module.exports = { syncFolder, plan, scanLocal, conflictName, createDriveClient, FOLDER_NAME };
