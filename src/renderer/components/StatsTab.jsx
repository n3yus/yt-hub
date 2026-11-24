import React, { useEffect, useMemo, useState } from 'react';
import { compact, ago } from '../format.js';
import { go } from '../router.js';
import { openJobDialog } from '../jobDialog.js';
import ViewsChart from './ViewsChart.jsx';

const dur = (sec) => (sec == null ? '–' : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`);
const pct = (v) => (v == null ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`);

function delta(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

function Kpi({ label, value, d, hint }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {d != null && Number.isFinite(d) ? (
        <span className={'kpi-delta ' + (d >= 0 ? 'up' : 'down')}>
          {d >= 0 ? '▲' : '▼'} {Math.abs(d).toLocaleString('de-DE', { maximumFractionDigits: 0 })} % <span className="muted">vs. 28 Tage davor</span>
        </span>
      ) : (
        <span className="kpi-delta muted">{hint || ' '}</span>
      )}
    </div>
  );
}

const COLS = [
  { id: 'views', label: 'Aufrufe', fmt: (v) => compact(v.views) },
  { id: 'avgViewPercent', label: 'Ø angesehen', fmt: (v) => pct(v.avgViewPercent), title: 'Durchschnittlich angesehener Anteil des Videos' },
  { id: 'avgViewDurationSec', label: 'Ø Dauer', fmt: (v) => dur(v.avgViewDurationSec) },
  { id: 'subscribersGained', label: 'Abos', fmt: (v) => `+${v.subscribersGained}` },
  { id: 'ctr', label: 'Klickrate', fmt: (v) => pct(v.ctr), title: 'Klickrate der Thumbnail-Impressionen', ctr: true },
];

