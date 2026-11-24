// Automatische Updates über electron-updater (z. B. GitHub Releases).
// Aktiv nur in der installierten App und nur, wenn beim Bauen ein "publish"-Ziel
// in package.json stand – dann legt electron-builder app-update.yml neben die App.
const fs = require('fs');
const path = require('path');

function createUpdater({ app, onStatus }) {
  let status = { state: 'idle', version: null, percent: null, error: null };
  const set = (patch) => {
    status = { ...status, ...patch };
    onStatus(status);
  };

  const configFile = path.join(process.resourcesPath || '', 'app-update.yml');
  const configured = app.isPackaged && fs.existsSync(configFile);
  if (!configured) {
    status = { state: app.isPackaged ? 'not-configured' : 'dev', version: null, percent: null, error: null };
    return { getStatus: () => status, check: async () => status, install: () => {} };
  }

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: null }));
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => set({ state: 'current', checkedAt: new Date().toISOString() }));
  autoUpdater.on('download-progress', (p) => set({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version, percent: 100 }));
  autoUpdater.on('error', (err) => set({ state: 'error', error: String(err && err.message ? err.message : err).slice(0, 300) }));

  const check = async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      set({ state: 'error', error: String(err.message || err).slice(0, 300) });
    }
    return status;
  };

  // Beim Start und danach alle 6 Stunden nachsehen.
  setTimeout(check, 10000);
  setInterval(check, 6 * 3600000);

  return {
    getStatus: () => status,
    check,
    install: () => autoUpdater.quitAndInstall(false, true),
  };
}

module.exports = { createUpdater };
