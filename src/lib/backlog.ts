import { REQUIRED_MODE, type ExamPlan } from './planner'

/**
 * Karten im Rückstand: Kernstoff, der mit dem heutigen Zeitbudget bis zum Stichtag für neuen Stoff nicht mehr
 * begonnen würde (pro Tag passen weniger neue Karten ins Budget, als nötig wären). 0, wenn die Prüfung im Plan liegt.
 */
export function backlogCards(p: ExamPlan): number {
  if (!p.behind) return 0
  // Der Planer rechnet den Rückstand mit dem Wochenplan; ältere Pläne ohne den Wert gleichmäßig.
  if (typeof p.backlog === 'number') return p.backlog
  const m = p.modes[REQUIRED_MODE]
  const perDay = Math.min(m.quota, m.allowed)
  return Math.max(0, m.coreRemaining + m.newDoneToday - perDay * p.introDeadline)
}

export const backlogLabel = (n: number) => (n === 1 ? '1 Karte Rückstand' : `${n} Karten Rückstand`)
