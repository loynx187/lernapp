import { cardMode, type StudyCard } from './db'
import { retrievability } from './scheduler'

/** Ab so wenigen Tagen vor der Klausur stehen Aufgaben aus Alt- und Probeklausuren ganz oben. */
export const PAST_EXAM_FOCUS_DAYS = 21

export interface TaskRecommendation {
  /** Höher = früher empfohlen. */
  score: number
  /** Begründung für die Anzeige, wichtigste zuerst. */
  reasons: string[]
}

/** Themen einer Karte: ausdrückliche `topics` (paketübergreifend), sonst das Kapitel im eigenen Paket. */
export function topicKeys(c: Pick<StudyCard, 'examId' | 'packageId' | 'chapter' | 'topics'>): string[] {
  if (c.topics?.length) return c.topics.map((t) => `${c.examId}#${t.trim().toLowerCase()}`)
  return [`${c.examId}:${c.packageId}:${c.chapter ?? ''}`]
}

interface TopicState {
  total: number
  introduced: number
  /** Begonnene Karten, die schon vergessen wurden oder deren Abrufwahrscheinlichkeit gesunken ist. */
  weak: number
}

/** Eine begonnene Karte gilt als Schwäche, wenn sie schon einmal vergessen wurde oder gerade unsicher ist. */
const isWeak = (c: StudyCard, now: number, retention: number) => c.s.lapses > 0 || retrievability(c.s, now, retention) < 0.75

/**
 * Bewertet neue Schreibtischaufgaben für die Empfehlung:
 * - Aufgaben aus Alt-/Probeklausuren zuerst – sie bereiten am besten auf die Klausur vor (in den letzten Wochen noch stärker),
 * - dann Themen, deren Karten man oft vergisst (Schwächen üben),
 * - Themen, deren Karten man schon begonnen hat, vor Themen, die man noch gar nicht kennt,
 * - klausurrelevante Aufgaben vor Zusatzstoff.
 */
export function rankTasks(cards: StudyCard[], daysLeft: Map<string, number>, now: number, retention: number): Map<string, TaskRecommendation> {
  const topics = new Map<string, TopicState>()
  for (const c of cards) {
    if (cardMode(c) !== 'mobile') continue
    for (const k of topicKeys(c)) {
      const t = topics.get(k) ?? { total: 0, introduced: 0, weak: 0 }
      t.total++
      if (c.s.state !== 0) {
        t.introduced++
        if (isWeak(c, now, retention)) t.weak++
      }
      topics.set(k, t)
    }
  }
  const out = new Map<string, TaskRecommendation>()
  for (const c of cards) {
    if (cardMode(c) !== 'desk' || c.s.state !== 0) continue
    let score = 0
    const reasons: string[] = []
    if (c.pastExam) {
      const soon = (daysLeft.get(c.examId) ?? Infinity) <= PAST_EXAM_FOCUS_DAYS
      score += soon ? 8 : 6
      reasons.push('Aufgabe aus einer Probe- bzw. Altklausur')
    }
    const linked = topicKeys(c)
      .map((k) => topics.get(k))
      .filter((t): t is TopicState => !!t && t.total > 0)
    if (linked.length) {
      const total = linked.reduce((s, t) => s + t.total, 0)
      const introduced = linked.reduce((s, t) => s + t.introduced, 0)
      const weak = linked.reduce((s, t) => s + t.weak, 0)
      const started = introduced / total
      if (weak > 0) {
        score += 1 + 2 * (weak / Math.max(1, introduced))
        reasons.push(weak === 1 ? 'Schwäche: 1 Karte zum Thema sitzt noch nicht' : `Schwäche: ${weak} Karten zum Thema sitzen noch nicht`)
      }
      if (started < 0.3) {
        // Probeklausur-Aufgaben bleiben auch dann weit oben – sie zeigen, was in der Klausur kommt.
        score -= c.pastExam ? 1 : 2
        reasons.push('Karten zum Thema noch kaum begonnen')
      } else {
        score += started
        if (!weak) reasons.push('Karten zum Thema schon gelernt')
      }
    }
    score += ((c.relevance ?? 2) - 2) * 0.5
    if ((c.relevance ?? 2) === 3 && !c.pastExam) reasons.push('klausurrelevant')
    out.set(c.id, { score, reasons })
  }
  return out
}
