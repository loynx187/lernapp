import { describe, expect, it } from 'vitest'
import { backlogCards, backlogLabel } from './backlog'
import type { ExamPlan } from './planner'

const plan = (over: Partial<ExamPlan['modes']['mobile']>, behind: boolean, introDeadline = 10): ExamPlan => {
  const m = { newRemaining: 0, coreRemaining: 0, quota: 0, optionalQuota: 0, allowed: 0, newDoneToday: 0, newLeft: 0, reviewsDue: 0, reviewsDoneToday: 0, ...over }
  return { examId: 'e', daysLeft: 20, weight: 2, introDeadline, behind, forecastShare: 0, modes: { mobile: m, desk: { ...m, quota: 0 } } }
}

describe('Rückstand in Karten', () => {
  it('zählt den Kernstoff, der bis zum Stichtag nicht mehr begonnen würde', () => {
    // 100 Karten in 10 Tagen → 10 pro Tag nötig, Budget reicht für 7 → 30 Karten Rückstand
    expect(backlogCards(plan({ coreRemaining: 100, quota: 10, allowed: 7 }, true))).toBe(30)
    // Heute schon begonnene Karten zählen zum Tagespensum
    expect(backlogCards(plan({ coreRemaining: 95, newDoneToday: 5, quota: 10, allowed: 7 }, true))).toBe(30)
    expect(backlogCards(plan({ coreRemaining: 100, quota: 10, allowed: 10 }, false))).toBe(0)
    expect(backlogLabel(1)).toBe('1 Karte Rückstand')
    expect(backlogLabel(14)).toBe('14 Karten Rückstand')
  })
})
