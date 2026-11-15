import type { Mode, Profile } from './db'
import { addDays, studyDate, studyDayStart } from './dates'

/**
 * Lernzeit je Wochentag und freie Tage (Einstellungen → Lernplan). Die Schieberegler legen die Lernzeit eines
 * normalen Tags fest; je Wochentag gilt ein Faktor (frei, ½, 1×, 2×, 3×), einzelne Daten lassen sich ganz freinehmen.
 */
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export const FACTORS: { value: number; label: string }[] = [
  { value: 0, label: 'frei' },
  { value: 0.5, label: '½' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
]

type WeekProfile = Pick<Profile, 'minutesMobile' | 'minutesDesk' | 'weekFactors' | 'freeDays'>

/** Wochentag eines Lerntags, 0 = Montag. */
const weekday = (t: number) => (new Date(studyDayStart(t)).getDay() + 6) % 7

/** Faktor für den Lerntag, in den `t` fällt: 0 an freien Tagen. */
export function dayFactor(p: WeekProfile, t: number): number {
  if (p.freeDays?.includes(studyDate(t))) return 0
  const f = p.weekFactors?.[weekday(t)]
  return typeof f === 'number' && f >= 0 ? f : 1
}

/** Faktoren ab heute für `days` Lerntage (Index 0 = heute) – für die Verteilung des neuen Stoffs im Planer. */
export function dayFactors(p: WeekProfile, now: number, days: number): number[] {
  const start = studyDayStart(now) + 12 * 3600_000
  return Array.from({ length: Math.max(1, days) }, (_, i) => dayFactor(p, addDays(start, i)))
}

/** Eingestellte Lernzeit (Minuten) für den Lerntag, in den `t` fällt. */
export const minutesOn = (p: WeekProfile, mode: Mode, t: number) =>
  Math.round((mode === 'mobile' ? p.minutesMobile : p.minutesDesk) * dayFactor(p, t))

/** Kommende freie Tage (ab heute), sortiert. */
export const upcomingFreeDays = (p: WeekProfile, now: number) => [...(p.freeDays ?? [])].filter((d) => d >= studyDate(now)).sort()
