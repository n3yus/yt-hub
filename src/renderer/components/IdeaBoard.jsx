import React, { useCallback, useEffect, useState } from 'react';
import { openJobDialog } from '../jobDialog.js';
import { go } from '../router.js';
import Markdown from '../markdown.jsx';

export const IDEA_COLUMNS = [
  { id: 'neu', label: 'Neu' },
  { id: 'favorit', label: '⭐ Favorit' },
  { id: 'in-arbeit', label: 'In Arbeit' },
  { id: 'produziert', label: 'Produziert' },
  { id: 'veroeffentlicht', label: 'Veröffentlicht' },
];
const ALL_STATUS = [...IDEA_COLUMNS, { id: 'verworfen', label: 'Verworfen' }];

const scoreCls = (s) => (s >= 4 ? 'hi' : s >= 3.3 ? 'mid' : 'lo');
const fmtScore = (s) => String(s).replace('.', ',');

export default function IdeaBoard({ slug, own, dataVersion }) {
  const [ideas, setIdeas] = useState(null);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => window.ythub.ideas(slug).then(setIdeas), [slug]);
  useEffect(() => { load(); }, [load, dataVersion]);

  const move = async (file, status) => {
    setIdeas((list) => list.map((i) => (i.file === file ? { ...i, status } : i)));
    try {
      await window.ythub.setDocStatus(slug, file, status);
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  if (!ideas) return null;
  const columns = showDiscarded ? ALL_STATUS : IDEA_COLUMNS;
  const discarded = ideas.filter((i) => i.status === 'verworfen').length;

  return (
    <div>
      <div className="board-bar">
        <span className="muted small">Karten zwischen den Spalten ziehen, um den Status zu ändern.</span>
        <div className="row tight">
          {discarded > 0 && (
            <button className="btn ghost small" onClick={() => setShowDiscarded((s) => !s)}>
              {showDiscarded ? 'Verworfene ausblenden' : `Verworfene zeigen (${discarded})`}
            </button>
          )}
          <button className="btn ghost small" onClick={() => setAdding(true)}>＋ Eigene Idee</button>
          {own && <button className="btn small" onClick={() => openJobDialog({ type: 'research', channel: slug })}>💡 Ideen recherchieren</button>}
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}

      {ideas.length === 0 ? (
        <div className="empty small-empty">
          <h2>Noch keine Ideen</h2>
          <p className="muted">Lass Claude recherchieren oder trag eine eigene Idee ein.</p>
          <div className="row center-row">
            {own && <button className="btn primary" onClick={() => openJobDialog({ type: 'research', channel: slug })}>💡 Ideen recherchieren</button>}
            <button className="btn" onClick={() => setAdding(true)}>＋ Eigene Idee</button>
          </div>
        </div>
      ) : (
        <div className="board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(175px, 1fr))` }}>
          {columns.map((col) => {
            const items = ideas.filter((i) => i.status === col.id);
            return (
              <div
                key={col.id}
                className={'column' + (dragOver === col.id ? ' over' : '')}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
                onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const file = e.dataTransfer.getData('text/plain');
                  if (file) move(file, col.id);
                }}
              >
                <div className="column-head">
                  <span>{col.label}</span>
                  <span className="count">{items.length}</span>
                </div>
                {items.map((i) => (
                  <article
                    key={i.file}
                    className="idea"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', i.file)}
                    onClick={() => setOpen(i.file)}
                  >
                    <div className="idea-top">
                      {i.score != null && <span className={'score-chip ' + scoreCls(i.score)} title="Gesamtwert (1–5)">{fmtScore(i.score)}</span>}
                      {i.format === 'short' && <span className="mini-tag">Short</span>}
                      {i.script && <span className="mini-tag ok" title="Skript vorhanden">📝 Skript</span>}
                    </div>
                    <h4>{i.title}</h4>
                    {i.hook && <p className="idea-hook">{i.hook}</p>}
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {open && <IdeaDrawer slug={slug} own={own} file={open} onClose={() => setOpen(null)} onChanged={load} />}
      {adding && <NewIdeaDialog slug={slug} onClose={() => setAdding(false)} onCreated={(file) => { setAdding(false); load(); setOpen(file); }} />}
    </div>
  );
}

function IdeaDrawer({ slug, own, file, onClose, onChanged }) {
  const [doc, setDoc] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const load = () => window.ythub.readDoc(slug, file).then(setDoc);
  useEffect(() => {
    load();
    const onKey = (e) => e.key === 'Escape' && !editing && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, editing]);

  if (!doc) return null;
  const status = doc.fm.status || 'neu';
  const script = doc.fm.skript;

  const setStatus = async (s) => { setDoc(await window.ythub.setDocStatus(slug, file, s)); onChanged(); };
  const save = async () => { setDoc(await window.ythub.writeDoc(slug, file, draft)); setEditing(false); onChanged(); };
  const remove = async () => {
    if (!window.confirm('Diese Idee löschen? Die Datei wandert in den Papierkorb.')) return;
    await window.ythub.trashDoc(slug, file);
    onChanged();
    onClose();
  };

  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <div className="drawer-head">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="status-select">
            {ALL_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {doc.fm.gesamt && <span className={'score-chip ' + scoreCls(Number(doc.fm.gesamt))}>{fmtScore(doc.fm.gesamt)}</span>}
          <button className="icon-btn push-right" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <div className="row">
          {own && !script && (
            <button className="btn primary small" onClick={() => { onClose(); openJobDialog({ type: 'script', channel: slug, idea: file }); }}>📝 Skript schreiben lassen</button>
          )}
          {script && (
            <button className="btn primary small" onClick={() => go(`/kanal/${slug}/skript?file=${encodeURIComponent(script)}`)}>📝 Skript öffnen</button>
          )}
          {!editing && <button className="btn ghost small" onClick={() => { setDraft(doc.text); setEditing(true); }}>Bearbeiten</button>}
          {editing && <button className="btn ghost small" onClick={() => setEditing(false)}>Abbrechen</button>}
          {editing && <button className="btn primary small" onClick={save}>Speichern</button>}
          <button className="btn ghost small" onClick={() => window.ythub.openDoc(slug, file)}>Datei öffnen</button>
          <button className="btn ghost small danger" onClick={remove}>Löschen</button>
        </div>

        {editing ? <textarea className="editor tall" value={draft} onChange={(e) => setDraft(e.target.value)} /> : <Markdown text={doc.text} />}
      </aside>
    </div>
  );
}

function NewIdeaDialog({ slug, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('lang');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await window.ythub.createIdea(slug, { title, format, notes });
      onCreated(res.file);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit}>
        <h2>Eigene Idee</h2>
        <label className="field">
          <span>Arbeitstitel</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Ich teste 5 KI-Tools eine Woche lang" />
        </label>
        <div className="field">
          <span>Format</span>
          <div className="chips fit">
            <button type="button" className={'chip' + (format === 'lang' ? ' on' : '')} onClick={() => setFormat('lang')}>Langes Video</button>
            <button type="button" className={'chip' + (format === 'short' ? ' on' : '')} onClick={() => setFormat('short')}>Short</button>
          </div>
        </div>
        <label className="field">
          <span>Notizen <em>optional</em></span>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <div className="notice error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>Anlegen</button>
        </div>
      </form>
    </div>
  );
}
