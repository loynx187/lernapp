import type { Snapshot } from '../lib/db'
import { DAY, parseIsoDate } from '../lib/dates'

/**
 * Verlauf bis zur Klausur: Anteil begonnener Karten (Linie) und sicherer Karten (Fläche).
 * Die x-Achse reicht vom ersten Messpunkt bis zum Klausurtag.
 */
export function HistoryChart({ snapshots, examDate, color }: { snapshots: Snapshot[]; examDate: string; color: string }) {
  const pts = [...snapshots].filter((s) => s.total > 0).sort((a, b) => a.date.localeCompare(b.date))
  if (pts.length < 2) return <p className="muted">Der Verlauf erscheint, sobald du an mindestens zwei Tagen gelernt hast.</p>
  const W = 320
  const H = 140
  const pad = { l: 30, r: 8, t: 8, b: 20 }
  const t0 = parseIsoDate(pts[0].date)
  const t1 = Math.max(parseIsoDate(examDate), parseIsoDate(pts[pts.length - 1].date) + DAY)
  const x = (d: string) => pad.l + ((parseIsoDate(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b)
  const line = (key: 'introduced' | 'secure') => pts.map((p) => `${x(p.date).toFixed(1)},${y(p[key] / p.total).toFixed(1)}`).join(' ')
  const area = `${x(pts[0].date)},${y(0)} ${line('secure')} ${x(pts[pts.length - 1].date)},${y(0)}`
  const fmt = (t: number) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Lernverlauf bis zur Klausur">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 4} y={y(v) + 4} textAnchor="end">{v * 100}%</text>
          </g>
        ))}
        <polygon points={area} fill={color} opacity={0.22} />
        <polyline points={line('introduced')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        <line x1={W - pad.r} x2={W - pad.r} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeDasharray="3 3" />
        <text x={pad.l} y={H - 4}>{fmt(t0)}</text>
        <text x={W - pad.r} y={H - 4} textAnchor="end">Klausur {fmt(parseIsoDate(examDate))}</text>
      </svg>
      <figcaption className="row wrap" style={{ gap: 14, fontSize: 13, color: 'var(--muted)' }}>
        <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 3, background: color, display: 'inline-block' }} /> begonnen</span>
        <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 10, background: color, opacity: 0.3, display: 'inline-block' }} /> sicher bis zur Klausur</span>
      </figcaption>
    </figure>
  )
}
