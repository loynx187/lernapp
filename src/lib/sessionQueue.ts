import type { StudyCard } from './db'

/** FSRS-Zustände „Lernen“ und „Neu lernen“: kurze Lernschritte mit Fälligkeit auf die Minute. */
const LEARNING_STATES = new Set([1, 3])

/**
 * Wartet die Karte noch auf ihren Lernschritt? Karten in kurzen Lernschritten (z. B. „Nochmal – 10 min“) kommen
 * erst, wenn die angezeigte Zeit vorbei ist. Wiederholungen mit Tagesabständen sind ab Beginn ihres Lerntags dran.
 */
export function isWaiting(c: Pick<StudyCard, 's'>, now: number): boolean {
  return LEARNING_STATES.has(c.s.state) && c.s.due > now
}

/** Nächste Karte der Sitzung: die erste, die nicht mehr wartet (oder die ausdrücklich vorgezogene). */
export function nextCard<C extends Pick<StudyCard, 'id' | 's'>>(queue: C[], now: number, forcedId?: string): C | undefined {
  return (forcedId ? queue.find((c) => c.id === forcedId) : undefined) ?? queue.find((c) => !isWaiting(c, now))
}

/** Die Karte, die als nächste wieder dran ist, wenn gerade alle warten. */
export function nextWaiting<C extends Pick<StudyCard, 's'>>(queue: C[], now: number): C | undefined {
  return queue.filter((c) => isWaiting(c, now)).sort((a, b) => a.s.due - b.s.due)[0]
}
