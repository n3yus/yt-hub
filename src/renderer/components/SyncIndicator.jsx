import React from 'react';
import { ago } from '../format.js';
import { go } from '../router.js';

export default function SyncIndicator({ status, hasKey }) {
  if (!hasKey) {
    return (
      <div className="sync">
        <span className="dot off" />
        <button className="link small" onClick={() => go('/settings')}>YouTube-Key fehlt</button>
      </div>
    );
  }
  if (!status) return null;

  if (status.running) {
    return (
      <div className="sync">
        <span className="dot busy" />
        <div className="sync-text">
          <span>Aktualisiere {status.done + 1}/{status.total}</span>
          {status.current && <span className="muted ellipsis">{status.current}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="sync">
      <span className={'dot' + (status.error ? ' err' : '')} />
      <div className="sync-text">
        <span title={status.error || undefined} className={status.error ? 'err-text ellipsis' : ''}>
          {status.error ? status.error : status.lastRun ? `Aktualisiert ${ago(status.lastRun)}` : 'Noch nicht aktualisiert'}
        </span>
        <button className="link small" onClick={() => window.ythub.syncChannels()}>Jetzt aktualisieren</button>
      </div>
    </div>
  );
}
