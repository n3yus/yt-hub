import React, { useEffect, useState } from 'react';
import Markdown, { stripFrontmatter } from '../markdown.jsx';

// Zeigt eine Markdown-Datei des Kanals an und erlaubt, sie direkt zu bearbeiten.
export default function DocPanel({ slug, rel, title, empty, action, dataVersion }) {
  const [doc, setDoc] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editing) window.ythub.readDoc(slug, rel).then(setDoc);
  }, [slug, rel, dataVersion, editing]);

  const save = async () => {
    try {
      setDoc(await window.ythub.writeDoc(slug, rel, draft));
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!doc) return null;
  const blank = !doc.exists || !stripFrontmatter(doc.text).trim();

  return (
    <section className="panel doc">
      <div className="panel-head">
        <h2>{title}</h2>
        <div className="row tight">
          {!editing && action}
          {!editing && (
            <button className="btn ghost small" onClick={() => { setDraft(doc.text); setEditing(true); }}>Bearbeiten</button>
          )}
          {editing && <button className="btn ghost small" onClick={() => setEditing(false)}>Abbrechen</button>}
          {editing && <button className="btn primary small" onClick={save}>Speichern</button>}
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}
      {editing ? (
        <textarea className="editor" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck />
      ) : blank ? (
        <p className="muted">{empty}</p>
      ) : (
        <Markdown text={doc.text} />
      )}
    </section>
  );
}
