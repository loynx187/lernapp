import { describe, expect, it } from 'vitest'
import { newMemoryState, previewIntervals, Rating, review, type Grade } from './scheduler'

describe('Vorschau der Abstände auf den Bewertungsknöpfen', () => {
  it('entspricht dem geplanten Termin, wenn mit dem Zeitpunkt der Vorschau bewertet wird', () => {
    let s = newMemoryState(0)
    let t = Date.UTC(2026, 10, 1, 8)
    for (let i = 0; i < 3; i++) {
      s = review(s, Rating.Good, t, 0.9, undefined, 'k')
      t = s.due
    }
    const shownAt = t + 1234
    const shown = previewIntervals(s, shownAt, 0.9, '2027-03-01', 'k')
    for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
      expect(review(s, r, shownAt, 0.9, '2027-03-01', 'k').due - shownAt).toBe(shown[r])
    }
  })
})
