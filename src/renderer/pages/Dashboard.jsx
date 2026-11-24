import React, { useCallback, useEffect, useState } from 'react';
import AddChannelDialog from '../components/AddChannelDialog.jsx';
import ChannelCard from '../components/ChannelCard.jsx';
import { go } from '../router.js';

export default function Dashboard({ settings, sync }) {
  const [channels, setChannels] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setChannels(await window.ythub.listChannels());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, sync.version]);

  const remove = async (c) => {
    if (!window.confirm(`„${c.name}“ aus dem Hub entfernen?\n\nDer Kanal-Ordner mit Ideen und Skripten wandert in den Papierkorb.`)) return;
    try {
      setChannels(await window.ythub.removeChannel(c.slug));
    } catch (err) {
      setError(err.message);
    }
  };

  const own = (channels || []).filter((c) => c.type === 'own');
  const watched = (channels || []).filter((c) => c.type === 'watch');
  const empty = channels && channels.length === 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Kanäle</h1>
          <p className="muted">Eigene Kanäle für Ideen und Skripte, beobachtete Kanäle als Inspiration.</p>
        </div>
        {!empty && (
          <button className="btn primary" data-test="add-channel" onClick={() => setAdding(true)}>
            <span className="plus">＋</span> Kanal hinzufügen
          </button>
        )}
      </header>

      {!settings.youtubeKey.set && (
        <div className="notice">
          <span>Noch kein YouTube-API-Key eingetragen. Kanäle kannst du trotzdem schon anlegen.</span>
          <button className="btn ghost small" onClick={() => go('/settings')}>Zu den Einstellungen</button>
        </div>
      )}

      {error && <div className="notice error">{error}</div>}

      {empty && (
        <div className="empty">
          <button className="empty-plus" data-test="add-channel" onClick={() => setAdding(true)} aria-label="Kanal hinzufügen">
            ＋
          </button>
          <h2>Noch keine Kanäle</h2>
          <p className="muted">Füge deinen ersten Kanal hinzu – einen eigenen oder einen, den du beobachten möchtest.</p>
          <button className="btn primary" onClick={() => setAdding(true)}>Kanal hinzufügen</button>
        </div>
      )}

      {own.length > 0 && (
        <section>
          <h2 className="section-title">Eigene Kanäle <span className="count">{own.length}</span></h2>
          <div className="grid">
            {own.map((c) => (
              <ChannelCard key={c.slug} channel={c} onRemove={() => remove(c)} syncing={!!sync.status?.running && sync.status.current === c.name} />
            ))}
          </div>
        </section>
      )}

      {watched.length > 0 && (
        <section>
          <h2 className="section-title">Beobachtet <span className="count">{watched.length}</span></h2>
          <div className="grid">
            {watched.map((c) => (
              <ChannelCard key={c.slug} channel={c} onRemove={() => remove(c)} syncing={!!sync.status?.running && sync.status.current === c.name} />
            ))}
          </div>
        </section>
      )}

      {adding && (
        <AddChannelDialog
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}
