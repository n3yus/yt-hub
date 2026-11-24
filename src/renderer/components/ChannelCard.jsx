import React, { useState } from 'react';
import { ago, compact } from '../format.js';
import { go } from '../router.js';
import { openJobDialog } from '../jobDialog.js';

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function ChannelCard({ channel, onRemove, syncing }) {
  const [menu, setMenu] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const own = channel.type === 'own';
  const s = channel.stats;

  return (
    <article
      className={'card clickable' + (syncing ? ' syncing' : '')}
      onClick={(e) => {
        if (e.target.closest('button, a, .menu')) return; // Knöpfe auf der Karte behalten ihre eigene Aktion
        go(`/kanal/${channel.slug}`);
      }}
    >
      <div className="card-top">
        {channel.thumbnail && imgOk ? (
          <img className="avatar img" src={channel.thumbnail} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        ) : (
          <div className={'avatar' + (own ? ' own' : '')}>{initials(channel.name)}</div>
        )}
        <div className="card-title">
          <h3 title={channel.name}>{channel.name}</h3>
          <button className="link" onClick={() => window.ythub.openExternal(channel.url)} title={channel.url}>
            {channel.handle || (channel.source.kind === 'handle' ? channel.source.value : channel.url.replace('https://www.', ''))}
          </button>
        </div>
        <div className="menu-wrap">
          <button className="icon-btn" aria-label="Mehr" onClick={() => setMenu((m) => !m)}>⋯</button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              {own && <button onClick={() => { setMenu(false); openJobDialog({ type: 'research', channel: channel.slug }); }}>💡 Ideen recherchieren …</button>}
              {own && <button onClick={() => { setMenu(false); openJobDialog({ type: 'script', channel: channel.slug }); }}>📝 Skript schreiben …</button>}
              <button onClick={() => { setMenu(false); openJobDialog({ type: 'profile', channel: channel.slug }); }}>🪪 Kanal-Profil entwerfen …</button>
              <div className="menu-sep" />
              <button onClick={() => { setMenu(false); window.ythub.syncChannels([channel.slug]); }}>Jetzt aktualisieren</button>
              <button onClick={() => { setMenu(false); window.ythub.openChannelFolder(channel.slug); }}>Ordner öffnen</button>
              <button onClick={() => { setMenu(false); window.ythub.openExternal(channel.url); }}>Auf YouTube ansehen</button>
              <button className="danger" onClick={() => { setMenu(false); onRemove(); }}>Entfernen …</button>
            </div>
          )}
        </div>
      </div>

      {channel.niche && <p className="niche">{channel.niche}</p>}

      {s ? (
        <div className="metrics">
          <div><strong>{compact(s.subscribers)}</strong><span>Abos</span></div>
          <div><strong>{compact(s.videos)}</strong><span>Videos</span></div>
          <div><strong>{channel.lastUpload ? ago(channel.lastUpload).replace('vor ', '') : '–'}</strong><span>letzter Upload</span></div>
        </div>
      ) : (
        <p className="muted small">{syncing ? 'Hole Daten von YouTube …' : 'Noch keine YouTube-Daten.'}</p>
      )}

      {channel.lastSyncError && <p className="err-text small">⚠ {channel.lastSyncError}</p>}

      <div className="card-stats">
        <span className={'tag' + (own ? ' own' : '')}>{own ? 'Eigener Kanal' : 'Beobachtet'}</span>
        {own ? (
          <>
            <span className="stat">{channel.counts.ideas} Ideen</span>
            <span className="stat">{channel.counts.scripts} Skripte</span>
          </>
        ) : (
          channel.counts.outliers30d > 0 && (
            <button className="stat hot" onClick={() => go(`/feed?channel=${channel.slug}&outliers=1`)}>
              🔥 {channel.counts.outliers30d} Ausreißer (30 Tage)
            </button>
          )
        )}
      </div>

      {own && (
        <div className="card-actions">
          <button className="btn small" onClick={() => openJobDialog({ type: 'research', channel: channel.slug })}>💡 Ideen recherchieren</button>
          <button className="btn small ghost" onClick={() => openJobDialog({ type: 'script', channel: channel.slug })}>📝 Skript</button>
        </div>
      )}
    </article>
  );
}
