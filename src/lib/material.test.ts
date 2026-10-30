import { describe, expect, it } from 'vitest'
import { materialByExam } from './stats'

describe('Stoff je Prüfung und Modus', () => {
  it('zählt Aufgaben und Karten getrennt, auch ohne Tagesplan', () => {
    const cards = [
      { examId: 'rt', type: 'task' as const },
      { examId: 'rt', type: 'basic' as const },
      { examId: 'st', type: 'task' as const },
      { examId: 'st', type: 'basic' as const, mode: 'desk' as const },
      { examId: 'qm', type: 'mc' as const },
    ]
    expect(materialByExam(cards, 'desk')).toEqual(new Map([['rt', 1], ['st', 2]]))
    expect(materialByExam(cards, 'mobile')).toEqual(new Map([['rt', 1], ['qm', 1]]))
  })
})
