import { describe, expect, it } from 'vitest'
import { capToExam, newMemoryState, Rating, retrievability, review } from './scheduler'
import { addDays, DAY, isoDate, parseIsoDate } from './dates'

const NOW = new Date(2026, 9, 27, 9, 0).getTime()

describe('capToExam', () => {
  it('legt Termine nach der Klausur auf einen der Tage kurz davor', () => {
    const exam = isoDate(addDays(NOW, 20))
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const due = capToExam(addDays(NOW, 40), NOW, exam, id)
      expect(due).toBeLessThan(parseIsoDate(exam))
      expect(due).toBeGreaterThanOrEqual(addDays(parseIsoDate(exam), -4))
    }
  })
  it('lässt Termine vor der Klausur unverändert', () => {
    const exam = isoDate(addDays(NOW, 20))
    expect(capToExam(addDays(NOW, 5), NOW, exam, 'x')).toBe(addDays(NOW, 5))
  })
})

describe('review', () => {
  it('führt neue Karten durch Lernschritte und dann in längere Intervalle', () => {
    let s = newMemoryState(NOW)
    s = review(s, Rating.Good, NOW, 0.9, undefined, 'x')
    expect(s.state).not.toBe(0)
    let t = s.due
    s = review(s, Rating.Good, t, 0.9, undefined, 'x')
    t = s.due
    s = review(s, Rating.Good, t, 0.9, undefined, 'x')
    expect(s.due - t).toBeGreaterThan(DAY)
    expect(retrievability(s, s.due)).toBeGreaterThan(0.85)
  })

  it('wiederholt vor der Klausur, auch wenn FSRS später planen würde', () => {
    const exam = isoDate(addDays(NOW, 10))
    let s = newMemoryState(NOW)
    let t = NOW
    // Solange mehr als ein Tag bis zur Klausur bleibt, muss jede Karte vorher noch einmal drankommen.
    while (t < addDays(parseIsoDate(exam), -1)) {
      s = review(s, Rating.Easy, t, 0.9, exam, 'card')
      expect(s.due).toBeLessThan(parseIsoDate(exam))
      t = s.due
    }
  })
})
