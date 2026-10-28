import type { Mode, ReviewLog } from './db'
import { DAY, studyDate } from './dates'

/** Betrachteter Zeitraum für die gemessene Lernzeit. */
export const BUDGET_WINDOW_DAYS = 14
/** Erst ab so vielen Lerntagen wird das Budget angepasst. */
export const BUDGET_MIN_DAYS = 3

export interface BudgetInfo {
  /** Eingestelltes Budget (Minuten). */
  setting: number
  /** Durchschnittliche tatsächliche Lernzeit an Lerntagen (Minuten), falls genug Daten. */
  measured?: number
  /** Anzahl Lerntage im Zeitraum. */
  days: number
  /** Budget, mit dem geplant wird (Minuten). */
  effective: number
}

/**
 * Gleicht das eingestellte Tagesbudget mit der gemessenen Lernzeit ab: Wer regelmäßig weniger (oder mehr)
 * lernt als eingestellt, bekommt einen Plan, der dazu passt. Angepasst wird vorsichtig – zur Hälfte in
 * Richtung der Messung und höchstens auf die Hälfte bzw. das Anderthalbfache der Einstellung.
 * Gezählt werden nur Tage, an denen in diesem Modus gelernt wurde (heute nicht, der Tag läuft noch).
 */
export function budgetInfo(setting: number, logs: ReviewLog[], mode: Mode, now: number, auto = true): BudgetInfo {
  const today = studyDate(now)
  const cap = mode === 'mobile' ? 5 * 60_000 : 60 * 60_000
  const perDay = new Map<string, number>()
  for (const l of logs) {
    if (l.mode !== mode || l.reviewedAt < now - BUDGET_WINDOW_DAYS * DAY) continue
    const d = studyDate(l.reviewedAt)
    if (d === today) continue
    perDay.set(d, (perDay.get(d) ?? 0) + Math.min(l.durationMs, cap))
  }
  const days = perDay.size
  if (days < BUDGET_MIN_DAYS || setting <= 0) return { setting, days, effective: setting }
  const measured = [...perDay.values()].reduce((a, b) => a + b, 0) / days / 60_000
  if (!auto) return { setting, measured, days, effective: setting }
  const blended = setting + (measured - setting) / 2
  const effective = Math.round(Math.min(setting * 1.5, Math.max(setting * 0.5, blended)))
  return { setting, measured, days, effective }
}
