import React, { useEffect, useRef, useState } from 'react';

export default function AddChannelDialog({ onClose, onAdded }) {
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('own');
  const [niche, setNiche] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const first = useRef(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const channel = await window.ythub.addChannel({ input, name, type, niche });
      onAdded(channel);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit}>
        <h2>Kanal hinzufügen</h2>

        <label className="field">
          <span>YouTube-Link oder @Handle</span>
          <input
            ref={first}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.youtube.com/@kanalname"
            required
          />
        </label>

        <div className="field">
          <span>Art</span>
          <div className="segmented">
            <button type="button" className={type === 'own' ? 'on' : ''} onClick={() => setType('own')}>
              <strong>Eigener Kanal</strong>
              <small>Ideen recherchieren und Skripte schreiben</small>
            </button>
            <button type="button" className={type === 'watch' ? 'on' : ''} onClick={() => setType('watch')}>
              <strong>Beobachten</strong>
              <small>Neue Videos verfolgen, Inspiration für die Recherche</small>
            </button>
          </div>
        </div>

        <label className="field">
          <span>Anzeigename <em>optional</em></span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="wird sonst aus dem Link übernommen" />
        </label>

        <label className="field">
          <span>Nische / Kurzbeschreibung <em>optional</em></span>
          <textarea rows={2} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="z. B. Tech-Erklärvideos für Einsteiger" />
        </label>

        {error && <div className="notice error">{error}</div>}

        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn primary" disabled={busy || !input.trim()}>
            {busy ? 'Wird angelegt …' : 'Hinzufügen'}
          </button>
        </div>
      </form>
    </div>
  );
}
