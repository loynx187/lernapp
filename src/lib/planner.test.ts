import { describe, expect, it } from 'vitest'
import { buildQueue, distribute, introductionDays, MIX_WITHIN_DAYS, orderNew, planDay, subjectsToday, type PlanCard, type PlanInput } from './planner'
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

describe('Reihenfolge neuer Karten über mehrere Pakete', () => {
  // Zwei Pakete derselben Prüfung; beide beginnen ihre Skript-Reihenfolge bei 0.
  const pkgs = (examId: string) =>
    [0, 1].flatMap((block) => cards(examId, 10).map((c) => ({ ...c, id: `${c.id}-p${block}`, block })))

  it('führt Pakete nacheinander ein, jeweils in Skript-Reihenfolge', () => {
    const q = orderNew(pkgs('a').reverse(), false, false)
    expect(q.map((c) => c.block)).toEqual([...Array(10).fill(0), ...Array(10).fill(1)])
    expect(q.slice(0, 10).map((c) => c.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('mischt die Pakete kurz vor der Klausur und zieht Relevantes vor', () => {
    const all = pkgs('a').map((c) => ({ ...c, relevance: c.block === 1 && c.order === 9 ? 3 : 2 }))
    const far = planDay(input({ exams: [{ id: 'a', date: examIn(60), weight: 2 }], cards: all }))
    const qFar = buildQueue(far, all, { mode: 'mobile', now: NOW })
    expect(qFar.every((c) => c.block === 0)).toBe(true)

    const near = planDay(input({ exams: [{ id: 'a', date: examIn(MIX_WITHIN_DAYS) }].map((e) => ({ ...e, weight: 2 })), cards: all }))
    const qNear = buildQueue(near, all, { mode: 'mobile', now: NOW })
    expect(qNear[0].id).toBe('a-mobile-0-9-p1')
    const mixed = orderNew(all, true, true)
    expect(mixed.slice(1, 5).map((c) => c.block)).toEqual([0, 1, 0, 1])
  })

  it('bleibt auch bei Rückstand chronologisch, nur Zusatzstoff kommt nach hinten', () => {
    const all = [0, 1]
      .flatMap((block) => cards('a', 200).map((c) => ({ ...c, id: `${c.id}-p${block}`, block })))
      .map((c) => ({ ...c, relevance: c.block === 1 && c.order === 199 ? 3 : c.block === 0 && c.order === 0 ? 1 : 2 }))
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(40), weight: 2 }], cards: all, budgetMinutes: { mobile: 5, desk: 0 } }))
    expect(plan.exams[0].behind).toBe(true)
    const q = buildQueue(plan, all, { mode: 'mobile', now: NOW })
    expect(q.length).toBeGreaterThan(2)
    expect(q.map((c) => c.id)).toEqual(q.map((_, i) => `a-mobile-0-${i + 1}-p0`))
  })
})

describe('Semesterarten und Kernstoff', () => {
  it('führt im dualen Semester neuen Stoff aller Fächer bis vor Beginn der Prüfungsphase ein', async () => {
    const { planExams, SEMESTER_KINDS } = await import('./semesters')
    const exams = [
      { id: 'a', date: examIn(40), weight: 2 },
      { id: 'b', date: examIn(44), weight: 2 },
    ].map((e) => ({ ...e, profileId: 'p', semesterId: 's', name: e.id, color: '#000', createdAt: 0 }))
    const dual = planDay(
      input({ exams: planExams(exams, { kind: 'dual' }), buffer: SEMESTER_KINDS.dual.buffer, cards: [...cards('a', 100), ...cards('b', 100)] }),
    )
    const regular = planDay(
      input({ exams: planExams(exams, { kind: 'regulaer' }), buffer: SEMESTER_KINDS.regulaer.buffer, cards: [...cards('a', 100), ...cards('b', 100)] }),
    )
    // dual: beide Fächer gleicher Stichtag (40 Tage − 10 Puffer = 30)
    expect(dual.exams.map((e) => e.introDeadline)).toEqual([30, 30])
    // regulär: jedes Fach bis zu seiner Klausur (40 − 8 = 32, 44 − 9 = 35)
    expect(regular.exams.map((e) => e.introDeadline)).toEqual([32, 35])
  })

  it('führt in der laufenden Prüfungsphase den Reststoff so schnell wie möglich ein', () => {
    const plan = planDay(input({ exams: [{ id: 'b', date: examIn(3), weight: 2, introBy: examIn(-1) }], cards: cards('b', 20) }))
    expect(plan.exams[0].introDeadline).toBe(1)
    expect(plan.exams[0].modes.mobile.quota).toBe(20)
  })

  it('plant Zusatzstoff (Relevanz 1) erst ein, wenn das Budget nach dem Kernstoff reicht', () => {
    const mixed = cards('a', 60).map((c, i) => ({ ...c, relevance: i < 30 ? 1 : 3 }))
    const tight = planDay(input({ exams: [{ id: 'a', date: examIn(5), weight: 2 }], cards: mixed, budgetMinutes: { mobile: 10, desk: 0 } }))
    const m = tight.exams[0].modes.mobile
    expect(m.coreRemaining).toBe(30)
    expect(m.quota).toBe(10) // 30 Kernkarten / 3 Einführungstage
    expect(m.allowed).toBe(10) // Budget reicht genau für den Kernstoff
    expect(tight.exams[0].behind).toBe(false)

    const q = buildQueue(tight, mixed, { mode: 'mobile', now: NOW })
    expect(q.every((c) => c.relevance === 3)).toBe(true)

    const roomy = planDay(input({ exams: [{ id: 'a', date: examIn(5), weight: 2 }], cards: mixed, budgetMinutes: { mobile: 60, desk: 0 } }))
    expect(roomy.exams[0].modes.mobile.allowed).toBe(20)
  })

  it('prognostiziert, wie viel Stoff bis zum Stichtag geschafft wird', () => {
    const ok = planDay(input({ exams: [{ id: 'a', date: examIn(30), weight: 2 }], cards: cards('a', 240) }))
    expect(ok.exams[0].forecastShare).toBeCloseTo(1)
    const tight = planDay(input({ exams: [{ id: 'a', date: examIn(30), weight: 2 }], cards: cards('a', 240), budgetMinutes: { mobile: 5, desk: 0 } }))
    // 5 Karten/Tag × 24 Tage = 120 von 240
    expect(tight.exams[0].forecastShare).toBeCloseTo(0.5)
  })

  it('beginnt bei laufender Vorlesung den vorhandenen Stoff innerhalb der eingestellten Tage', async () => {
    const { planExams } = await import('./semesters')
    const base = { id: 'a', date: examIn(84), weight: 2, profileId: 'p', semesterId: 's', name: 'a', color: '#000', createdAt: 0 }
    const spread = planDay(input({ exams: planExams([base]), cards: cards('a', 40) }))
    expect(spread.exams[0].modes.mobile.quota).toBe(1) // 40 Karten über ~74 Tage
    const week = planDay(input({ exams: planExams([{ ...base, ongoing: true }]), cards: cards('a', 40) }))
    expect(week.exams[0].introDeadline).toBe(7)
    expect(week.exams[0].modes.mobile.quota).toBe(6)
    const custom = planDay(input({ exams: planExams([{ ...base, ongoing: true, ongoingDays: 14 }]), cards: cards('a', 40) }))
    expect(custom.exams[0].introDeadline).toBe(14)
    // kurz vor der Klausur gilt weiterhin der normale, kürzere Stichtag
    const late = planDay(input({ exams: planExams([{ ...base, date: examIn(6), ongoing: true }]), cards: cards('a', 40) }))
    expect(late.exams[0].introDeadline).toBe(4)
  })
})

