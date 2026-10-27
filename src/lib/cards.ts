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

/** Kartentext ohne Markdown- und Formelzeichen für einzeilige Listen. */
const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', varepsilon: 'ε', epsilon: 'ε', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ', nu: 'ν',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', varphi: 'φ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω',
  cdot: '·', times: '×', approx: '≈', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', infty: '∞', to: '→', rightarrow: '→',
}

/** Kartentext ohne Markdown- und Formelzeichen für einzeilige Listen (einfache LaTeX-Befehle werden zu Zeichen). */
export const plainText = (text = '') =>
  text
    .replace(/\\([a-zA-Z]+)/g, (_, cmd: string) => GREEK[cmd] ?? '')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/[*_$#>{}^\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
