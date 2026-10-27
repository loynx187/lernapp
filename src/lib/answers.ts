import type { NumericAnswer } from './db'

export const DEFAULT_TOLERANCE = 0.02

/**
 * Liest eine Zahl aus einer Eingabe wie „159,2“, „1.234,5 MPa“, „7,58e-4“ oder „7,58·10^-4“.
 * Liefert NaN, wenn keine Zahl erkennbar ist.
 */
export function parseNumber(input: string): number {
  let s = input.trim().replace(/[\s  ]/g, '').replace(/−/g, '-')
  // Zehnerpotenz „·10^-4“ / „x10^3“ / „*10^3“
  let exp = 0
  const pow = s.match(/[·x×*]10\^?\(?([+-]?\d+)\)?/)
  if (pow) {
    exp = Number(pow[1])
    s = s.slice(0, pow.index)
  }
  const m = s.match(/^[+-]?[\d.,]+(?:e[+-]?\d+)?/i)
  if (!m) return NaN
  let num = m[0]
  const lastComma = num.lastIndexOf(',')
  const lastDot = num.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Das hintere Zeichen ist das Dezimaltrennzeichen, das andere trennt Tausender.
    num = lastComma > lastDot ? num.replace(/\./g, '').replace(',', '.') : num.replace(/,/g, '')
  } else if (lastComma >= 0) {
    num = num.replace(',', '.')
  }
  const value = Number(num)
  return Number.isFinite(value) ? value * 10 ** exp : NaN
}

/** Textantworten vergleichen: Groß-/Kleinschreibung und Leerzeichen zählen nicht. */
const normText = (s: string) => s.toLowerCase().replace(/\s+/g, '')

export function checkAnswer(input: string, a: NumericAnswer): boolean {
  if (a.text?.length) return !!input.trim() && a.text.some((t) => normText(t) === normText(input))
  if (a.value === undefined) return false
  const x = parseNumber(input)
  if (Number.isNaN(x)) return false
  const tol = a.tolerance ?? DEFAULT_TOLERANCE
  if (a.value === 0) return Math.abs(x) <= tol
  return Math.abs(x - a.value) <= tol * Math.abs(a.value)
}

export const formatAnswer = (a: NumericAnswer) =>
  `${a.text?.length ? a.text[0] : (a.value ?? 0).toLocaleString('de-DE', { maximumSignificantDigits: 6 })}${a.unit ? ` ${a.unit}` : ''}`
