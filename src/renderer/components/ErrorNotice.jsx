import React from 'react';

// Zeigt eine Fehlermeldung. Endet sie mit einem Link zur Google Cloud Console
// (z. B. „API noch nicht aktiviert“), wird daraus ein Knopf statt eines langen Links.
export default function ErrorNotice({ text, className = 'notice error' }) {
  if (!text) return null;
  const m = /(https:\/\/console\.(?:developers|cloud)\.google\.com\/\S+)\s*$/.exec(text);
  const url = m ? m[1] : null;
  const message = url ? text.slice(0, m.index).trim() : text;
  return (
    <div className={className}>
      <span>{message}</span>
      {url && (
        <button className="btn small" onClick={() => window.ythub.openExternal(url)}>
          API aktivieren ↗
        </button>
      )}
    </div>
  );
}
