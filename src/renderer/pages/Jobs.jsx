import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ago } from '../format.js';
import { hashQuery } from '../router.js';
import { JOB_TYPES, STATUS, openJobDialog } from '../jobDialog.js';
import Schedules from '../components/Schedules.jsx';

const icon = (type) => JOB_TYPES.find((t) => t.id === type)?.icon || '✳️';

function elapsed(job) {
  if (!job.startedAt) return null;
  const end = job.finishedAt ? new Date(job.finishedAt) : new Date();
  const s = Math.max(0, Math.round((end - new Date(job.startedAt)) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export default function Jobs({ jobs }) {
  const initial = useMemo(hashQuery, []);
  const [open, setOpen] = useState(initial.job || null);

  useEffect(() => {
    const on = () => {
      const q = hashQuery();
      if (q.job) setOpen(q.job);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const active = jobs.filter((j) => ['wartet', 'läuft', 'im Terminal'].includes(j.status));
  const done = jobs.filter((j) => !active.includes(j));

  return (
    <div className="page narrow-wide">
      <header className="page-head">
        <div>
          <h1>Aufträge</h1>
          <p className="muted">Was Claude Code für dich erledigt. Ergebnisse landen als Dateien im Kanal-Ordner.</p>
        </div>
        <button className="btn primary" onClick={() => openJobDialog({})}>＋ Neuer Auftrag</button>
      </header>

      {jobs.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🤖</div>
          <h2>Noch keine Aufträge</h2>
          <p className="muted">Schick Claude Code einen Auftrag – zum Beispiel neue Videoideen für einen deiner Kanäle.</p>
          <button className="btn primary" onClick={() => openJobDialog({ type: 'research' })}>Ideen recherchieren lassen</button>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="section-title">Aktiv <span className="count">{active.length}</span></h2>
          <div className="job-list">
            {active.map((j) => <JobRow key={j.id} job={j} open={open === j.id} onToggle={() => setOpen(open === j.id ? null : j.id)} />)}
          </div>
        </section>
      )}
      <Schedules />

      {done.length > 0 && (
        <section>
          <h2 className="section-title">Erledigt <span className="count">{done.length}</span></h2>
          <div className="job-list">
            {done.map((j) => <JobRow key={j.id} job={j} open={open === j.id} onToggle={() => setOpen(open === j.id ? null : j.id)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function JobRow({ job, open, onToggle }) {
  const st = STATUS[job.status] || { label: job.status, cls: '' };
  const [detail, setDetail] = useState(null);
  const [, tick] = useState(0);
  const logRef = useRef(null);
  const live = ['läuft', 'im Terminal'].includes(job.status);

  // Details nachladen, wenn aufgeklappt – und bei jeder Änderung des Auftrags.
  useEffect(() => {
    if (open) window.ythub.getJob(job.id).then(setDetail);
  }, [open, job.status, job.steps, job.finishedAt]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [detail]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  const act = (fn) => async (e) => {
    e.stopPropagation();
    try { await fn(); } catch (err) { window.alert(err.message); }
  };

  return (
    <article className={'job' + (open ? ' open' : '')}>
      <button className="job-head" onClick={onToggle}>
        <span className="job-icon">{icon(job.type)}</span>
        <span className="job-main">
          <strong>{job.title}</strong>
          <span className="muted small">
            {job.channel ? `${job.channel.name} · ` : ''}
            {live ? job.lastStep || 'startet …' : ago(job.createdAt)}
          </span>
        </span>
        <span className="job-side">
          {elapsed(job) && <span className="muted small">{elapsed(job)}</span>}
          {job.costUsd != null && <span className="muted small">{job.costUsd.toLocaleString('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}</span>}
          <span className={'pill ' + st.cls}>{live && <span className="spinner" />}{st.label}</span>
        </span>
      </button>

      {open && (
        <div className="job-body">
          {job.summary && <p className="job-summary">{job.summary}</p>}
          {job.error && <div className="notice error">{job.error}</div>}
          {job.warning && <div className="notice">{job.warning}</div>}

          {job.outputs?.length > 0 && (
            <div className="outputs">
              <span className="muted small">Ergebnisse</span>
              {job.outputs.map((o) => (
                <button key={o} className="output" onClick={act(() => window.ythub.openDataPath(o))} title="Öffnen">
                  📄 {o.replace(/^channels\/[^/]+\//, '')}
                </button>
              ))}
            </div>
          )}

          {job.status === 'im Terminal' && (
            <p className="muted small">Claude arbeitet im Terminal-Fenster. Sobald es die Ergebnis-Datei schreibt, wird der Auftrag hier automatisch als fertig markiert.</p>
          )}

          {detail?.progress?.length > 0 && (
            <div className="log" ref={logRef}>
              {detail.progress.map((p, i) => (
                <div key={i} className="log-line">
                  <span className="log-time">{new Date(p.t).toLocaleTimeString('de-DE')}</span>
                  <span>{p.text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="row">
            {['wartet', 'läuft', 'im Terminal'].includes(job.status) && (
              <button className="btn ghost small danger" onClick={act(() => window.ythub.cancelJob(job.id))}>Abbrechen</button>
            )}
            {['fertig', 'fehler', 'abgebrochen'].includes(job.status) && (
              <button className="btn ghost small" onClick={act(() => window.ythub.retryJob(job.id))}>↻ Erneut ausführen</button>
            )}
            <button className="btn ghost small" onClick={act(() => window.ythub.openDataPath(`auftraege/${job.id}.md`))}>Auftrag-Datei öffnen</button>
            {job.channel && (
              <button className="btn ghost small" onClick={act(() => window.ythub.openChannelFolder(job.channel.slug))}>Kanal-Ordner</button>
            )}
            {['fertig', 'fehler', 'abgebrochen'].includes(job.status) && (
              <button
                className="btn ghost small danger push-right"
                onClick={act(async () => { if (window.confirm('Auftrag aus der Liste entfernen? Die Ergebnis-Dateien im Kanal-Ordner bleiben erhalten.')) await window.ythub.removeJob(job.id); })}
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
