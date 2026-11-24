import React, { useEffect, useState } from 'react';

const KEY_GUIDE = 'https://developers.google.com/youtube/v3/getting-started';
const CLAUDE_GUIDE = 'https://code.claude.com/docs';

export function YoutubeKeySection({ settings, onSettings }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);

  const save = async () => {
    setBusy('save');
    setResult(null);
    try {
      const test = await window.ythub.testYoutubeKey(value);
      if (!test.ok && test.status !== 'quota') {
        setResult(test);
        return;
      }
      onSettings(await window.ythub.setYoutubeKey(value));
      setValue('');
      setResult(test);
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setResult(null);
    try {
      setResult(await window.ythub.testYoutubeKey(''));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm('YouTube-API-Key aus diesem Programm entfernen?')) return;
    onSettings(await window.ythub.setYoutubeKey(''));
    setResult(null);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>YouTube-API-Key</h2>
        {settings.youtubeKey.set ? <span className="pill ok">gespeichert ••••{settings.youtubeKey.hint}</span> : <span className="pill">nicht eingetragen</span>}
      </div>
      <p className="muted">
        Damit holt YT Hub Kanaldaten und neue Videos. Jeder Benutzer nutzt seinen eigenen Key – er wird verschlüsselt nur
        auf diesem Rechner gespeichert.{' '}
        <button className="link" onClick={() => window.ythub.openExternal(KEY_GUIDE)}>So bekommst du einen Key</button>
      </p>

      <div className="row">
        <div className="input-with-btn">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={settings.youtubeKey.set ? 'Neuen Key eingeben, um ihn zu ersetzen' : 'AIza…'}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label="Key anzeigen">
            {show ? 'verbergen' : 'anzeigen'}
          </button>
        </div>
        <button className="btn primary" disabled={!value.trim() || busy} onClick={save}>
          {busy === 'save' ? 'Prüfe …' : 'Prüfen & speichern'}
        </button>
      </div>

      {settings.youtubeKey.set && (
        <div className="row">
          <button className="btn ghost small" disabled={!!busy} onClick={test}>{busy === 'test' ? 'Teste …' : 'Gespeicherten Key testen'}</button>
          <button className="btn ghost small danger" onClick={remove}>Key entfernen</button>
        </div>
      )}

      {settings.youtubeKey.set && <QuotaLine />}

      {!settings.encryptionAvailable && (
        <div className="notice error">Die Schlüsselablage des Betriebssystems ist nicht verfügbar – der Key kann nicht gespeichert werden.</div>
      )}
      {result && <div className={'notice ' + (result.ok ? 'ok' : 'error')}>{result.message}</div>}
    </section>
  );
}

function QuotaLine() {
  const [q, setQ] = useState(null);
  useEffect(() => {
    window.ythub.getQuota().then(setQ);
    return window.ythub.onSyncStatus((s) => s.quota && setQ(s.quota));
  }, []);
  if (!q) return null;
  const pct = Math.min(100, (q.used / q.limit) * 100);
  return (
    <div className="quota">
      <span className="muted small">
        Heute verbraucht: ca. {q.used.toLocaleString('de-DE')} von {q.limit.toLocaleString('de-DE')} Einheiten (ein Kanal-Abgleich kostet ca. 3)
      </span>
      <div className="quota-bar"><div style={{ width: `${Math.max(pct, 0.5)}%` }} /></div>
    </div>
  );
}

export function ClaudeSection({ settings, onSettings }) {
  const [claude, setClaude] = useState(null);

  const check = async () => {
    setClaude(null);
    setClaude(await window.ythub.findClaude());
  };
  useEffect(() => {
    check();
  }, []);

  const setMode = async (mode) => onSettings(await window.ythub.updateSettings({ claudeLaunchMode: mode }));

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Claude Code</h2>
        {claude === null ? (
          <span className="pill">suche …</span>
        ) : claude.found ? (
          <span className="pill ok">gefunden</span>
        ) : (
          <span className="pill warn">nicht gefunden</span>
        )}
      </div>
      <p className="muted">
        YT Hub schickt Aufträge (Recherche, Skripte) an Claude Code auf diesem Rechner. Claude Code muss installiert und angemeldet sein.
      </p>
      {claude?.found && (
        <p className="mono small">
          {claude.path}
          {claude.version ? ` · ${claude.version}` : ''}
        </p>
      )}
      {claude && !claude.found && (
        <div className="notice">
          <span>Claude Code wurde nicht gefunden.</span>
          <button className="btn ghost small" onClick={() => window.ythub.openExternal(CLAUDE_GUIDE)}>Installationsanleitung</button>
          <button className="btn ghost small" onClick={check}>Erneut suchen</button>
        </div>
      )}

      <div className="field">
        <span>Aufträge standardmäßig</span>
        <div className="segmented">
          <button type="button" className={settings.claudeLaunchMode === 'background' ? 'on' : ''} onClick={() => setMode('background')}>
            <strong>Im Hintergrund</strong>
            <small>Claude arbeitet ohne Fenster, der Status erscheint in YT Hub</small>
          </button>
          <button type="button" className={settings.claudeLaunchMode === 'terminal' ? 'on' : ''} onClick={() => setMode('terminal')}>
            <strong>In Claude Code öffnen</strong>
            <small>Ein Terminal öffnet sich, du kannst mitreden</small>
          </button>
        </div>
      </div>
    </section>
  );
}

