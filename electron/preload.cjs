// Schmale Brücke zwischen Oberfläche und Hauptprozess. Die Oberfläche hat keinen
// Zugriff auf Node oder das Dateisystem, nur auf diese Funktionen.
const { contextBridge, ipcRenderer } = require('electron');

const call = async (channel, ...args) => {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (!res.ok) throw new Error(res.error);
  return res.data;
};

contextBridge.exposeInMainWorld('ythub', {
  getSettings: () => call('settings:get'),
  updateSettings: (patch) => call('settings:update', patch),
  setYoutubeKey: (key) => call('settings:setYoutubeKey', key),
  testYoutubeKey: (key) => call('settings:testYoutubeKey', key),
  chooseDataDir: () => call('settings:chooseDataDir'),
  getQuota: () => call('settings:quota'),
  findClaude: () => call('claude:find'),

  listChannels: () => call('channels:list'),
  addChannel: (input) => call('channels:add', input),
  openChannelFolder: (slug) => call('channels:openFolder', slug),
  removeChannel: (slug) => call('channels:remove', slug),
  syncChannels: (slugs) => call('channels:sync', slugs),
  getSyncStatus: () => call('sync:status'),
  onSyncStatus: (fn) => {
    const listener = (_e, status) => fn(status);
    ipcRenderer.on('sync:status', listener);
    return () => ipcRenderer.removeListener('sync:status', listener);
  },

  listFeed: (opts) => call('feed:list', opts),
  listIdeas: (slug) => call('ideas:list', slug),

  ideas: (slug) => call('content:ideas', slug),
  scripts: (slug) => call('content:scripts', slug),
  research: (slug) => call('content:research', slug),
  readDoc: (slug, rel) => call('content:read', slug, rel),
  writeDoc: (slug, rel, text) => call('content:write', slug, rel, text),
  setDocStatus: (slug, rel, status) => call('content:setStatus', slug, rel, status),
  createIdea: (slug, input) => call('content:createIdea', slug, input),
  trashDoc: (slug, rel) => call('content:trash', slug, rel),
  openDoc: (slug, rel) => call('content:open', slug, rel),
  getComments: (slug, rel) => call('comments:get', slug, rel),
  setComments: (slug, rel, list) => call('comments:set', slug, rel, list),

  listJobs: () => call('jobs:list'),
  getJob: (id) => call('jobs:get', id),
  createJob: (input) => call('jobs:create', input),
  cancelJob: (id) => call('jobs:cancel', id),
  retryJob: (id) => call('jobs:retry', id),
  removeJob: (id) => call('jobs:remove', id),
  openDataPath: (rel) => call('jobs:openPath', rel),
  onJobsUpdate: (fn) => {
    const listener = (_e, list) => fn(list);
    ipcRenderer.on('jobs:update', listener);
    return () => ipcRenderer.removeListener('jobs:update', listener);
  },

  openExternal: (url) => call('app:openExternal', url),
  appInfo: () => call('app:info'),
  getUpdateStatus: () => call('update:status'),
  checkForUpdates: () => call('update:check'),
  installUpdate: () => call('update:install'),
  getAutostart: () => call('app:getAutostart'),
  setAutostart: (on) => call('app:setAutostart', on),
  onNavigate: (fn) => {
    const listener = (_e, route) => fn(route);
    ipcRenderer.on('navigate', listener);
    return () => ipcRenderer.removeListener('navigate', listener);
  },

  googleStatus: () => call('google:status'),
  setGoogleClient: (id, secret) => call('google:setClient', id, secret),
  connectGoogle: (slug) => call('google:connect', slug),
  disconnectGoogle: (slug) => call('google:disconnect', slug),
  getAnalytics: (slug) => call('analytics:get', slug),
  syncAnalytics: (slug) => call('analytics:sync', slug),

  listSchedules: () => call('schedules:list'),
  saveSchedule: (plan) => call('schedules:save', plan),
  removeSchedule: (id) => call('schedules:remove', id),
  setScheduleEnabled: (id, on) => call('schedules:setEnabled', id, on),
  runScheduleNow: (id) => call('schedules:runNow', id),
  onSchedulesUpdate: (fn) => {
    const listener = (_e, list) => fn(list);
    ipcRenderer.on('schedules:update', listener);
    return () => ipcRenderer.removeListener('schedules:update', listener);
  },
  onUpdateStatus: (fn) => {
    const listener = (_e, s) => fn(s);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  },
});