export default function StatsTab({ channel, dataVersion }) {
  const [google, setGoogle] = useState(null);
  const [data, setData] = useState(undefined);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [sort, setSort] = useState('views');

  const connected = !!(google && channel.youtubeId && google.connections[channel.youtubeId]);
  const conn = connected ? google.connections[channel.youtubeId] : null;

  useEffect(() => {
    window.ythub.googleStatus().then(setGoogle);
    window.ythub.getAnalytics(channel.slug).then(setData);
  }, [channel.slug, dataVersion]);

  const connect = async () => {
    setBusy('connect');
    setMsg(null);
    try {
      const res = await window.ythub.connectGoogle(channel.slug);
      setGoogle(res);
      if (res.warning) setMsg({ err: true, text: res.warning });
      setData(await window.ythub.getAnalytics(channel.slug));
    } catch (err) {
      setMsg({ err: true, text: err.message });
    } finally {
      setBusy(null);
    }
  };
  const refresh = async () => {
    setBusy('sync');
    setMsg(null);
    try {
      setData(await window.ythub.syncAnalytics(channel.slug));
    } catch (err) {
      setMsg({ err: true, text: err.message });
    } finally {
      setBusy(null);
      window.ythub.googleStatus().then(setGoogle);
    }
  };
  const disconnect = async () => {
    if (!window.confirm('Verbindung zu YouTube Analytics für diesen Kanal trennen? Die bisher geladenen Zahlen bleiben erhalten.')) return;
    setGoogle(await window.ythub.disconnectGoogle(channel.slug));
  };

  const videos = useMemo(() => {
    const list = [...(data?.videos || [])];
    return list.sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  }, [data, sort]);

  if (!google || data === undefined) return null;

  if (!connected && !data) {
    return (
      <div className="empty small-empty connect-card">
        <div className="empty-icon">📊</div>
        <h2>Echte Zahlen deines Kanals</h2>
        <p className="muted">
          Verbinde den Kanal mit YouTube Analytics, um Wiedergabezeit, durchschnittlich angesehenen Anteil, Klickrate und gewonnene Abos zu sehen.
          Claude nutzt die Zahlen dann für Recherche, Skripte und Learnings.
        </p>
        {google.client.set ? (
          <button className="btn primary" disabled={!!busy} onClick={connect}>{busy ? 'Warte auf Anmeldung im Browser …' : 'Mit Google anmelden'}</button>
        ) : (
          <>
            <p className="muted small">Dafür brauchst du einmalig einen eigenen Google-OAuth-Client.</p>
            <button className="btn primary" onClick={() => go('/settings')}>Zu den Einstellungen</button>
          </>
        )}
        {busy === 'connect' && <p className="muted small">Im Browser das Google-Konto und den Kanal „{channel.name}“ auswählen und zustimmen.</p>}
        {msg && <div className={'notice ' + (msg.err ? 'error' : 'ok')}>{msg.text}</div>}
      </div>
    );
  }

  const l = data?.last28;
  const p = data?.prev28;
  const netSubs = l ? l.subscribersGained - l.subscribersLost : null;
  const prevNet = p ? p.subscribersGained - p.subscribersLost : null;
  const showCols = COLS.filter((c) => !c.ctr || data?.ctrAvailable);

  return (
    <div className="stats">
      <div className="board-bar">
        <span className="muted small">
          {data ? `Stand ${ago(data.fetchedAt)} · Daten bis ${new Date(data.range.to).toLocaleDateString('de-DE')} (YouTube liefert mit 1–3 Tagen Verzögerung)` : ''}
          {conn?.error && <span className="err-text"> · {conn.error}</span>}
        </span>
        <div className="row tight">
          {connected ? (
            <>
              <button className="btn ghost small" disabled={!!busy} onClick={refresh}>{busy === 'sync' ? 'Lade …' : '↻ Aktualisieren'}</button>
              <button className="btn ghost small" onClick={disconnect}>Trennen</button>
            </>
          ) : (
            <button className="btn small" disabled={!!busy || !google.client.set} onClick={connect}>Wieder verbinden</button>
          )}
          <button className="btn small" onClick={() => openJobDialog({ type: 'learnings', channel: channel.slug })}>🧠 Learnings ableiten</button>
        </div>
      </div>
      {msg && <div className={'notice ' + (msg.err ? 'error' : 'ok')}>{msg.text}</div>}

      {data && (
        <>
          <div className="kpi-row">
            <Kpi label="Aufrufe (28 Tage)" value={compact(l.views)} d={delta(l.views, p.views)} />
            <Kpi label="Wiedergabezeit" value={`${compact(Math.round(l.watchMinutes / 60))} Std.`} d={delta(l.watchMinutes, p.watchMinutes)} />
            <Kpi label="Abos netto" value={`${netSubs >= 0 ? '+' : ''}${netSubs.toLocaleString('de-DE')}`} d={prevNet > 0 ? delta(netSubs, prevNet) : null} hint={`+${l.subscribersGained} / −${l.subscribersLost}`} />
            <Kpi label="Ø Wiedergabedauer" value={dur(l.avgViewDurationSec)} d={l.avgViewDurationSec && p.avgViewDurationSec ? delta(l.avgViewDurationSec, p.avgViewDurationSec) : null} />
          </div>

          <section className="panel">
            <div className="panel-head"><h2>Aufrufe pro Tag</h2><span className="muted small">letzte 56 Tage</span></div>
            <ViewsChart data={data.daily} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Videos der letzten 90 Tage</h2>
              <span className="muted small">Spaltenkopf anklicken zum Sortieren</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Video</th>
                  {showCols.map((c) => (
                    <th key={c.id} className={'num sortable' + (sort === c.id ? ' on' : '')} title={c.title} onClick={() => setSort(c.id)}>
                      {c.label}{sort === c.id ? ' ▾' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td className="title-cell">
                      <button className="link" onClick={() => window.ythub.openExternal(`https://www.youtube.com/watch?v=${v.id}`)} title={v.title || v.id}>{v.title || v.id}</button>
                    </td>
                    {showCols.map((c) => <td key={c.id} className="num">{c.fmt(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.ctrAvailable && <p className="muted small">Klickrate und Impressionen hat YouTube für diesen Kanal nicht geliefert.</p>}
          </section>
        </>
      )}
    </div>
  );
}
