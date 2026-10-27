import { cardMode, type StudyCard } from './db'

/** Geschätzte Bearbeitungszeit in Minuten für eine Aufgabe in der Probeklausur. */
export const itemMinutes = (c: StudyCard) => (cardMode(c) === 'desk' ? 10 : c.type === 'mc' ? 1 : 2)

/** Anteil der Zeit für Rechenaufgaben, sofern das Fach welche hat. */
const TASK_SHARE = 0.7

const relevanceWeight = (c: StudyCard) => ({ 1: 0.4, 2: 1, 3: 2.5 })[c.relevance ?? 2] ?? 1

/** Zufällige Auswahl mit Gewichten (höhere Relevanz = häufiger). */
function weightedPick<T>(items: T[], weight: (t: T) => number, random: () => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0)
  let r = random() * total
  for (const t of items) {
    r -= weight(t)
    if (r <= 0) return t
  }
  return items[items.length - 1]
}

/**
 * Stellt eine Probeklausur für die angegebene Dauer zusammen: überwiegend Rechenaufgaben
 * (falls vorhanden), Kapitel reihum für eine breite Abdeckung, klausurrelevante Karten bevorzugt.
 */
export function composeMockExam(cards: StudyCard[], minutes: number, random: () => number = Math.random): StudyCard[] {
  const pool = cards.filter((c) => !c.archived)
  const tasks = pool.filter((c) => cardMode(c) === 'desk')
  const questions = pool.filter((c) => cardMode(c) !== 'desk')
  const taskBudget = tasks.length ? minutes * (questions.length ? TASK_SHARE : 1) : 0
  const picked = [...pickByChapter(tasks, taskBudget, random)]
  const used = picked.reduce((s, c) => s + itemMinutes(c), 0)
  picked.push(...pickByChapter(questions, minutes - used, random))
  // Reihenfolge wie im Skript – wie in einer echten Klausur nach Themen geordnet
  return picked.sort((a, b) => a.order - b.order)
}

function pickByChapter(cards: StudyCard[], minutes: number, random: () => number): StudyCard[] {
  const byChapter = new Map<string, StudyCard[]>()
  for (const c of cards) {
    const key = c.chapter ?? ''
    byChapter.set(key, [...(byChapter.get(key) ?? []), c])
  }
  const chapters = [...byChapter.values()]
  const out: StudyCard[] = []
  let left = minutes
  let progress = true
  while (left > 0 && progress) {
    progress = false
    for (const list of chapters) {
      const fitting = list.filter((c) => itemMinutes(c) <= left)
      if (!fitting.length) continue
      const c = weightedPick(fitting, relevanceWeight, random)
      list.splice(list.indexOf(c), 1)
      out.push(c)
      left -= itemMinutes(c)
      progress = true
      if (left <= 0) break
    }
  }
  return out
}

export type Grade = 'richtig' | 'teilweise' | 'falsch'

export const GRADE_POINTS: Record<Grade, number> = { richtig: 1, teilweise: 0.5, falsch: 0 }

export interface ChapterScore {
  title: string
  points: number
  max: number
}

/** Punkte gewichtet nach Bearbeitungszeit, wie in einer Klausur. */
export function scoreMockExam(items: StudyCard[], grades: Record<string, Grade | undefined>) {
  let points = 0
  let max = 0
  const chapters = new Map<string, ChapterScore>()
  for (const c of items) {
    const w = itemMinutes(c)
    const p = GRADE_POINTS[grades[c.id] ?? 'falsch'] * w
    points += p
    max += w
    const key = c.chapter ?? ''
    const ch = chapters.get(key) ?? { title: c.chapterTitle ?? (key || 'Ohne Kapitel'), points: 0, max: 0 }
    ch.points += p
    ch.max += w
    chapters.set(key, ch)
  }
  return { points, max, share: max ? points / max : 0, chapters: [...chapters.values()] }
}
