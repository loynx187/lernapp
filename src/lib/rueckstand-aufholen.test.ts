import { describe, expect, it } from 'vitest'
import { buildQueue, planDay, type PlanCard, type PlanInput } from './planner'
import { addDays, isoDate } from './dates'

const NOW = new Date(2026, 10, 22, 9, 0).getTime()
const fresh = (n: number): PlanCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: `a-${i}`, examId: 'a', mode: 'mobile' as const, state: 0, due: NOW, order: i }))
const input = (over: Partial<PlanInput>): PlanInput => ({
  now: NOW, exams: [{ id: 'a', date: isoDate(addDays(NOW, 30)), weight: 2, introBy: isoDate(addDays(NOW, 10)) }], cards: fresh(300), done: [],
  budgetMinutes: { mobile: 10, desk: 0 }, costs: { mobile: { newCard: 60, review: 15 }, desk: { newCard: 900, review: 480 } }, ...over,
})

describe('Rückstand aufholen', () => {
  it('plant ohne Schalter im Budget, mit Schalter das volle Tagesziel', () => {
    const normal = planDay(input({}))
    const p = normal.exams[0]
    expect(p.behind).toBe(true)
    expect(p.modes.mobile.newLeft).toBe(10)

    const catchUp = planDay(input({ fullQuota: true }))
    const q = catchUp.exams[0]
    expect(q.behind).toBe(false)
    expect(q.modes.mobile.newLeft).toBe(q.modes.mobile.quota)
    expect(q.modes.mobile.quota).toBeGreaterThan(10)
    expect(catchUp.modes.mobile.minutesLeft).toBeGreaterThan(10)
    expect(buildQueue(catchUp, fresh(300), { mode: 'mobile', now: NOW })).toHaveLength(q.modes.mobile.quota)
  })
})
