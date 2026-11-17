import { describe, expect, it } from 'vitest'
import { buildQueue, planDay, type PlanCard, type PlanInput } from './planner'
import { addDays, isoDate, studyDate } from './dates'
import { dayFactor, dayFactors, minutesOn } from './weekplan'
import { budgetInfo } from './budget'
import { streak } from './stats'
import type { ReviewLog } from './db'

// Montag, 16.11.2026, 9 Uhr
const NOW = new Date(2026, 10, 16, 9, 0).getTime()
const examIn = (days: number) => isoDate(addDays(NOW, days))
const fresh = (examId: string, n: number): PlanCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${examId}-${i}`, examId, mode: 'mobile' as const, state: 0, due: NOW, order: i }))
const input = (over: Partial<PlanInput>): PlanInput => ({
  now: NOW, exams: [], cards: [], done: [], budgetMinutes: { mobile: 30, desk: 30 },
  costs: { mobile: { newCard: 60, review: 15 }, desk: { newCard: 900, review: 480 } }, ...over,
})
const profile = { minutesMobile: 20, minutesDesk: 30, weekFactors: [1, 1, 1, 1, 1, 3, 3], freeDays: [examIn(1)] }

describe('Wochenplan', () => {
  it('liefert Faktor und Minuten je Tag, freie Tage zählen 0', () => {
    expect(dayFactor(profile, NOW)).toBe(1)
    expect(dayFactor(profile, addDays(NOW, 1))).toBe(0)
    expect(dayFactor(profile, addDays(NOW, 5))).toBe(3)
    expect(minutesOn(profile, 'mobile', addDays(NOW, 5))).toBe(60)
    expect(dayFactors(profile, NOW, 7)).toEqual([1, 0, 1, 1, 1, 3, 3])
    expect(dayFactor({ minutesMobile: 20, minutesDesk: 30 }, NOW)).toBe(1)
  })

  it('verteilt neuen Stoff nach der Lernzeit der Tage', () => {
    const exams = [{ id: 'a', date: examIn(30), weight: 2, introBy: examIn(10) }]
    // Einführungstage: 10 → 9 Tage bis zum Stichtag mit Puffer; Faktoren heute 1, Summe 18 → 1/18 des Stoffs heute
    const factors = [1, 0, 1, 1, 1, 3, 3, 1, 1, 1, 1, 3, 3]
    const plain = planDay(input({ exams, cards: fresh('a', 90) }))
    const weighted = planDay(input({ exams, cards: fresh('a', 90), dayFactors: factors }))
    const intro = plain.exams[0].introDeadline
    const sum = factors.slice(0, intro).reduce((s, f) => s + f, 0)
    expect(plain.exams[0].modes.mobile.quota).toBe(Math.ceil(90 / intro))
    expect(weighted.exams[0].modes.mobile.quota).toBe(Math.ceil(90 / sum))
    // Freier Tag: kein neuer Stoff, kein Rückstand
    const off = planDay(input({ exams, cards: fresh('a', 90), dayFactors: [0, ...factors] }))
    expect(off.exams[0].modes.mobile.quota).toBe(0)
    expect(off.exams[0].behind).toBe(false)
  })

  it('rechnet den Rückstand zum heutigen Soll', () => {
    const exams = [{ id: 'a', date: examIn(30), weight: 2, introBy: examIn(10) }]
    const p = planDay(input({ exams, cards: fresh('a', 300), budgetMinutes: { mobile: 10, desk: 0 }, dayFactors: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] })).exams[0]
    // 10 neue Karten pro Tag passen ins Budget, Stoff für die Einführungstage reicht nicht
    expect(p.behind).toBe(true)
    expect(p.backlog).toBe(p.modes.mobile.quota - 10)
  })

  it('rechnet gemessene Lernzeit auf einen normalen Tag um', () => {
    const logs = (day: number, minutes: number): ReviewLog[] =>
      Array.from({ length: minutes }, (_, i) => ({ id: `${day}-${i}`, profileId: 'p', examId: 'a', cardId: 'c', mode: 'mobile', rating: 3, stateBefore: 2, reviewedAt: addDays(NOW, -day) + i, durationMs: 60_000 }))
    // Drei Tage mit 3× (60 min) entsprechen je 20 min an einem normalen Tag
    const all = [...logs(1, 60), ...logs(2, 60), ...logs(3, 60)]
    expect(budgetInfo(20, all, 'mobile', NOW, true).measured).toBe(60)
    expect(budgetInfo(20, all, 'mobile', NOW, true, () => 3).measured).toBe(20)
  })

  it('freie Tage unterbrechen die Lernserie nicht', () => {
    const log = (day: number): ReviewLog => ({ id: String(day), profileId: 'p', examId: 'a', cardId: 'c', mode: 'mobile', rating: 3, stateBefore: 2, reviewedAt: addDays(NOW, -day), durationMs: 1000 })
    const logs = [log(0), log(2), log(3)]
    const free = studyDate(addDays(NOW, -1))
    expect(streak(logs, NOW)).toBe(1)
    expect(streak(logs, NOW, (d) => d === free)).toBe(3)
  })
})

describe('Endspurt', () => {
  it('frischt in den letzten Tagen vor der Klausur noch nicht fällige Karten auf, relevante und vergessene zuerst', () => {
    const started = (i: number, recall: number, relevance = 2): PlanCard => ({ id: `s${i}`, examId: 'a', mode: 'mobile', state: 2, due: addDays(NOW, 5), order: i, recall, relevance })
    const cards = [started(1, 0.95), started(2, 0.6), started(3, 0.9, 3), started(4, 0.8)]
    const near = planDay(input({ exams: [{ id: 'a', date: examIn(2), weight: 2 }], cards, budgetMinutes: { mobile: 1, desk: 0 } }))
    expect(near.exams[0].endspurt).toBe(true)
    // 60 s Budget, 15 s je Karte → alle 4 passen
    expect(near.exams[0].modes.mobile.refreshLeft).toBe(4)
    expect(near.modes.mobile.refreshLeft).toBe(4)
    const queue = buildQueue(near, cards, { mode: 'mobile', now: NOW })
    expect(queue.map((c) => c.id)).toEqual(['s3', 's2', 's4', 's1'])

    const far = planDay(input({ exams: [{ id: 'a', date: examIn(10), weight: 2 }], cards }))
    expect(far.exams[0].endspurt).toBe(false)
    expect(far.exams[0].modes.mobile.refreshLeft ?? 0).toBe(0)
  })
})
