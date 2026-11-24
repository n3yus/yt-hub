// Öffnet den Auftrag-Dialog von überall aus, z. B. openJobDialog({ type: 'research', channel: 'slug' }).
export function openJobDialog(preset = {}) {
  window.dispatchEvent(new CustomEvent('ythub:new-job', { detail: preset }));
}

export const JOB_TYPES = [
  { id: 'research', label: 'Ideen recherchieren', icon: '💡', needsOwn: true, hint: 'Claude sucht neue Videoideen – mit Websuche und den Ausreißern deiner beobachteten Kanäle.' },
  { id: 'from-video', label: 'Idee aus Video', icon: '🔥', needsOwn: true, hint: 'Claude überträgt, was ein erfolgreiches Video ausmacht, auf deinen Kanal.' },
  { id: 'script', label: 'Skript schreiben', icon: '📝', needsOwn: true, hint: 'Claude schreibt aus einer Idee ein fertiges Skript im Stil deines Kanals.' },
  { id: 'profile', label: 'Kanal-Profil', icon: '🪪', needsOwn: false, hint: 'Claude leitet Nische, Zielgruppe, Ton und Stilregeln aus den Videos des Kanals ab.' },
  { id: 'free', label: 'Freier Auftrag', icon: '✳️', needsOwn: false, hint: 'Beschreibe selbst, was Claude im Datenordner tun soll.' },
];

export const STATUS = {
  wartet: { label: 'wartet', cls: '' },
  'läuft': { label: 'läuft', cls: 'busy' },
  'im Terminal': { label: 'im Terminal', cls: 'busy' },
  fertig: { label: 'fertig', cls: 'ok' },
  fehler: { label: 'Fehler', cls: 'err' },
  abgebrochen: { label: 'abgebrochen', cls: 'warn' },
};
