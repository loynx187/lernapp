import { describe, expect, it } from 'vitest'
import { composeMockExam, itemMinutes, scoreMockExam } from './mockExam'
import { newMemoryState } from './scheduler'
import type { StudyCard } from './db'

const card = (i: number, type: StudyCard['type'], chapter: string, relevance = 2): StudyCard => ({
  id: `c${i}`, uid: `u${i}`, type, chapter, chapterTitle: chapter.toUpperCase(), front: 'F', back: 'B', profileId: 'p', examId: 'e',
  packageId: 'pk', order: i, archived: 0, addedAt: 0, s: newMemoryState(0), relevance,
})

const pool = [
  ...Array.from({ length: 10 }, (_, i) => card(i, 'task', i < 5 ? 'k1' : 'k2', i % 2 ? 3 : 1)),
  ...Array.from({ length: 40 }, (_, i) => card(100 + i, i % 3 ? 'basic' : 'mc', ['k1', 'k2', 'k3'][i % 3])),
]

describe('composeMockExam', () => {
  it('füllt die Zeit, überwiegend mit Rechenaufgaben, aus allen Kapiteln', () => {
    const items = composeMockExam(pool, 60)
    const minutes = items.reduce((s, c) => s + itemMinutes(c), 0)
    expect(minutes).toBeLessThanOrEqual(60)
    expect(minutes).toBeGreaterThanOrEqual(55)
    const taskMinutes = items.filter((c) => c.type === 'task').reduce((s, c) => s + itemMinutes(c), 0)
    expect(taskMinutes).toBeGreaterThanOrEqual(30)
    expect(new Set(items.map((c) => c.chapter))).toEqual(new Set(['k1', 'k2', 'k3']))
    expect(new Set(items.map((c) => c.id)).size).toBe(items.length)
  })

  it('bevorzugt klausurrelevante Aufgaben', () => {
    let relevant = 0
    for (let i = 0; i < 200; i++) relevant += composeMockExam(pool, 20).filter((c) => c.type === 'task' && c.relevance === 3).length
    let other = 0
    for (let i = 0; i < 200; i++) other += composeMockExam(pool, 20).filter((c) => c.type === 'task' && c.relevance === 1).length
    expect(relevant).toBeGreaterThan(other * 2)
  })
})

describe('scoreMockExam', () => {
  it('gewichtet nach Bearbeitungszeit und wertet pro Kapitel aus', () => {
    const items = [card(1, 'task', 'k1'), card(2, 'basic', 'k2')]
    const r = scoreMockExam(items, { c1: 'teilweise', c2: 'richtig' })
    expect(r.max).toBe(12)
    expect(r.points).toBe(7)
    expect(r.chapters.find((c) => c.title === 'K2')).toMatchObject({ points: 2, max: 2 })
  })
})
