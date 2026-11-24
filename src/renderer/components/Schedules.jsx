import React, { useEffect, useState } from 'react';
import { JOB_TYPES } from '../jobDialog.js';

const PLAN_TYPES = ['research', 'learnings', 'profile', 'free'];
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function Schedules() {
  const [plans, setPlans] = useState(null);
  const [channels, setChannels] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    window.ythub.listSchedules().then(setPlans);
    window.ythub.listChannels().then(setChannels);
    return window.ythub.onSchedulesUpdate(setPlans);
  }, []);
  if (!plans) return null;

  const chName = (slug) => channels.find((c) => c.slug === slug)?.name || slug;
  const act = (fn) => async () => {
    try { setPlans(await fn()); } catch (err) { window.alert(err.message); }
  };

  return (
    <section>
      <div className="section-title-row">
        <h2 className="section-title">Geplant <span className="count">{plans.length}</span></h2>
        <button className="btn ghost small" onClick={() => setEditing({})}>＋ Plan</button>
      </div>
      {plans.length === 0 ? (
        <p className="muted small">Lass Claude regelmäßig arbeiten – z. B. jeden Montag neue Ideen recherchieren. Geplante Aufträge laufen, solange YT Hub geöffnet ist; verpasste Termine werden beim nächsten Start nachgeholt.</p>
      ) : (
        <div className="job-list">
          {plans.map((p) => {
            const t = JOB_TYPES.find((x) => x.id === p.type);
            return (
              <article key={p.id} className={'job plan' + (p.enabled ? '' : ' off')}>
                <div className="job-head static">
                  <span className="job-icon">{t?.icon}</span>
                  <span className="job-main">
                    <strong>{t?.label}{p.channel ? ` · ${chName(p.channel)}` : ''}</strong>
                    <span className="muted small">
                      🕒 {p.label}
                      {p.enabled && p.nextRun ? ` · nächster Lauf ${new Date(p.nextRun).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ' · pausiert'}
                      {p.lastError ? ` · ⚠ ${p.lastError}` : ''}
                    </span>
                  </span>
                  <span className="job-side">
                    <button className="btn ghost small" onClick={act(async () => { await window.ythub.runScheduleNow(p.id); return window.ythub.listSchedules(); })}>Jetzt ausführen</button>
                    <button className="btn ghost small" onClick={() => setEditing(p)}>Bearbeiten</button>
                    <label className="switch" title={p.enabled ? 'Pausieren' : 'Aktivieren'}>
                      <input type="checkbox" className="toggle" checked={p.enabled} onChange={act(() => window.ythub.setScheduleEnabled(p.id, !p.enabled))} />
                    </label>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {editing && (
        <ScheduleDialog
          plan={editing}
          channels={channels}
          onClose={() => setEditing(null)}
          onSaved={(list) => { setPlans(list); setEditing(null); }}
        />
      )}
    </section>
  );
}

function ScheduleDialog({ plan, channels, onClose, onSaved }) {
  const [type, setType] = useState(plan.type || 'research');
  const [channel, setChannel] = useState(plan.channel || '');
  const [freq, setFreq] = useState(plan.freq || 'weekly');
  const [weekday, setWeekday] = useState(plan.weekday ?? 1);
  const [hour, setHour] = useState(plan.hour ?? 8);
  const [count, setCount] = useState(plan.count || 5);
  const [note, setNote] = useState(plan.note || '');
  const [text, setText] = useState(plan.text || '');
  const [error, setError] = useState(null);

  const t = JOB_TYPES.find((x) => x.id === type);
  const options = channels.filter((c) => !t.needsOwn || c.type === 'own');
  useEffect(() => {
    if (type !== 'free' && !options.find((c) => c.slug === channel)) setChannel(options[0]?.slug || '');
  }, [type, channels]);

  const save = async (e) => {
    e.preventDefault();
    try {
      onSaved(await window.ythub.saveSchedule({ id: plan.id, type, channel: channel || null, freq, weekday, hour, count, note, text, enabled: plan.enabled !== false }));
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async () => {
    if (!window.confirm('Diesen Plan löschen? Bereits erledigte Aufträge bleiben erhalten.')) return;
    onSaved(await window.ythub.removeSchedule(plan.id));
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog wide" onSubmit={save}>
        <h2>{plan.id ? 'Plan bearbeiten' : 'Auftrag planen'}</h2>
        <div className="type-grid four">
          {PLAN_TYPES.map((id) => {
            const x = JOB_TYPES.find((j) => j.id === id);
            return (
              <button type="button" key={id} className={'type-btn' + (type === id ? ' on' : '')} onClick={() => setType(id)}>
                <span className="type-icon">{x.icon}</span>
                <span>{x.label}</span>
              </button>
            );
          })}
        </div>
        <p className="muted small">{t.hint}</p>

        <label className="field">
          <span>Kanal{type === 'free' && <em>optional</em>}</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {type === 'free' && <option value="">– kein bestimmter Kanal –</option>}
            {options.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>

        <div className="field">
          <span>Wann?</span>
          <div className="row tight">
            <select value={freq} onChange={(e) => setFreq(e.target.value)} className="auto">
              <option value="weekly">jede Woche</option>
              <option value="daily">jeden Tag</option>
            </select>
            {freq === 'weekly' && (
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="auto">
                {ORDER.map((d) => <option key={d} value={d}>am {WEEKDAYS[d]}</option>)}
              </select>
            )}
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className="auto">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>um {String(h).padStart(2, '0')}:00 Uhr</option>)}
            </select>
          </div>
        </div>

        {type === 'research' && (
          <label className="field inline">
            <span>Wie viele Ideen ungefähr?</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        {type === 'free' ? (
          <label className="field">
            <span>Was soll Claude tun?</span>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span>Notiz an Claude <em>optional</em></span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. nur Themen der letzten 7 Tage" />
          </label>
        )}
        <p className="muted small">Geplante Aufträge laufen immer im Hintergrund. Wenn einer fertig ist, meldet sich YT Hub mit einer Benachrichtigung.</p>
        {error && <div className="notice error">{error}</div>}
        <div className="dialog-actions">
          {plan.id && <button type="button" className="btn ghost danger push-right-left" onClick={remove}>Löschen</button>}
          <button type="button" className="btn ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn primary" disabled={type === 'free' ? !text.trim() : !channel}>Speichern</button>
        </div>
      </form>
    </div>
  );
}
