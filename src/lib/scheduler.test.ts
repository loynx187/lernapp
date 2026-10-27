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

describe('persönliche FSRS-Parameter', () => {
  it('liest die Ausgabe des Optimierungsskripts und lehnt Unsinn ab', async () => {
    const { parseFsrsWeights, FSRS_PARAM_COUNT } = await import('./scheduler')
    const out = '0.4775, 1.2931, 2.6047, 8.2956, 6.2037, 1.0635, 2.7852, 0.2180, 2.1650, 0.0000, 1.0805, 1.7126, 0.0010, 0.4730, 1.9209, 0.6014, 1.8729, 0.3696, 0.3808, 0.3470, 0.4232'
    expect(parseFsrsWeights(out)).toHaveLength(FSRS_PARAM_COUNT)
    expect(() => parseFsrsWeights('1, 2, 3')).toThrow(/Erwartet/)
    expect(() => parseFsrsWeights('a, b')).toThrow(/Zahlen/)
  })

  it('wirkt sich auf die Intervalle aus', async () => {
    const { parseFsrsWeights, setFsrsWeights } = await import('./scheduler')
    const s = review(newMemoryState(NOW), Rating.Easy, NOW, 0.9, undefined, 'x')
    const slow = parseFsrsWeights('0.1, 0.2, 0.3, 0.5, 6.2, 1.06, 2.78, 0.22, 2.16, 0.1, 1.08, 1.71, 0.01, 0.47, 1.92, 0.6, 1.87, 0.37, 0.38, 0.35, 0.42')
    setFsrsWeights(slow)
    const s2 = review(newMemoryState(NOW), Rating.Easy, NOW, 0.9, undefined, 'x')
    setFsrsWeights(undefined)
    expect(s2.due).toBeLessThan(s.due)
  })
})
