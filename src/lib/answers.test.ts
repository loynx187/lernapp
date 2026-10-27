import { describe, expect, it } from 'vitest'
import { checkAnswer, parseNumber } from './answers'

describe('parseNumber', () => {
  it('versteht deutsche und englische Schreibweisen', () => {
    expect(parseNumber('159,2')).toBe(159.2)
    expect(parseNumber('159.2 MPa')).toBe(159.2)
    expect(parseNumber('1.234,5')).toBe(1234.5)
    expect(parseNumber('1,234.5')).toBe(1234.5)
    expect(parseNumber('210 000')).toBe(210000)
    expect(parseNumber('−3,5')).toBe(-3.5)
    expect(parseNumber('7,58e-4')).toBeCloseTo(7.58e-4)
    expect(parseNumber('7,58·10^-4')).toBeCloseTo(7.58e-4)
    expect(parseNumber('abc')).toBeNaN()
  })
})

describe('checkAnswer', () => {
  it('akzeptiert Abweichungen innerhalb der Toleranz', () => {
    expect(checkAnswer('159', { value: 159.2 })).toBe(true)
    expect(checkAnswer('35', { value: 34.9 })).toBe(true)
    expect(checkAnswer('150', { value: 159.2 })).toBe(false)
    expect(checkAnswer('1,2', { value: 1.14, tolerance: 0.1 })).toBe(true)
    expect(checkAnswer('', { value: 1 })).toBe(false)
  })
})

describe('Textantworten', () => {
  it('vergleicht ohne Groß-/Kleinschreibung und Leerzeichen', () => {
    const hex = { text: ['3E8', '16#3E8'] }
    expect(checkAnswer('3e8', hex)).toBe(true)
    expect(checkAnswer(' 16#3E8 ', hex)).toBe(true)
    expect(checkAnswer('3E9', hex)).toBe(false)
    expect(checkAnswer('', hex)).toBe(false)
    expect(checkAnswer('0110 1001', { text: ['01101001'] })).toBe(true)
    expect(checkAnswer('1101001', { text: ['01101001'] })).toBe(false)
  })
})
