import { describe, expect, it } from 'vitest'
import { buildQueue, distribute, introductionDays, planDay, type PlanCard, type PlanInput } from './planner'
import { addDays, isoDate } from './dates'

const NOW = new Date(2026, 9, 27, 9, 0).getTime()
const examIn = (days: number) => isoDate(addDays(NOW, days))

function cards(examId: string, n: number, mode: 'mobile' | 'desk' = 'mobile', state = 0): PlanCard[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${examId}-${mode}-${state}-${i}`, examId, mode, state, due: NOW - 1000, order: i }))
}

function input(over: Partial<PlanInput>): PlanInput {
  return {
    now: NOW,
    exams: [],
    cards: [],
    done: [],
    budgetMinutes: { mobile: 30, desk: 30 },
    costs: { mobile: { newCard: 60, review: 15 }, desk: { newCard: 900, review: 480 } },
    ...over,
  }
}

describe('introductionDays', () => {
  it('lässt vor der Klausur einen Wiederholungspuffer', () => {
    expect(introductionDays(1)).toBe(1)
    expect(introductionDays(3)).toBe(2)
    expect(introductionDays(10)).toBe(8)
    expect(introductionDays(30)).toBe(24)
    expect(introductionDays(100)).toBe(90)
  })
})

describe('distribute', () => {
  it('erfüllt alle Bedarfe, wenn das Budget reicht', () => {
    expect(distribute(100, [{ cost: 30, weight: 1 }, { cost: 50, weight: 3 }])).toEqual([30, 50])
  })
  it('verteilt knappes Budget nach Gewicht und gibt Überschuss weiter', () => {
    const [a, b] = distribute(60, [{ cost: 10, weight: 1 }, { cost: 100, weight: 1 }])
    expect(a).toBeCloseTo(10)
    expect(b).toBeCloseTo(50)
  })
})

describe('planDay', () => {
  it('verteilt neuen Stoff gleichmäßig bis zum Ende der Einführungsphase', () => {
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(30), weight: 2 }], cards: cards('a', 240) }))
    const m = plan.exams[0].modes.mobile
    expect(m.quota).toBe(10) // 240 Karten / 24 Tage
    expect(m.newLeft).toBe(10)
    expect(plan.exams[0].behind).toBe(false)
  })

  it('zählt heute schon gelernte neue Karten gegen die Quote', () => {
    const plan = planDay(
      input({
        exams: [{ id: 'a', date: examIn(30), weight: 2 }],
        cards: cards('a', 236),
        done: Array.from({ length: 4 }, () => ({ examId: 'a', mode: 'mobile' as const, wasNew: true })),
      }),
    )
    expect(plan.exams[0].modes.mobile.quota).toBe(10)
    expect(plan.exams[0].modes.mobile.newLeft).toBe(6)
  })

  it('meldet Rückstand und benötigte Zeit, wenn das Budget nicht reicht', () => {
    const plan = planDay(
      input({ exams: [{ id: 'a', date: examIn(5), weight: 2 }], cards: cards('a', 300), budgetMinutes: { mobile: 10, desk: 0 } }),
    )
    expect(plan.exams[0].behind).toBe(true)
    expect(plan.exams[0].modes.mobile.newLeft).toBe(10)
    expect(plan.modes.mobile.minutesNeeded).toBeGreaterThan(10)
  })

  it('bevorzugt bei Knappheit die nähere Prüfung', () => {
    const plan = planDay(
      input({
        exams: [
          { id: 'near', date: examIn(7), weight: 2 },
          { id: 'far', date: examIn(60), weight: 2 },
        ],
        cards: [...cards('near', 200), ...cards('far', 1000)],
        budgetMinutes: { mobile: 15, desk: 0 },
      }),
    )
    const near = plan.exams.find((e) => e.examId === 'near')!.modes.mobile.newLeft
    const far = plan.exams.find((e) => e.examId === 'far')!.modes.mobile.newLeft
    expect(near).toBeGreaterThan(far)
  })

  it('plant fällige Wiederholungen immer ein und ignoriert vergangene Prüfungen', () => {
    const plan = planDay(
      input({
        exams: [
          { id: 'a', date: examIn(20), weight: 2 },
          { id: 'old', date: examIn(-3), weight: 2 },
        ],
        cards: [...cards('a', 50, 'mobile', 2), ...cards('old', 50, 'mobile', 2)],
      }),
    )
    expect(plan.exams.map((e) => e.examId)).toEqual(['a'])
    expect(plan.modes.mobile.reviewsLeft).toBe(50)
  })

  it('trennt Unterwegs- und Schreibtisch-Budget', () => {
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(30), weight: 2 }], cards: [...cards('a', 48), ...cards('a', 48, 'desk')] }))
    expect(plan.exams[0].modes.mobile.newLeft).toBe(2)
    expect(plan.exams[0].modes.desk.newLeft).toBe(2)
  })
})

describe('buildQueue', () => {
  it('mischt Prüfungen und streut neue Karten zwischen Wiederholungen', () => {
    const all = [...cards('a', 4, 'mobile', 2), ...cards('b', 4, 'mobile', 2), ...cards('a', 20), ...cards('b', 20)]
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(30), weight: 2 }, { id: 'b', date: examIn(30), weight: 2 }], cards: all }))
    const q = buildQueue(plan, all, { mode: 'mobile', now: NOW })
    expect(q.length).toBe(8 + plan.modes.mobile.newLeft)
    expect(new Set(q.map((c) => c.id)).size).toBe(q.length)
    // Reihum gemischt: nicht alle Karten einer Prüfung am Stück.
    expect(q.slice(0, 2).map((c) => c.examId).sort()).toEqual(['a', 'b'])
    // Neue Karten nicht alle am Ende.
    expect(q.slice(0, q.length / 2).some((c) => c.state === 0)).toBe(true)
  })

  it('filtert auf eine Prüfung und berücksichtigt Zusatzkarten', () => {
    const all = [...cards('a', 30), ...cards('b', 30)]
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(30), weight: 2 }, { id: 'b', date: examIn(30), weight: 2 }], cards: all }))
    const q = buildQueue(plan, all, { mode: 'mobile', now: NOW, examId: 'a', extraNew: 5 })
    expect(q.every((c) => c.examId === 'a')).toBe(true)
    expect(q.length).toBe(plan.exams[0].modes.mobile.newLeft + 5)
    expect(q.map((c) => c.order)).toEqual([...q.map((c) => c.order)].sort((x, y) => x - y))
  })
})
