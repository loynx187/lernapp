import type { Exam, Mode, ReviewLog, StudyCard } from './db'
import { cardMode } from './db'
import { DEFAULT_COSTS, type Costs, type DoneToday } from './planner'
import { DAY, isoDate, parseIsoDate, startOfDay } from './dates'
import { retrievability } from './scheduler'

/** Ab dieser Abrufwahrscheinlichkeit am Klausurtag gilt eine Karte als sicher. */
export const SECURE_THRESHOLD = 0.9

export interface ChapterStats {
  chapter: string
  title: string
  total: number
  introduced: number
  /** Durchschnittliche aktuelle Abrufwahrscheinlichkeit der begonnenen Karten. */
  recall: number
}

export interface ExamStats {
  total: number
  introduced: number
  /** Karten, die man voraussichtlich auch ohne weitere Wiederholung am Klausurtag noch weiß. */
  secure: number
  /** Durchschnittliche Abrufwahrscheinlichkeit der begonnenen Karten jetzt. */
  recall: number
  chapters: ChapterStats[]
}

export function examStats(exam: Exam, cards: StudyCard[], now: number, retention: number): ExamStats {
  const active = cards.filter((c) => !c.archived)
  const examAt = Math.max(now, parseIsoDate(exam.date))
  let introduced = 0
  let secure = 0
  let recallSum = 0
  const chapters = new Map<string, ChapterStats & { recallSum: number }>()
  for (const c of active) {
    const key = c.chapter ?? ''
    let ch = chapters.get(key)
    if (!ch) {
      ch = { chapter: key, title: c.chapterTitle ?? (key || 'Ohne Kapitel'), total: 0, introduced: 0, recall: 0, recallSum: 0 }
      chapters.set(key, ch)
    }
    ch.total++
    if (c.s.state === 0) continue
    introduced++
    ch.introduced++
    const r = retrievability(c.s, now, retention)
    recallSum += r
    ch.recallSum += r
    if (retrievability(c.s, examAt, retention) >= SECURE_THRESHOLD) secure++
  }
  return {
    total: active.length,
    introduced,
    secure,
    recall: introduced ? recallSum / introduced : 0,
    chapters: [...chapters.values()].map(({ recallSum: sum, ...ch }) => ({ ...ch, recall: ch.introduced ? sum / ch.introduced : 0 })),
  }
}

/** Erster Durchgang je Karte am heutigen Tag. */
export function doneToday(logs: ReviewLog[], now: number): DoneToday[] {
  const start = startOfDay(now)
  const seen = new Set<string>()
  const out: DoneToday[] = []
  for (const l of [...logs].sort((a, b) => a.reviewedAt - b.reviewedAt)) {
    if (l.reviewedAt < start || seen.has(l.cardId)) continue
    seen.add(l.cardId)
    out.push({ examId: l.examId, mode: l.mode, wasNew: l.stateBefore === 0 })
  }
  return out
}

/**
 * Schätzt aus den eigenen Lernzeiten, wie lange neue Karten und Wiederholungen dauern.
 * Bei wenig Daten wird mit Standardwerten gemischt.
 */
export function estimateCosts(logs: ReviewLog[]): Record<Mode, Costs> {
  const out = {} as Record<Mode, Costs>
  for (const mode of ['mobile', 'desk'] as Mode[]) {
    const cap = mode === 'mobile' ? 5 * 60_000 : 60 * 60_000
    const ml = logs.filter((l) => l.mode === mode)
    // Neue Karte: alle Durchgänge am Tag ihrer Einführung zusammen.
    const introDay = new Map<string, string>()
    for (const l of ml) if (l.stateBefore === 0) introDay.set(l.cardId, isoDate(l.reviewedAt))
    const newTotals = new Map<string, number>()
    const reviewDurations: number[] = []
    for (const l of ml) {
      const d = Math.min(l.durationMs, cap)
      if (introDay.get(l.cardId) === isoDate(l.reviewedAt)) newTotals.set(l.cardId, (newTotals.get(l.cardId) ?? 0) + d)
      else reviewDurations.push(d)
    }
    const blend = (values: number[], fallback: number) => {
      const n = Math.min(values.length, 30)
      if (!values.length) return fallback
      const mean = values.reduce((a, b) => a + b, 0) / values.length / 1000
      return (mean * n + fallback * (30 - n)) / 30
    }
    const def = DEFAULT_COSTS[mode]
    out[mode] = { newCard: blend([...newTotals.values()], def.newCard), review: blend(reviewDurations, def.review) }
  }
  return out
}

/** Aufeinanderfolgende Tage mit mindestens einer Lerneinheit (heute zählt, falls schon gelernt). */
export function streak(logs: ReviewLog[], now: number): number {
  const days = new Set(logs.map((l) => isoDate(l.reviewedAt)))
  let t = startOfDay(now)
  if (!days.has(isoDate(t))) t -= DAY
  let n = 0
  while (days.has(isoDate(t))) {
    n++
    t = startOfDay(t - DAY / 2)
  }
  return n
}

export const toPlanCard = (c: StudyCard) => ({
  id: c.id,
  examId: c.examId,
  mode: cardMode(c),
  state: c.s.state,
  due: c.s.due,
  order: c.order,
  relevance: c.relevance,
})
