import { REQUIRED_MODE, type ExamPlan } from './planner'

/**
 * Karten im Rückstand: Abstand zum heutigen Sollstand – so viele neue Kernstoff-Karten wären heute dran (Tagesquote),
 * passen aber nicht mehr ins Zeitbudget. Nicht die Hochrechnung bis zum Stichtag. 0, wenn die Prüfung im Plan liegt.
 */
export function backlogCards(p: ExamPlan): number {
  if (!p.behind) return 0
  if (typeof p.backlog === 'number') return p.backlog
  const m = p.modes[REQUIRED_MODE]
  return Math.max(0, m.quota - m.allowed)
}

export const backlogLabel = (n: number) => (n === 1 ? '1 Karte Rückstand' : `${n} Karten Rückstand`)
