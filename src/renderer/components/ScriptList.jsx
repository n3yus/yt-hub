import React, { useEffect, useState } from 'react';
import { go } from '../router.js';
import { ago } from '../format.js';
import { openJobDialog } from '../jobDialog.js';

export const SCRIPT_STATUS = {
  entwurf: { label: 'Entwurf', cls: '' },
  ueberarbeitung: { label: 'In Überarbeitung', cls: 'busy' },
  fertig: { label: 'Fertig', cls: 'ok' },
};

export default function ScriptList({ slug, dataVersion }) {
  const [list, setList] = useState(null);
  useEffect(() => { window.ythub.scripts(slug).then(setList); }, [slug, dataVersion]);
  if (!list) return null;

  if (!list.length) {
    return (
      <div className="empty small-empty">
        <h2>Noch keine Skripte</h2>
        <p className="muted">Wähle eine Idee aus dem Board und lass Claude ein Skript daraus schreiben.</p>
        <button className="btn primary" onClick={() => openJobDialog({ type: 'script', channel: slug })}>📝 Skript schreiben lassen</button>
      </div>
    );
  }

  return (
    <div className="script-list">
      {list.map((s) => {
        const st = SCRIPT_STATUS[s.status] || SCRIPT_STATUS.entwurf;
        return (
          <button key={s.file} className="script-row" onClick={() => go(`/kanal/${slug}/skript?file=${encodeURIComponent(s.file)}`)}>
            <span className="script-icon">📝</span>
            <span className="script-main">
              <strong>{s.title}</strong>
              <span className="muted small">
                {s.minutes ? `ca. ${s.minutes} Min.` : ''}{s.words ? ` · ${s.words} Wörter` : ''} · Version {s.version} · geändert {ago(s.updated)}
              </span>
            </span>
            {s.openComments > 0 && <span className="pill">{s.openComments} offene Kommentare</span>}
            <span className={'pill ' + st.cls}>{st.label}</span>
          </button>
        );
      })}
    </div>
  );
}
