import React, { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { go, hashQuery } from '../router.js';
import { ago } from '../format.js';
import { renderMarkdown, onMarkdownClick, stripFrontmatter } from '../markdown.jsx';
import { SCRIPT_STATUS } from '../components/ScriptList.jsx';

const WPM = 150;

// Nur der Sprechtext zählt: Abschnitt „## Skript“ ohne Überschriften und [Regie-Hinweise].
export function spokenStats(body) {
  const m = /^##\s+Skript\s*$([\s\S]*?)(?=^##\s(?!#)|$(?![\s\S]))/m.exec(body);
  const part = m ? m[1] : body;
  const text = part
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join(' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[*_`>|-]/g, ' ');
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  return { words, minutes: words / WPM, fromSection: !!m };
}

const fmtMin = (m) => {
  const total = Math.round(m * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} Min.`;
};
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export default function ScriptView({ slug, settings, jobs }) {
  const file = useMemo(() => hashQuery().file, []);
  const [doc, setDoc] = useState(null);
  const [comments, setComments] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [commentAt, setCommentAt] = useState(null); // Block-Index mit offenem Kommentarfeld
  const [commentText, setCommentText] = useState('');
  const [note, setNote] = useState('');
  const [viewVersion, setViewVersion] = useState(null);
  const [versionDoc, setVersionDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState(null);

  const runningJob = jobs.find((j) => j.type === 'revise' && ['wartet', 'läuft', 'im Terminal'].includes(j.status) && j.channel?.slug === slug && j.ref === file);
  const lastDone = jobs.filter((j) => j.status === 'fertig').length;

  const load = async () => {
    setDoc(await window.ythub.readDoc(slug, file));
    setComments(await window.ythub.getComments(slug, file));
    const list = await window.ythub.scripts(slug);
    setVersions(list.find((s) => s.file === file)?.versions || []);
  };
  useEffect(() => { if (file && !editing) load(); }, [slug, file, lastDone]);
  useEffect(() => {
    if (viewVersion) window.ythub.readDoc(slug, viewVersion).then(setVersionDoc);
    else setVersionDoc(null);
  }, [viewVersion]);

  const shown = versionDoc || doc;
  const body = shown ? stripFrontmatter(shown.text) : '';
  const blocks = useMemo(() => {
    const tokens = marked.lexer(body);
    return tokens
      .filter((t) => t.type !== 'space')
      .map((t) => ({ raw: t.raw, type: t.type, html: renderMarkdown(t.raw) }));
  }, [body]);
  const stats = useMemo(() => spokenStats(body), [body]);

  if (!file) return null;
  if (!doc) return null;
  if (!doc.exists) {
    return (
      <div className="page">
        <p className="muted">Dieses Skript gibt es nicht mehr.</p>
        <button className="btn" onClick={() => go(`/kanal/${slug}?tab=skripte`)}>Zu den Skripten</button>
      </div>
    );
  }

  const open = comments.filter((c) => !c.sentInJob);
  const sent = comments.filter((c) => c.sentInJob);
  const commentsFor = (b) => comments.filter((c) => norm(c.quote) && norm(b.raw).includes(norm(c.quote).slice(0, 120)));
  const status = doc.fm.status || 'entwurf';
  const readOnly = !!versionDoc;

  const saveComments = async (list) => setComments(await window.ythub.setComments(slug, file, list));
  const addComment = async (block) => {
    if (!commentText.trim()) return;
    await saveComments([...comments, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, quote: block.raw.trim().slice(0, 400), text: commentText.trim() }]);
    setCommentText('');
    setCommentAt(null);
  };
  const removeComment = (id) => saveComments(comments.filter((c) => c.id !== id));
  const clearSent = () => saveComments(open);

  const setStatus = async (s) => setDoc(await window.ythub.setDocStatus(slug, file, s));
  const save = async () => {
    try {
      setDoc(await window.ythub.writeDoc(slug, file, draft));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  };
  const revise = async () => {
    try {
      await window.ythub.createJob({
        type: 'revise',
        channel: slug,
        script: file,
        comments: open,
        note,
        mode: settings.claudeLaunchMode,
        title: `Überarbeiten: ${doc.fm.titel || file}`,
      });
      setNote('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page wide script-page">
      <button className="back" onClick={() => go(`/kanal/${slug}?tab=skripte`)}>← Skripte</button>
      <div className="script-layout">
        <div className="script-doc">
          {readOnly && (
            <div className="notice">
              <span>Du siehst eine ältere Fassung ({viewVersion.replace(/^.*-v(\d+)\.md$/, 'Version $1')}).</span>
              <button className="btn ghost small" onClick={() => setViewVersion(null)}>Zur aktuellen Fassung</button>
            </div>
          )}
          {runningJob && (
            <div className="notice busy-notice">
              <span className="spinner" /> <span>Claude überarbeitet dieses Skript gerade …</span>
              <button className="btn ghost small" onClick={() => go(`/auftraege?job=${runningJob.id}`)}>Fortschritt</button>
            </div>
          )}
          {error && <div className="notice error">{error}</div>}

          {editing ? (
            <textarea className="editor tall" value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <div className="md script-md" onClick={onMarkdownClick}>
              {blocks.map((b, i) => {
                const own = commentsFor(b);
                const commentable = !readOnly && b.type !== 'hr';
                return (
                  <div key={i} className={'block' + (own.length ? ' has-comments' : '') + (commentAt === i ? ' commenting' : '')}>
                    <div dangerouslySetInnerHTML={{ __html: b.html }} />
                    {commentable && (
                      <button className="comment-btn" title="Kommentar zu dieser Stelle" onClick={(e) => { e.stopPropagation(); setCommentAt(i); setCommentText(''); }}>
                        💬{own.length ? ` ${own.length}` : ''}
                      </button>
                    )}
                    {commentAt === i && (
                      <div className="comment-form" onClick={(e) => e.stopPropagation()}>
                        <textarea autoFocus rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Was soll Claude hier ändern? z. B. „Hook knackiger, max. 2 Sätze“"
                          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment(b); if (e.key === 'Escape') setCommentAt(null); }} />
                        <div className="row tight end">
                          <button className="btn ghost small" onClick={() => setCommentAt(null)}>Abbrechen</button>
                          <button className="btn primary small" disabled={!commentText.trim()} onClick={() => addComment(b)}>Kommentar speichern</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="script-side">
          <section className="panel">
            <div className="stat-grid">
              <div><strong>{stats.words.toLocaleString('de-DE')}</strong><span>Wörter Sprechtext</span></div>
              <div><strong>{fmtMin(stats.minutes)}</strong><span>bei {WPM} Wörtern/Min.</span></div>
            </div>
            {!stats.fromSection && <p className="muted small">Kein Abschnitt „## Skript“ gefunden – gezählt wird der ganze Text.</p>}
            <label className="field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={readOnly}>
                {Object.entries(SCRIPT_STATUS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Fassung</span>
              <select value={viewVersion || ''} onChange={(e) => setViewVersion(e.target.value || null)}>
                <option value="">Aktuell (Version {doc.fm.version || 1})</option>
                {versions.slice().reverse().map((v) => <option key={v} value={v}>{v.replace(/^.*-v(\d+)\.md$/, 'Version $1')}</option>)}
              </select>
            </label>
            <div className="row tight">
              {!editing && !readOnly && <button className="btn ghost small" onClick={() => { setDraft(doc.text); setEditing(true); }}>Bearbeiten</button>}
              {editing && <button className="btn ghost small" onClick={() => setEditing(false)}>Abbrechen</button>}
              {editing && <button className="btn primary small" onClick={save}>Speichern</button>}
              <button className="btn ghost small" onClick={() => window.ythub.openDoc(slug, file)}>Datei öffnen</button>
            </div>
            <p className="muted small">Geändert {ago(doc.updated)}</p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Kommentare</h2>
              <span className="count">{open.length}</span>
            </div>
            {open.length === 0 && <p className="muted small">Fahr über einen Absatz und klick auf 💬, um Claude zu sagen, was sich ändern soll.</p>}
            {open.map((c) => (
              <div key={c.id} className="comment">
                <blockquote>{norm(c.quote).slice(0, 120)}{norm(c.quote).length > 120 ? '…' : ''}</blockquote>
                <p>{c.text}</p>
                <button className="link small danger" onClick={() => removeComment(c.id)}>entfernen</button>
              </div>
            ))}
            <label className="field">
              <span>Allgemeine Notiz <em>optional</em></span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. insgesamt 20 % kürzer" />
            </label>
            <button className="btn primary full" disabled={(!open.length && !note.trim()) || !!runningJob || readOnly} onClick={revise}>
              ✨ Von Claude überarbeiten lassen
            </button>

            {sent.length > 0 && (
              <div className="sent-comments">
                <div className="row tight between">
                  <span className="muted small">{sent.length} an Claude geschickt</span>
                  <button className="link small" onClick={clearSent}>aufräumen</button>
                </div>
                {sent.map((c) => <p key={c.id} className="muted small sent">✓ {c.text}</p>)}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
