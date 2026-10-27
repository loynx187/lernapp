export const DAY = 24 * 60 * 60 * 1000

export function startOfDay(t: number | Date): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(t: number, days: number): number {
  const d = new Date(t)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** YYYY-MM-DD in lokaler Zeit. */
export function isoDate(t: number | Date): string {
  const d = new Date(t)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Beginn (00:00 lokal) eines YYYY-MM-DD-Datums. */
export function parseIsoDate(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Ganze Kalendertage von `from` bis zum Datum `to` (0 = heute). */
export function daysUntil(to: string, from: number = Date.now()): number {
  return Math.round((parseIsoDate(to) - startOfDay(from)) / DAY)
}

export function formatDate(s: string): string {
  return new Date(parseIsoDate(s)).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatCountdown(days: number): string {
  if (days < 0) return 'vorbei'
  if (days === 0) return 'heute'
  if (days === 1) return 'morgen'
  return `in ${days} Tagen`
}

export function formatInterval(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 1) return '<1 min'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(ms / DAY)
  if (d < 31) return `${d} T`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo} Mon`
  return `${(d / 365).toFixed(1)} J`
}
