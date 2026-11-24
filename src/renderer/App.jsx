import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHashRoute, go, hashQuery } from './router.js';
import Dashboard from './pages/Dashboard.jsx';
import Feed from './pages/Feed.jsx';
import Jobs from './pages/Jobs.jsx';
import ChannelPage from './pages/ChannelPage.jsx';
import ScriptView from './pages/ScriptView.jsx';
import Settings from './pages/Settings.jsx';
import Welcome from './pages/Welcome.jsx';
import SyncIndicator from './components/SyncIndicator.jsx';
import NewJobDialog from './components/NewJobDialog.jsx';

const NAV = [
  { route: '/', label: 'Kanäle', icon: '▦' },
  { route: '/feed', label: 'Feed', icon: '◉' },
  { route: '/auftraege', label: 'Aufträge', icon: '➜' },
  { route: '/settings', label: 'Einstellungen', icon: '⚙' },
];

// Status des YouTube-Abgleichs; `version` steigt bei jedem Fortschritt,
// damit Seiten ihre Daten neu laden.
function useSyncStatus() {
  const [status, setStatus] = useState(null);
  const [version, setVersion] = useState(0);
  const last = useRef(null);
  useEffect(() => {
    window.ythub.getSyncStatus().then(setStatus);
    return window.ythub.onSyncStatus((s) => {
      setStatus(s);
      const sig = `${s.running}-${s.done}-${s.lastRun}`;
      if (sig !== last.current) {
        last.current = sig;
        setVersion((v) => v + 1);
      }
    });
  }, []);
  return { status, version };
}

function useJobs() {
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    window.ythub.listJobs().then(setJobs);
    return window.ythub.onJobsUpdate(setJobs);
  }, []);
  return jobs;
}

export default function App() {
  const route = useHashRoute();
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [jobPreset, setJobPreset] = useState(null);
  const sync = useSyncStatus();
  const jobs = useJobs();
  const closeJobDialog = useCallback(() => setJobPreset(null), []);
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    window.ythub.getUpdateStatus().then(setUpdate);
    return window.ythub.onUpdateStatus(setUpdate);
  }, []);

  const reloadSettings = useCallback(async () => {
    try {
      setSettings(await window.ythub.getSettings());
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
    const onJob = (e) => setJobPreset(e.detail || {});
    window.addEventListener('ythub:new-job', onJob);
    return () => window.removeEventListener('ythub:new-job', onJob);
  }, [reloadSettings]);

  // Wenn ein Auftrag fertig wird, sollen Kanal-Karten (Ideen/Skripte) neu zählen.
  const finishedCount = jobs.filter((j) => j.status === 'fertig').length;
  const dataVersion = sync.version * 1000 + finishedCount;

  if (loadError) return <div className="fatal">Einstellungen konnten nicht geladen werden: {loadError}</div>;
  if (!settings) return null;

  if (!settings.setupDone) {
    return <Welcome settings={settings} onSettings={setSettings} onDone={reloadSettings} />;
  }

  const activeJobs = jobs.filter((j) => ['wartet', 'läuft', 'im Terminal'].includes(j.status)).length;

  let page;
  if (route === '/settings') page = <Settings settings={settings} onSettings={setSettings} sync={sync} />;
  else if (route === '/feed') page = <Feed settings={settings} onSettings={setSettings} sync={sync} />;
  else if (route === '/auftraege') page = <Jobs jobs={jobs} />;
  else if (/^\/kanal\/[a-z0-9-]+\/skript$/.test(route)) {
    const file = hashQuery().file;
    page = <ScriptView key={file} slug={route.split('/')[2]} settings={settings} jobs={jobs} />;
  } else if (/^\/kanal\/[a-z0-9-]+$/.test(route)) page = <ChannelPage key={route} slug={route.split('/')[2]} dataVersion={dataVersion} />;
  else page = <Dashboard settings={settings} sync={{ ...sync, version: dataVersion }} />;

  return (
    <div className="shell">
      <nav className="rail">
        <div className="brand">
          <span className="brand-mark">▶</span>
          <span>YT Hub</span>
        </div>
        {NAV.map((n) => (
          <button key={n.route} className={'rail-item' + (route === n.route || (n.route === '/' && route.startsWith('/kanal/')) ? ' active' : '')} onClick={() => go(n.route)}>
            <span className="rail-icon" aria-hidden>{n.icon}</span>
            <span>{n.label}</span>
            {n.route === '/auftraege' && activeJobs > 0 && <span className="rail-badge">{activeJobs}</span>}
          </button>
        ))}
        <div className="rail-spacer" />
        {update?.state === 'ready' && (
          <button className="update-ready" onClick={() => window.ythub.installUpdate()}>
            ⬆ Update {update.version} bereit – neu starten
          </button>
        )}
        <SyncIndicator status={sync.status} hasKey={settings.youtubeKey.set} />
      </nav>
      <main className="content">{page}</main>
      {jobPreset && <NewJobDialog preset={jobPreset} settings={settings} onClose={closeJobDialog} />}
    </div>
  );
}
