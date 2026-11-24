// Einstellungen des Benutzers. Liegen im Benutzerprofil (Electron userData),
// nie im Programm- oder Datenordner. Der YouTube-Key wird mit der Schlüsselablage
// des Betriebssystems verschlüsselt (Electron safeStorage).
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  dataDir: null, // wird beim ersten Laden auf Dokumente/YTHub gesetzt
  checkInterval: 'on-open', // 'on-open' | 'daily' | 'manual'
  language: 'de',
  claudeLaunchMode: 'background', // 'background' | 'terminal'
  setupDone: false,
  cloudSync: false, // Cloud-Sync mit Google Drive (aus, bis der Benutzer ihn einschaltet)
};

function createSettingsStore({ userDataDir, documentsDir, safeStorage }) {
  const file = path.join(userDataDir, 'settings.json');

  function readRaw() {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return {};
    }
  }

  function writeRaw(obj) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  function load() {
    const raw = readRaw();
    const s = { ...DEFAULTS, ...raw };
    if (!s.dataDir) s.dataDir = path.join(documentsDir, 'YTHub');
    return s;
  }

  function encryptionAvailable() {
    return !!(safeStorage && safeStorage.isEncryptionAvailable());
  }

  function getYoutubeKey() {
    const raw = readRaw();
    if (!raw.youtubeKey) return null;
    if (raw.youtubeKey.enc === 'safeStorage') {
      if (!encryptionAvailable()) return null;
      return safeStorage.decryptString(Buffer.from(raw.youtubeKey.data, 'base64'));
    }
    return null;
  }

  function setYoutubeKey(key) {
    const raw = readRaw();
    if (!key) {
      delete raw.youtubeKey;
    } else {
      if (!encryptionAvailable()) {
        throw new Error('Die Schlüsselablage des Betriebssystems ist nicht verfügbar – der Key kann nicht sicher gespeichert werden.');
      }
      raw.youtubeKey = {
        enc: 'safeStorage',
        data: safeStorage.encryptString(key).toString('base64'),
        hint: key.slice(-4),
      };
    }
    writeRaw(raw);
  }

  // Was die Oberfläche sehen darf: nie den Key selbst, nur die letzten 4 Zeichen.
  function publicView() {
    const s = load();
    const raw = readRaw();
    return {
      dataDir: s.dataDir,
      checkInterval: s.checkInterval,
      language: s.language,
      claudeLaunchMode: s.claudeLaunchMode,
      setupDone: s.setupDone,
      lastFeedVisit: s.lastFeedVisit || null,
      cloudSync: !!s.cloudSync,
      youtubeKey: raw.youtubeKey ? { set: true, hint: raw.youtubeKey.hint } : { set: false },
      encryptionAvailable: encryptionAvailable(),
    };
  }

  function update(patch) {
    const allowed = ['dataDir', 'checkInterval', 'language', 'claudeLaunchMode', 'setupDone', 'lastFeedVisit', 'cloudSync'];
    const raw = readRaw();
    for (const k of allowed) if (k in patch) raw[k] = patch[k];
    writeRaw(raw);
    return publicView();
  }

  return { load, publicView, update, getYoutubeKey, setYoutubeKey, file };
}

module.exports = { createSettingsStore, DEFAULTS };
