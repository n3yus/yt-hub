import React, { useEffect, useState } from 'react';
import { JOB_TYPES } from '../jobDialog.js';
import { compact, score } from '../format.js';
import { go } from '../router.js';

export default function NewJobDialog({ preset, settings, onClose }) {
  const [type, setType] = useState(preset.type || 'research');
  const [channels, setChannels] = useState([]);
  const [channel, setChannel] = useState(preset.channel || '');
  const [ideas, setIdeas] = useState(null);
  const [idea, setIdea] = useState(preset.idea || '');
  const [minutes, setMinutes] = useState('');
  const [count, setCount] = useState(5);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState(settings.claudeLaunchMode || 'background');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const video = preset.video || null;

  const t = JOB_TYPES.find((x) => x.id === type);
  const options = channels.filter((c) => !t.needsOwn || c.type === 'own');

  useEffect(() => {
    window.ythub.listChannels().then(setChannels);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Passenden Kanal vorwählen, wenn der aktuelle nicht zum Auftragstyp passt.
  useEffect(() => {
    if (!channels.length) return;
    if (!options.find((c) => c.slug === channel)) setChannel(options[0]?.slug || '');
  }, [type, channels]);

  useEffect(() => {
    if (type !== 'script' || !channel) return;
    setIdeas(null);
    window.ythub.listIdeas(channel).then((list) => {
      setIdeas(list);
      if (!list.find((i) => i.file === idea)) setIdea(list[0]?.file || '');
    });
  }, [type, channel]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const job = await window.ythub.createJob({
        type,
        channel: channel || null,
        idea,
        minutes: minutes ? Number(minutes) : null,
        count,
        text,
        note,
        mode,
        video,
        title: type === 'from-video' && video ? `Idee aus „${video.title.slice(0, 40)}“` : type === 'script' ? `Skript: ${(ideas || []).find((i) => i.file === idea)?.title || ''}` : undefined,
      });
      onClose();
      go(`/auftraege?job=${job.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const types = video ? JOB_TYPES.filter((x) => x.id === 'from-video') : JOB_TYPES.filter((x) => x.id !== 'from-video');
  const canSubmit =
    !busy && (type === 'free' ? text.trim() : channel) && (type !== 'script' || idea);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog wide" onSubmit={submit}>
        <h2>Auftrag an Claude Code</h2>

        {types.length > 1 && (
          <div className="type-grid">
            {types.map((x) => (
              <button type="button" key={x.id} className={'type-btn' + (type === x.id ? ' on' : '')} onClick={() => setType(x.id)}>
                <span className="type-icon">{x.icon}</span>
                <span>{x.label}</span>
              </button>
            ))}
          </div>
        )}
        <p className="muted small">{t.hint}</p>

        {video && (
          <div className="video-ref">
            {video.thumbnail && <img src={video.thumbnail} alt="" referrerPolicy="no-referrer" />}
            <div>
              <strong>{video.title}</strong>
              <div className="muted small">
                {video.channelName} · {compact(video.views)} Aufrufe{video.score ? ` · 🔥 ${score(video.score)}` : ''}
              </div>
            </div>
          </div>
        )}

        <label className="field">
          <span>{type === 'from-video' ? 'Für welchen eigenen Kanal?' : 'Kanal'}{type === 'free' && <em>optional</em>}</span>
          {options.length ? (
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {type === 'free' && <option value="">– kein bestimmter Kanal –</option>}
              {options.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} {c.type === 'own' ? '' : '(beobachtet)'}
                </option>
              ))}
            </select>
          ) : (
            <div className="notice">
              <span>{t.needsOwn ? 'Dafür brauchst du zuerst einen eigenen Kanal.' : 'Noch keine Kanäle angelegt.'}</span>
              <button type="button" className="btn ghost small" onClick={() => { onClose(); go('/'); }}>Kanal hinzufügen</button>
            </div>
          )}
        </label>

        {type === 'research' && (
          <label className="field inline">
            <span>Wie viele Ideen ungefähr?</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}

        {type === 'script' && channel && (
          <>
            <label className="field">
              <span>Idee</span>
              {ideas === null ? (
                <span className="muted small">Lade Ideen …</span>
              ) : ideas.length ? (
                <select value={idea} onChange={(e) => setIdea(e.target.value)}>
                  {ideas.map((i) => (
                    <option key={i.file} value={i.file}>
                      {i.title}{i.score ? ` (${String(i.score).replace('.', ',')})` : ''}{i.status !== 'neu' ? ` – ${i.status}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="notice">
                  <span>Für diesen Kanal gibt es noch keine Ideen.</span>
                  <button type="button" className="btn ghost small" onClick={() => setType('research')}>Erst Ideen recherchieren</button>
                </div>
              )}
            </label>
            <label className="field inline">
              <span>Ziel-Länge in Minuten <em>optional</em></span>
              <input type="number" min="1" max="60" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="automatisch" />
            </label>
          </>
        )}

        {type === 'free' && (
          <label className="field">
            <span>Was soll Claude tun?</span>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Vergleiche die Titel meiner Top-10-Videos mit denen von Kanal X und schreibe Verbesserungsvorschläge in research/." />
          </label>
        )}

        {type !== 'free' && (
          <label className="field">
            <span>Notiz an Claude <em>optional</em></span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Fokus auf Shorts, lockerer Ton, Thema KI-Tools" />
          </label>
        )}

        <div className="field">
          <span>Wie soll Claude arbeiten?</span>
          <div className="segmented">
            <button type="button" className={mode === 'background' ? 'on' : ''} onClick={() => setMode('background')}>
              <strong>Im Hintergrund</strong>
              <small>Fortschritt erscheint unter „Aufträge“</small>
            </button>
            <button type="button" className={mode === 'terminal' ? 'on' : ''} onClick={() => setMode('terminal')}>
              <strong>In Claude Code öffnen</strong>
              <small>Terminal öffnet sich, du kannst mitreden</small>
            </button>
          </div>
        </div>

        {error && <div className="notice error">{error}</div>}

        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn primary" disabled={!canSubmit}>
            {busy ? 'Wird gesendet …' : 'Auftrag senden'}
          </button>
        </div>
      </form>
    </div>
  );
}
