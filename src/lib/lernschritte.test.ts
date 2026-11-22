import { describe, expect, it } from 'vitest'
import { isWaiting, nextCard, nextWaiting } from './sessionQueue'

const MIN = 60_000
const NOW = new Date(2026, 10, 22, 10, 0).getTime()
const c = (id: string, state: number, dueIn: number) => ({ id, s: { state, due: NOW + dueIn } }) as never as { id: string; s: { state: number; due: number } } & Parameters<typeof isWaiting>[0]

describe('Lernschritte in der Sitzung', () => {
  it('zeigt Karten im Lernschritt erst nach der angezeigten Zeit', () => {
    expect(isWaiting(c('a', 1, 10 * MIN), NOW)).toBe(true)
    expect(isWaiting(c('a', 3, 5 * MIN), NOW)).toBe(true)
    expect(isWaiting(c('a', 1, -1), NOW)).toBe(false)
    // Wiederholungen mit Tagesabstand und neue Karten warten nicht
    expect(isWaiting(c('a', 2, 5 * 60 * MIN), NOW)).toBe(false)
    expect(isWaiting(c('a', 0, 0), NOW)).toBe(false)
  })

  it('überspringt wartende Karten und nimmt sie, sobald sie fällig sind', () => {
    const queue = [c('lern', 1, 10 * MIN), c('neu', 0, 0), c('wdh', 2, 0)]
    expect(nextCard(queue, NOW)?.id).toBe('neu')
    expect(nextCard(queue, NOW + 10 * MIN)?.id).toBe('lern')
    expect(nextCard([c('lern', 1, 10 * MIN)], NOW)).toBeUndefined()
    expect(nextCard([c('lern', 1, 10 * MIN)], NOW, 'lern')?.id).toBe('lern')
    expect(nextWaiting([c('x', 1, 20 * MIN), c('y', 3, 7 * MIN)], NOW)?.id).toBe('y')
  })
})
