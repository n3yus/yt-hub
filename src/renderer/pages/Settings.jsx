import React, { useEffect, useState } from 'react';
import ErrorNotice from '../components/ErrorNotice.jsx';

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
      <AutostartRow />
    </section>
  );
}

const OAUTH_GUIDE = 'https://console.cloud.google.com/apis/credentials';

function GoogleSection() {
  const [st, setSt] = useState(null);
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [msg, setMsg] = useState(null);
  const [help, setHelp] = useState(false);
  useEffect(() => { window.ythub.googleStatus().then(setSt); }, []);
  if (!st) return null;

  const save = async () => {
    try {
      setSt(await window.ythub.setGoogleClient(id, secret));
      setId('');
      setSecret('');
      setMsg({ ok: true, text: 'Gespeichert. Verbinde jetzt deine eigenen Kanäle auf ihrer Seite unter „Statistik“.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };
  const remove = async () => {
    if (!window.confirm('OAuth-Client entfernen? Verbundene Kanäle können dann keine neuen Zahlen mehr laden.')) return;
    setSt(await window.ythub.setGoogleClient('', ''));
  };
  const conns = Object.entries(st.connections);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>YouTube Analytics (optional)</h2>
        {st.client.set ? <span className="pill ok">eingerichtet</span> : <span className="pill">nicht eingerichtet</span>}
      </div>
      <p className="muted">
        Für echte Zahlen deiner eigenen Kanäle (Wiedergabezeit, angesehener Anteil, Klickrate, Abos) meldet sich YT Hub bei Google an.
        Dafür brauchst du einmalig einen eigenen OAuth-Client vom Typ „Desktop-App“. Client-Secret und Anmeldungen werden verschlüsselt nur auf diesem Rechner gespeichert.{' '}
        <button className="link" onClick={() => setHelp((h) => !h)}>{help ? 'Anleitung ausblenden' : 'So richtest du das ein'}</button>
      </p>
      {help && (
        <ol className="guide">
          <li>In der <button className="link" onClick={() => window.ythub.openExternal(OAUTH_GUIDE)}>Google Cloud Console</button> dasselbe Projekt wie für den API-Key öffnen.</li>
          <li>Unter „APIs &amp; Dienste → Bibliothek“ die <strong>YouTube Analytics API</strong> aktivieren.</li>
          <li>„OAuth-Zustimmungsbildschirm“ einrichten: Typ <strong>Extern</strong>, Status „Testen“, dein Google-Konto als <strong>Testnutzer</strong> eintragen.</li>
          <li>„Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID“, Anwendungstyp <strong>Desktop-App</strong>.</li>
          <li>Client-ID und Client-Secret hier eintragen.</li>
          <li>Für den Cloud-Sync zusätzlich die <strong>Google Drive API</strong> aktivieren.</li>
        </ol>
      )}
      {st.client.set && <p className="mono small">{st.client.id}</p>}
      <div className="row">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Client-ID (…apps.googleusercontent.com)" spellCheck={false} />
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Client-Secret" autoComplete="off" spellCheck={false} />
        <button className="btn primary" disabled={!id.trim() || !secret.trim()} onClick={save}>{st.client.set ? 'Ersetzen' : 'Speichern'}</button>
        {st.client.set && <button className="btn ghost small danger" onClick={remove}>Entfernen</button>}
      </div>
      {msg && <div className={'notice ' + (msg.ok ? 'ok' : 'error')}>{msg.text}</div>}
      {conns.length > 0 && (
        <div className="conn-list">
          <span className="muted small">Verbundene Kanäle</span>
          {conns.map(([cid, c]) => (
            <div key={cid} className="conn">
              <span>📊 {c.title}</span>
              <span className="muted small">seit {new Date(c.connectedAt).toLocaleDateString('de-DE')}</span>
              {c.error && <span className="err-text small">{c.error}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CloudSection() {
  const [st, setSt] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    window.ythub.cloudStatus().then(setSt);
    return window.ythub.onCloudStatus(setSt);
  }, []);
  useEffect(() => {
    window.ythub.googleStatus().then((g) => setGoogleReady(g.client.set));
  }, [st?.enabled, st?.drive?.connected]);
  if (!st) return null;

  const run = (fn) => async () => {
    setBusy(true);
    setErr(null);
    try { setSt(await fn()); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const disconnect = async () => {
    if (!window.confirm('Google Drive trennen? Der Cloud-Sync wird ausgeschaltet. Deine Dateien bleiben lokal und in Drive erhalten.')) return;
    run(() => window.ythub.disconnectCloud())();
  };
  const last = st.last;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Cloud-Sync mit Google Drive (optional)</h2>
        <input type="checkbox" className="toggle" checked={st.enabled} onChange={run(() => window.ythub.setCloudEnabled(!st.enabled))} title={st.enabled ? 'Ausschalten' : 'Einschalten'} />
      </div>
      <p className="muted">
        Hält deinen Datenordner (Kanäle, Ideen, Skripte, Recherchen, Pläne) mit dem Drive-Ordner „YT Hub Sync“ abgeglichen – als Backup und um auf mehreren
        Rechnern zu arbeiten. YT Hub sieht nur Dateien, die es selbst in Drive angelegt hat. Wurde eine Datei auf zwei Rechnern geändert, bleiben beide Fassungen erhalten
        (Kopie mit „Konflikt“ im Namen). YouTube-Zahlen werden nicht hochgeladen, jeder Rechner holt sie selbst.
      </p>

      {!st.enabled && <p className="muted small">Ausgeschaltet – YT Hub greift nicht auf Google Drive zu.</p>}

      {st.enabled && !googleReady && (
        <div className="notice"><span>Zuerst oben unter „YouTube Analytics“ einen Google-OAuth-Client eintragen und in der Google Cloud Console die <strong>Google Drive API</strong> aktivieren.</span></div>
      )}

      {st.enabled && googleReady && !st.drive.connected && (
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={run(() => window.ythub.connectCloud())}>{busy ? 'Warte auf Anmeldung im Browser …' : 'Mit Google Drive verbinden'}</button>
          <span className="muted small">Im Browser zustimmen, dass YT Hub eigene Dateien in deinem Drive anlegen darf.</span>
        </div>
      )}

      {st.drive.connected && (
        <>
          <div className="cloud-account">
            <span>☁ {st.drive.name || 'Google Drive'}{st.drive.email ? ` · ${st.drive.email}` : ''}</span>
            <span className="muted small">
              {st.running
                ? `Synchronisiere … ${st.total ? `${st.done}/${st.total}` : ''}`
                : last
                  ? `Zuletzt ${new Date(last.at).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${last.files} Dateien · ↑${last.uploaded} ↓${last.downloaded}${last.conflicts ? ` · ${last.conflicts} Konflikt(e)` : ''}`
                  : st.enabled ? 'Noch nicht synchronisiert' : 'Sync ist ausgeschaltet'}
            </span>
          </div>
          <div className="row">
            <button className="btn ghost small" disabled={busy || st.running || !st.enabled} onClick={run(() => window.ythub.syncCloudNow())}>↻ Jetzt synchronisieren</button>
            <button className="btn ghost small danger" onClick={disconnect}>Drive trennen</button>
          </div>
          {st.enabled && <p className="muted small">Automatisch beim Start, alle 10 Minuten und nach jedem fertigen Auftrag.</p>}
        </>
      )}
      <ErrorNotice text={err || st.drive.error || st.error} />
    </section>
  );
}

function AutostartRow() {
  const [st, setSt] = useState(null);
  useEffect(() => { window.ythub.getAutostart().then(setSt); }, []);
  if (!st) return null;
  return (
    <label className="field inline">
      <span>
        Mit Windows starten (minimiert)
        <br />
        <small className="muted">Damit geplante Aufträge auch laufen, ohne dass du YT Hub öffnest.{!st.available ? ' Nur in der installierten App.' : ''}</small>
      </span>
      <input type="checkbox" className="toggle" disabled={!st.available} checked={st.enabled} onChange={async (e) => setSt(await window.ythub.setAutostart(e.target.checked))} />
    </label>
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
      <GoogleSection />
      <CloudSection />
      <DataDirSection settings={settings} onSettings={onSettings} />
      <GeneralSection settings={settings} onSettings={onSettings} />
      {info && <UpdateSection version={info.version} />}
    </div>
  );
}
