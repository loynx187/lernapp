import type { Exam, Mode, PackageRecord, ReviewLog, StudyCard } from './db'
import { cardMode } from './db'
import { DEFAULT_COSTS, type Costs, type DoneToday } from './planner'
import { addDays, parseIsoDate, studyDate, studyDayStart } from './dates'
import { retrievability } from './scheduler'

/** Ab dieser Abrufwahrscheinlichkeit am Klausurtag gilt eine Karte als sicher. */
export const SECURE_THRESHOLD = 0.9

export interface ChapterStats {
  /** Eindeutig je Paket und Kapitel (Pakete nutzen oft dieselben Kapitel-IDs wie „k1“). */
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

/** Pakete in Lernreihenfolge: festgelegte Position, sonst Reihenfolge des ersten Imports. */
export function sortPackages(packages: PackageRecord[]): PackageRecord[] {
  const first = (p: PackageRecord) => p.firstImportedAt ?? p.importedAt
  const pos = (p: PackageRecord) => p.position ?? Number.MAX_SAFE_INTEGER
  return [...packages].sort((a, b) => a.examId.localeCompare(b.examId) || pos(a) - pos(b) || first(a) - first(b) || a.packageId.localeCompare(b.packageId))
}

/** Position jedes Pakets innerhalb seiner Prüfung (`${examId}:${packageId}` → 0, 1, …) in Lernreihenfolge. */
export function packageBlocks(packages: PackageRecord[]): Map<string, number> {
  const sorted = sortPackages(packages)
  const blocks = new Map<string, number>()
  const count = new Map<string, number>()
  for (const p of sorted) {
    const n = count.get(p.examId) ?? 0
    blocks.set(`${p.examId}:${p.packageId}`, n)
    count.set(p.examId, n + 1)
  }
  return blocks
}

const blockOf = (c: Pick<StudyCard, 'examId' | 'packageId'>, blocks?: Map<string, number>) => blocks?.get(`${c.examId}:${c.packageId}`) ?? 0

export function examStats(exam: Exam, cards: StudyCard[], now: number, retention: number, blocks?: Map<string, number>): ExamStats {
  const active = cards.filter((c) => !c.archived)
  const examAt = Math.max(now, parseIsoDate(exam.date))
  let introduced = 0
  let secure = 0
  let recallSum = 0
  const chapters = new Map<string, ChapterStats & { recallSum: number; sort: [number, number] }>()
  for (const c of active) {
    const key = `${c.packageId}:${c.chapter ?? ''}`
    let ch = chapters.get(key)
    if (!ch) {
      const title = c.chapterTitle ?? (c.chapter || 'Ohne Kapitel')
      ch = { chapter: key, title, total: 0, introduced: 0, recall: 0, recallSum: 0, sort: [blockOf(c, blocks), c.order] }
      chapters.set(key, ch)
    }
    ch.sort[1] = Math.min(ch.sort[1], c.order)
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
    chapters: [...chapters.values()]
      .sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1])
      .map(({ recallSum: sum, sort: _sort, ...ch }) => ({ ...ch, recall: ch.introduced ? sum / ch.introduced : 0 })),
  }
}

/** Erster Durchgang je Karte am heutigen Tag. */
export function doneToday(logs: ReviewLog[], now: number): DoneToday[] {
  const start = studyDayStart(now)
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
    for (const l of ml) if (l.stateBefore === 0) introDay.set(l.cardId, studyDate(l.reviewedAt))
    const newTotals = new Map<string, number>()
    const reviewDurations: number[] = []
    for (const l of ml) {
      const d = Math.min(l.durationMs, cap)
      if (introDay.get(l.cardId) === studyDate(l.reviewedAt)) newTotals.set(l.cardId, (newTotals.get(l.cardId) ?? 0) + d)
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
  const days = new Set(logs.map((l) => studyDate(l.reviewedAt)))
  const prev = (d: string) => studyDate(addDays(parseIsoDate(d), -1) + 12 * 3600_000)
  let d = studyDate(now)
  if (!days.has(d)) d = prev(d)
  let n = 0
  while (days.has(d)) {
    n++
    d = prev(d)
  }
  return n
}

export const toPlanCard = (c: StudyCard, blocks?: Map<string, number>) => ({
  id: c.id,
  examId: c.examId,
  mode: cardMode(c),
  state: c.s.state,
  due: c.s.due,
  order: c.order,
  block: blockOf(c, blocks),
  relevance: c.relevance,
})
