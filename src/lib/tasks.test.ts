import { describe, expect, it } from 'vitest'
import type { ReviewLog, StudyCard } from './db'
import { newMemoryState } from './scheduler'
import { rankTasks, topicKeys } from './tasks'
import { budgetInfo } from './budget'
import { examStats } from './stats'

const NOW = new Date(2026, 9, 28, 9, 0).getTime()
const DAY = 864e5
type Extra = Partial<StudyCard> & { learned?: boolean; lapses?: number }
const card = (id: string, packageId: string, chapter: string, x: Extra = {}): StudyCard => {
  const { learned, lapses, ...rest } = x
  const s = newMemoryState(0)
  if (learned) Object.assign(s, { state: 2, stability: 30, last_review: NOW - DAY, due: NOW + 20 * DAY, reps: 3, lapses: lapses ?? 0 })
  return { id, uid: id, profileId: 'p1', examId: 'e1', packageId, type: 'basic', front: 'F', back: 'B', chapter, order: 0, archived: 0, addedAt: 0, s, ...rest }
}
const task = (id: string, packageId: string, chapter: string, x: Extra = {}) => card(id, packageId, chapter, { type: 'task', ...x })
const days = new Map([['e1', 60]])

describe('Empfehlung von Schreibtischaufgaben', () => {
  it('verknüpft Aufgaben über das Kapitel oder über gemeinsame Themen', () => {
    expect(topicKeys(task('t', 'p', 'k1'))).toEqual(['e1:p:k1'])
    expect(topicKeys(task('t', 'p', 'k1', { topics: ['Schwingungsisolierung'] }))).toEqual(['e1#schwingungsisolierung'])
  })

  it('empfiehlt Probeklausur-Aufgaben vor Schwächen und Schwächen vor unbegonnenen Themen', () => {
    const cards = [
      // Thema A: gelernt, zwei Karten schon vergessen
      card('a1', 'kat', 'A', { topics: ['iso'], learned: true, lapses: 2 }),
      card('a2', 'kat', 'A', { topics: ['iso'], learned: true, lapses: 1 }),
      // Thema B: gelernt, sitzt
      card('b1', 'kat', 'B', { topics: ['ritz'], learned: true }),
      // Thema C: noch nicht begonnen
      card('c1', 'kat', 'C', { topics: ['rem'] }),
      task('tA', 'training', 'u', { topics: ['iso'] }),
      task('tB', 'training', 'u', { topics: ['ritz'] }),
      task('tC', 'training', 'u', { topics: ['rem'] }),
      task('tP', 'training', 'p', { topics: ['rem'], pastExam: true }),
    ]
    const r = rankTasks(cards, days, NOW, 0.9)
    const order = ['tA', 'tB', 'tC', 'tP'].sort((x, y) => r.get(y)!.score - r.get(x)!.score)
    expect(order).toEqual(['tP', 'tA', 'tB', 'tC'])
    expect(r.get('tA')!.reasons[0]).toBe('Schwäche: 2 Karten zum Thema sitzen noch nicht')
    expect(r.get('tC')!.reasons).toContain('Karten zum Thema noch kaum begonnen')
    // schon geübte Aufgaben bekommen keine Empfehlung (sie kommen als Wiederholung)
    expect(rankTasks([...cards, task('done', 'training', 'u', { learned: true })], days, NOW, 0.9).has('done')).toBe(false)
  })

  it('zieht Probeklausur-Aufgaben kurz vor der Klausur noch stärker vor', () => {
    const t = [task('tP', 'training', 'p', { pastExam: true })]
    expect(rankTasks(t, new Map([['e1', 10]]), NOW, 0.9).get('tP')!.score).toBeGreaterThan(rankTasks(t, days, NOW, 0.9).get('tP')!.score)
  })

  it('zählt im Fortschritt nur Karten, Aufgaben stehen getrennt', () => {
    const exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'MD', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }
    const st = examStats(exam, [card('a', 'k', 'A', { learned: true }), card('b', 'k', 'A'), task('t1', 'k', 'A', { learned: true }), task('t2', 'k', 'A')], NOW, 0.9)
    expect([st.total, st.introduced]).toEqual([2, 1])
    expect(st.tasks).toEqual({ total: 2, practiced: 1 })
  })
})

describe('Gemessenes Zeitbudget', () => {
  const log = (daysAgo: number, minutes: number, mode: 'mobile' | 'desk' = 'mobile'): ReviewLog => ({
    id: `${daysAgo}-${minutes}`, profileId: 'p1', examId: 'e1', cardId: 'c', mode, rating: 3, stateBefore: 2, reviewedAt: NOW - daysAgo * DAY, durationMs: minutes * 60_000,
  })
  // je Tag mehrere Bewertungen à 2 Minuten (Obergrenze je Bewertung: 5 Minuten)
  const day = (daysAgo: number, minutes: number) => Array.from({ length: minutes / 2 }, (_, i) => ({ ...log(daysAgo, 2), id: `${daysAgo}-${i}` }))

  it('plant erst ab drei Lerntagen mit der gemessenen Zeit', () => {
    expect(budgetInfo(30, [...day(1, 10), ...day(2, 10)], 'mobile', NOW)).toEqual({ setting: 30, days: 2, effective: 30 })
  })

  it('passt das Budget zur Hälfte an die Messung an, höchstens auf das 0,5- bis 1,5-Fache', () => {
    const little = [...day(1, 10), ...day(2, 10), ...day(3, 10)]
    expect(budgetInfo(30, little, 'mobile', NOW)).toMatchObject({ measured: 10, days: 3, effective: 20 })
    expect(budgetInfo(60, little, 'mobile', NOW).effective).toBe(35)
    expect(budgetInfo(100, little, 'mobile', NOW).effective).toBe(55)
    expect(budgetInfo(4, little, 'mobile', NOW).effective).toBe(6)
    // abgeschaltet: Messung wird nur angezeigt
    expect(budgetInfo(30, little, 'mobile', NOW, false)).toMatchObject({ measured: 10, effective: 30 })
    // heute und der andere Modus zählen nicht
    expect(budgetInfo(30, [...little, ...day(0, 40), log(1, 50, 'desk')], 'mobile', NOW).measured).toBe(10)
  })
})
