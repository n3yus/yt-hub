import React, { useEffect, useState } from 'react';
import { ago } from '../format.js';
import { go } from '../router.js';

// Kleine Statuszeile in der Seitenleiste – nur sichtbar, wenn der Cloud-Sync eingeschaltet ist.
export default function CloudLine() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    window.ythub.cloudStatus().then(setSt);
    return window.ythub.onCloudStatus(setSt);
  }, []);
  if (!st || !st.enabled) return null;
  let text;
  if (!st.drive.connected) text = 'Drive nicht verbunden';
  else if (st.running) text = `Synchronisiere${st.total ? ` ${st.done}/${st.total}` : ' …'}`;
  else if (st.error || st.drive.error) text = 'Sync-Fehler';
  else if (st.last) text = `Synchronisiert ${ago(st.last.at)}`;
  else text = 'Wartet auf ersten Sync';
  const bad = !st.drive.connected || st.error || st.drive.error;
  return (
    <button className={'cloud-line link' + (bad ? ' err' : '')} onClick={() => go('/settings')} title="Cloud-Sync mit Google Drive">
      ☁ {text}
    </button>
  );
}
