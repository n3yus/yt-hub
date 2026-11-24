import React, { useMemo, useRef, useState } from 'react';
import { compact } from '../format.js';

// Tägliche Aufrufe als Linie mit Fläche; eine Serie, eine Achse, Hover mit Fadenkreuz und Tooltip.
export default function ViewsChart({ data, height = 200 }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 800;
  const H = height;
  const pad = { l: 44, r: 12, t: 12, b: 26 };

  const { points, max, ticks } = useMemo(() => {
    const m = Math.max(1, ...data.map((d) => d.views));
    // „Schöne“ Obergrenze für die Achse
    const mag = 10 ** Math.floor(Math.log10(m));
    const nice = Math.ceil(m / mag / 2) * 2 * mag || 1;
    const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, data.length - 1);
    const y = (v) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
    return {
      max: nice,
      ticks: [0, nice / 2, nice].map((v) => ({ v, y: y(v) })),
      points: data.map((d, i) => ({ ...d, x: x(i), y: y(d.views) })),
    };
  }, [data, H]);

  if (!data.length) return <p className="muted small">Keine Daten im Zeitraum.</p>;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${H - pad.b} L${points[0].x.toFixed(1)},${H - pad.b} Z`;
  const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].x - px) < Math.abs(points[best].x - px)) best = i;
    setHover(best);
  };
  const h = hover != null ? points[hover] : null;

  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="chart" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Aufrufe pro Tag">
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} className="grid" />
            <text x={pad.l - 8} y={t.y + 4} className="axis" textAnchor="end">{compact(t.v)}</text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={points[i].x} y={H - 6} className="axis" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{fmtDay(points[i].day)}</text>
        ))}
        <path d={area} className="area" />
        <path d={line} className="line" />
        {h && (
          <g>
            <line x1={h.x} x2={h.x} y1={pad.t} y2={H - pad.b} className="crosshair" />
            <circle cx={h.x} cy={h.y} r="5" className="dot" />
          </g>
        )}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: `${(h.x / W) * 100}%` }}>
          <strong>{h.views.toLocaleString('de-DE')} Aufrufe</strong>
          <span>{new Date(h.day + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}</span>
          <span className="muted">{h.subscribersGained - h.subscribersLost >= 0 ? '+' : ''}{h.subscribersGained - h.subscribersLost} Abos · {Math.round(h.watchMinutes / 60)} Std. Wiedergabe</span>
        </div>
      )}
    </div>
  );
}
