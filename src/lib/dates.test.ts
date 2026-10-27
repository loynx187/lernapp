import { describe, expect, it } from 'vitest'
import { studyDate, studyDayStart } from './dates'
import { doneToday, streak } from './stats'
import type { ReviewLog } from './db'

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()
const log = (t: number, cardId = String(t)): ReviewLog =>
  ({ id: cardId, profileId: 'p', examId: 'e', cardId, mode: 'mobile', rating: 3, stateBefore: 2, reviewedAt: t, durationMs: 1 }) as ReviewLog

describe('Lerntag ab 4:00 Uhr', () => {
  it('ordnet die Zeit nach Mitternacht dem Vortag zu', () => {
    expect(studyDate(at(10, 1, 30))).toBe('2026-11-09')
    expect(studyDate(at(10, 4))).toBe('2026-11-10')
    expect(studyDayStart(at(10, 23))).toBe(at(10, 4))
  })

  it('zählt Lernen nach Mitternacht zum heutigen Pensum und zur Serie', () => {
    const logs = [log(at(8, 20)), log(at(10, 0, 30)), log(at(10, 21))]
    expect(doneToday(logs, at(10, 23))).toHaveLength(1)
    expect(doneToday(logs, at(11, 2))).toHaveLength(1) // 21 Uhr am 10. zählt bis 4 Uhr morgens
    // 8. abends, 9. (0:30 am 10.), 10. → drei Tage in Folge
    expect(streak(logs, at(10, 22))).toBe(3)
    expect(streak(logs, at(12, 9))).toBe(0)
  })
})
