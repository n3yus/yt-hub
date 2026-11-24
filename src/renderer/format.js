const nf = new Intl.NumberFormat('de-DE');

export function compact(n) {
  if (n === null || n === undefined) return '–';
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mrd.`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('de-DE')} Tsd.`;
  return nf.format(n);
}

export function ago(iso) {
  if (!iso) return '–';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'gerade eben';
  const m = s / 60;
  if (m < 60) return `vor ${Math.floor(m)} Min.`;
  const h = m / 60;
  if (h < 24) return `vor ${Math.floor(h)} Std.`;
  const d = h / 24;
  if (d < 2) return 'gestern';
  if (d < 30) return `vor ${Math.floor(d)} Tagen`;
  const mo = d / 30.4;
  if (mo < 12) return `vor ${Math.floor(mo)} ${Math.floor(mo) === 1 ? 'Monat' : 'Monaten'}`;
  const y = Math.floor(d / 365);
  return `vor ${y} ${y === 1 ? 'Jahr' : 'Jahren'}`;
}

export function duration(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function score(x) {
  return `${x.toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`;
}
