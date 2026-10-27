import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type FSRS, type Grade } from 'ts-fsrs'
import type { MemoryState } from './db'
import { addDays, DAY, parseIsoDate, startOfDay } from './dates'

export { Rating }
export type { Grade }

const schedulers = new Map<number, FSRS>()

function scheduler(retention: number): FSRS {
  let f = schedulers.get(retention)
  if (!f) {
    f = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true, enable_short_term: true }))
    schedulers.set(retention, f)
  }
  return f
}

export function newMemoryState(now = Date.now()): MemoryState {
  return fromFsrs(createEmptyCard(new Date(now)))
}

export function toFsrs(s: MemoryState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: 0,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  }
}

export function fromFsrs(c: Card): MemoryState {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.getTime(),
  }
}

/** Kleiner deterministischer Hash, um Wiederholungen vor der Klausur zu verteilen. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Begrenzt den nächsten Termin auf die Tage kurz vor der Klausur.
 *
 * FSRS plant Wiederholungen für maximales Langzeitbehalten. Für eine Prüfung zählt
 * aber, dass jede Karte kurz vor dem Klausurtag noch einmal drankommt. Liegt der
 * nächste Termin nach der Klausur, wird er auf einen der letzten Tage davor gelegt
 * (verteilt, damit nicht alles am Vortag fällig ist).
 */
export function capToExam(due: number, now: number, examDate: string | undefined, cardId: string): number {
  if (!examDate) return due
  const examStart = parseIsoDate(examDate)
  const today = startOfDay(now)
  const daysLeft = Math.round((examStart - today) / DAY)
  if (daysLeft <= 1 || due < examStart) return due
  const spread = Math.min(3, daysLeft - 2)
  const offset = spread > 0 ? hash(cardId) % (spread + 1) : 0
  const target = addDays(examStart, -1 - offset)
  return Math.max(target, addDays(today, 1))
}

export function review(s: MemoryState, rating: Grade, now: number, retention: number, examDate: string | undefined, cardId: string): MemoryState {
  const next = fromFsrs(scheduler(retention).next(toFsrs(s), new Date(now), rating).card)
  // Nur Langzeit-Intervalle begrenzen; kurze Lernschritte (Minuten) bleiben unverändert.
  if (next.due - now >= DAY) next.due = capToExam(next.due, now, examDate, cardId)
  return next
}

/** Vorschau der nächsten Abstände für die vier Bewertungsknöpfe. */
export function previewIntervals(s: MemoryState, now: number, retention: number, examDate: string | undefined, cardId: string): Record<Grade, number> {
  const out = {} as Record<Grade, number>
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    out[r] = review(s, r, now, retention, examDate, cardId).due - now
  }
  return out
}

/** Wahrscheinlichkeit, die Karte zum Zeitpunkt `at` noch zu wissen (0 für neue Karten). */
export function retrievability(s: MemoryState, at: number, retention = 0.9): number {
  if (s.state === 0 || !s.last_review) return 0
  return scheduler(retention).get_retrievability(toFsrs(s), new Date(Math.max(at, s.last_review)), false)
}