describe('subjectsToday', () => {
  it('empfiehlt das Fach mit Rückstand bzw. dem meisten offenen Pensum', () => {
    const all = [...cards('a', 5, 'mobile', 2), ...cards('b', 12, 'mobile', 2), ...cards('c', 3, 'desk', 2)]
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(10), weight: 2 }, { id: 'b', date: examIn(30), weight: 2 }, { id: 'c', date: examIn(20), weight: 2 }, { id: 'd', date: examIn(5), weight: 2 }], cards: all }))
    const s = subjectsToday(plan)
    expect(s.map((x) => x.examId)).toEqual(['b', 'a', 'c'])
    expect(s[2].left).toEqual({ mobile: 0, desk: 3 })
    // Rückstand geht vor: viele neue Karten bei knappem Budget
    const behind = [...all, ...cards('d', 300)]
    const p2 = planDay(input({ exams: [{ id: 'b', date: examIn(30), weight: 2 }, { id: 'd', date: examIn(5), weight: 2 }], cards: behind, budgetMinutes: { mobile: 5, desk: 5 } }))
    expect(subjectsToday(p2)[0].examId).toBe('d')
  })
})

describe('Schreibtischaufgaben als Zusatz', () => {
  it('erzeugen keinen Rückstand und zählen nicht zur Prognose', () => {
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(5), weight: 2 }], cards: [...cards('a', 10), ...cards('a', 200, 'desk')], budgetMinutes: { mobile: 30, desk: 30 } }))
    const p = plan.exams[0]
    expect(p.behind).toBe(false)
    expect(p.modes.desk.quota).toBe(0)
    // das Schreibtisch-Budget wird mit neuen Aufgaben gefüllt: 30 min / 15 min
    expect(p.modes.desk.newLeft).toBe(2)
    expect(p.forecastShare).toBe(1)
    expect(plan.modes.desk.minutesNeeded).toBe(0)
  })

  it('stellt erst fällige Wiederholungen, dann neue Aufgaben nach Empfehlung zusammen', () => {
    const fresh = cards('a', 5, 'desk').map((c, i) => ({ ...c, priority: i === 3 ? 5 : 0 }))
    const all = [...cards('a', 1, 'desk', 2), ...fresh]
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(30), weight: 2 }], cards: all, budgetMinutes: { mobile: 0, desk: 60 } }))
    const q = buildQueue(plan, all, { mode: 'desk', now: NOW })
    expect(q.map((c) => c.id)).toEqual(['a-desk-2-0', 'a-desk-0-3', 'a-desk-0-0', 'a-desk-0-1'])
  })
})

describe('Empfehlung des Fachs', () => {
  it('empfiehlt das Fach mit dem meisten nötigen neuen Stoff pro Tag, nicht das mit den meisten Wiederholungen', () => {
    // a: fast alles gelernt, viele Wiederholungen fällig; b: viel neuer Stoff bis zur Klausur
    const all = [...cards('a', 80, 'mobile', 2), ...cards('a', 4), ...cards('b', 5, 'mobile', 2), ...cards('b', 60)]
    const plan = planDay(input({ exams: [{ id: 'a', date: examIn(20), weight: 2 }, { id: 'b', date: examIn(30), weight: 2 }], cards: all, budgetMinutes: { mobile: 120, desk: 0 } }))
    const s = subjectsToday(plan)
    expect(s.map((x) => x.examId)).toEqual(['b', 'a'])
    expect(s[0]).toMatchObject({ perDay: 3, newRemaining: 60, reviewsDue: 5 })
  })
})
