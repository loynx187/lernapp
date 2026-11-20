import { describe, expect, it } from 'vitest'
import { addDays, isoDate } from './dates'
import { newMemoryState, previewIntervals, Rating, review } from './scheduler'

describe('Begrenzung auf die Klausur', () => {
  it('ergibt für „Gut“ und „Einfach“ nie frühere Termine als für „Schwer“', () => {
    const start = new Date(2026, 9, 1, 9, 0).getTime()
    // Verschiedene Lernverläufe, darunter solche, bei denen „Schwer“ und „Gut“ nah beieinanderliegen
    const histories = [[3, 3, 3, 3], [3, 3, 2, 2], [3, 3, 3, 2, 2, 2], [4, 2, 2], [3, 3, 1, 3, 3], [3, 3, 3, 3, 2]]
    for (const [k, history] of histories.entries()) for (const id of ['a', 'b', 'c', 'd']) {
      let s = newMemoryState(start)
      let t = start
      for (const r of history) {
        s = review(s, r as 1 | 2 | 3 | 4, t, 0.9, undefined, id + k)
        t = Math.max(s.due, t + 60_000)
      }
      for (let d = 3; d <= 90; d++) {
        const p = previewIntervals(s, t, 0.9, isoDate(addDays(t, d)), id + k)
        expect(p[Rating.Good]).toBeGreaterThanOrEqual(p[Rating.Hard])
        expect(p[Rating.Easy]).toBeGreaterThanOrEqual(p[Rating.Good])
      }
    }
  })
})
