import { db, type StudyCard } from './db'

/**
 * Löscht eine Karte aus dem Lernplan. Sie wird nur archiviert und markiert, damit
 * Paket-Updates sie nicht zurückbringen; Lernfortschritt und Bewertungen bleiben erhalten,
 * die Karte lässt sich auf der Prüfungsseite wiederherstellen. Über `updatedAt` erreicht
 * die Löschung bei der Synchronisation auch die anderen Geräte.
 */
export async function deleteCard(card: Pick<StudyCard, 'id'>, now = Date.now()) {
  await db.cards.update(card.id, { archived: 1, deletedAt: now })
}

export async function restoreCard(card: Pick<StudyCard, 'id'>) {
  await db.cards.update(card.id, { archived: 0, deletedAt: undefined })
}

/** Gelöschte Karten einer Prüfung, zuletzt gelöschte zuerst. */
export async function deletedCards(examId: string) {
  const cards = await db.cards.where('[examId+archived]').equals([examId, 1]).filter((c) => !!c.deletedAt).toArray()
  return cards.sort((a, b) => b.deletedAt! - a.deletedAt!)
}

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', varepsilon: 'ε', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', varphi: 'φ', phi: 'φ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  cdot: '·', times: '×', approx: '≈', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠', infty: '∞', to: '→', rightarrow: '→',
  Rightarrow: '⇒', Leftrightarrow: '⇔', leftrightarrow: '↔', pm: '±', mp: '∓', sum: 'Σ', prod: 'Π', int: '∫', partial: '∂', nabla: '∇',
  in: '∈', sim: '∼', propto: '∝', circ: '°', degree: '°', dots: '…', ldots: '…', cdots: '…', perp: '⊥', parallel: '∥', angle: '∠',
  quad: ' ', qquad: ' ', Re: 'Re', Im: 'Im',
}
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'lim', 'max', 'min', 'det', 'arg', 'sgn'])
const ACCENTS: Record<string, string> = { dot: '̇', ddot: '̈', hat: '̂', bar: '̄', vec: '⃗', tilde: '̃' }
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', i: 'ⁱ' }
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', a: 'ₐ', e: 'ₑ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', s: 'ₛ', t: 'ₜ', x: 'ₓ' }
/** Klammert zusammengesetzte Ausdrücke, damit a/b eindeutig bleibt. */
const wrap = (a: string) => (/[\s+\-=/,]/.test(a.trim()) ? `(${a.trim()})` : a.trim())
/** Inhalt einer Klammer `{…}` ohne verschachtelte Klammern */
const ARG = '\\{([^{}]*)\\}'

const script = (map: Record<string, string>, mark: string) => (_: string, a?: string, b?: string) => {
  const v = a ?? b ?? ''
  if ([...v].every((ch) => map[ch])) return [...v].map((ch) => map[ch]).join('')
  return `${mark}${v.length > 1 && !/^\(.*\)$/.test(v) ? `(${v})` : v}`
}

/** Kartentext ohne Markdown- und Formelzeichen für einzeilige Listen (gängige LaTeX-Befehle werden zu Zeichen). */
export function plainText(text = '') {
  let t = text
  for (let i = 0; i < 4; i++) {
    t = t
      .replace(/\\(?:mathrm|text|textrm|mathbf|mathit|mathcal|operatorname|boldsymbol)\{([^{}]*)\}/g, '$1')
      .replace(/\\[dt]?frac\s*([0-9a-zA-Z])\s*([0-9a-zA-Z])/g, '$1/$2')
      .replace(new RegExp(`\\\\[dt]?frac${ARG}${ARG}`, 'g'), (_, a: string, b: string) => `${wrap(a)}/${wrap(b)}`)
      .replace(new RegExp(`\\\\sqrt(?:\\[[^\\]]*\\])?${ARG}`, 'g'), (_, a: string) => `√${wrap(a)}`)
      .replace(new RegExp(`\\\\(dot|ddot|hat|bar|vec|tilde)${ARG}`, 'g'), (_, acc: string, a: string) => a + ACCENTS[acc])
  }
  return t
    .replace(/\\(dot|ddot|hat|bar|vec|tilde)(?![a-zA-Z])\s*([a-zA-Z])/g, (_, acc: string, a: string) => a + ACCENTS[acc])
    .replace(/\\(?:left|right|big|Big|bigl|bigr|Bigl|Bigr)(?![a-zA-Z])\s*\\?/g, '')
    .replace(/\\([a-zA-Z]+)/g, (_, cmd: string) => SYMBOLS[cmd] ?? (FUNCTIONS.has(cmd) ? ` ${cmd} ` : ''))
    .replace(/\^([0-9])(?![0-9])/g, (_, d: string) => SUP[d])
    .replace(/\^\{([^{}]*)\}|\^(\S)/g, script(SUP, '^'))
    .replace(/_\{([^{}]*)\}|_([0-9])/g, script(SUB, '_'))
    // einzelner Index direkt hinter einem Zeichen (a_n, k_P) – nicht Markdown-Kursivschrift wie _Text_
    .replace(/(?<=[A-Za-zα-ωΑ-Ω0-9)])_([a-zA-Z])(?![a-zA-Z])/g, (_, c: string) => SUB[c] ?? c)
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/[*_$#>{}\\]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:)?])/g, '$1')
    .replace(/\( /g, '(')
    .trim()
    .normalize('NFC')
}