export function DataDirSection({ settings, onSettings }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Datenordner</h2>
      </div>
      <p className="muted">Hier liegen deine Kanäle, Ideen, Skripte und Aufträge als normale Dateien.</p>
      <div className="row">
        <code className="path">{settings.dataDir}</code>
        <button className="btn ghost small" onClick={async () => onSettings(await window.ythub.chooseDataDir())}>Ändern …</button>
        <button className="btn ghost small" onClick={() => window.ythub.openChannelFolder(null)}>Öffnen</button>
      </div>
    </section>
  );
}

export function GeneralSection({ settings, onSettings }) {
  const update = async (patch) => onSettings(await window.ythub.updateSettings(patch));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Allgemein</h2>
      </div>
      <label className="field inline">
        <span>Beobachtete Kanäle auf neue Videos prüfen</span>
        <select value={settings.checkInterval} onChange={(e) => update({ checkInterval: e.target.value })}>
          <option value="on-open">beim Öffnen der App</option>
          <option value="daily">einmal täglich</option>
          <option value="manual">nur auf Knopfdruck</option>
        </select>
      </label>
      <label className="field inline">
        <span>Sprache für Skripte</span>
        <select value={settings.language} onChange={(e) => update({ language: e.target.value })}>
          <option value="de">Deutsch</option>
          <option value="en">Englisch</option>
        </select>
      </label>
    </section>
  );
}

const UPDATE_TEXT = {
  dev: 'Updates gibt es nur in der installierten App.',
  'not-configured': 'Automatische Updates sind für diese Version nicht eingerichtet.',
  idle: 'Noch nicht nach Updates gesucht.',
  checking: 'Suche nach Updates …',
  current: 'Du hast die neueste Version.',
  downloading: 'Update wird geladen …',
  ready: 'Update ist bereit.',
  error: 'Update-Suche fehlgeschlagen.',
};

function UpdateSection({ version }) {
  const [st, setSt] = useState(null);
  useEffect(() => {
    window.ythub.getUpdateStatus().then(setSt);
    return window.ythub.onUpdateStatus(setSt);
  }, []);
  if (!st) return null;
  const canCheck = !['dev', 'not-configured', 'checking', 'downloading'].includes(st.state);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Über YT Hub</h2>
        <span className="pill">Version {version}</span>
      </div>
      <p className="muted">
        {UPDATE_TEXT[st.state] || st.state}
        {st.state === 'downloading' && st.version ? ` Version ${st.version}${st.percent != null ? ` – ${st.percent} %` : ''}` : ''}
        {st.state === 'ready' ? ` Version ${st.version} wird beim nächsten Neustart installiert.` : ''}
      </p>
      {st.error && <p className="err-text small">{st.error}</p>}
      <div className="row">
        {st.state === 'ready' && <button className="btn primary small" onClick={() => window.ythub.installUpdate()}>Jetzt neu starten und aktualisieren</button>}
        {canCheck && st.state !== 'ready' && <button className="btn ghost small" onClick={() => window.ythub.checkForUpdates()}>Nach Updates suchen</button>}
      </div>
    </section>
  );
}

export default function Settings({ settings, onSettings }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    window.ythub.appInfo().then(setInfo);
  }, []);

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Einstellungen</h1>
          <p className="muted">Gelten nur für diesen Rechner.</p>
        </div>
      </header>
      <YoutubeKeySection settings={settings} onSettings={onSettings} />
      <ClaudeSection settings={settings} onSettings={onSettings} />
      <DataDirSection settings={settings} onSettings={onSettings} />
      <GeneralSection settings={settings} onSettings={onSettings} />
      {info && <UpdateSection version={info.version} />}
    </div>
  );
}
