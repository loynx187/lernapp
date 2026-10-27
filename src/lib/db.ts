import Dexie, { type EntityTable } from 'dexie'

export type Mode = 'mobile' | 'desk'
export type CardType = 'basic' | 'cloze' | 'mc' | 'task'

export interface Profile {
  id: string
  name: string
  createdAt: number
  /** Tägliches Zeitbudget in Minuten für den Unterwegs-Modus (Karten). */
  minutesMobile: number
  /** Tägliches Zeitbudget in Minuten für den Schreibtisch-Modus (Rechenaufgaben). */
  minutesDesk: number
  /** Zielwahrscheinlichkeit, eine Karte bei der Wiederholung noch zu wissen (FSRS). */
  retention: number
  activeSemesterId?: string
}

export interface Semester {
  id: string
  profileId: string
  name: string
  createdAt: number
}

export interface Exam {
  id: string
  profileId: string
  semesterId: string
  name: string
  /** Klausurtermin als YYYY-MM-DD (lokale Zeit). */
  date: string
  /** Wichtigkeit 1–3, beeinflusst die Verteilung des Zeitbudgets. */
  weight: number
  color: string
  createdAt: number
}

/** Inhalt einer Karte, wie er in einem Kartenpaket steht. */
export interface CardContent {
  uid: string
  type: CardType
  chapter?: string
  front: string
  back: string
  /** Multiple Choice: Antwortoptionen und Indizes der richtigen. */
  options?: string[]
  correct?: number[]
  /** Rechenaufgabe: Lösungsschritte und Endergebnis. */
  steps?: string[]
  result?: string
  source?: { file?: string; slide?: number | string }
  image?: string
  tags?: string[]
  /** Klausurrelevanz 1–3 (z. B. aus Altklausuren abgeleitet). */
  relevance?: number
  /** Überschreibt den Modus; Standard: Aufgaben am Schreibtisch, alles andere unterwegs. */
  mode?: Mode
}

/** FSRS-Zustand mit Zeitstempeln als Zahlen, damit Backups reines JSON bleiben. */
export interface MemoryState {
  due: number
  stability: number
  difficulty: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  /** 0 = neu, 1 = lernen, 2 = wiederholen, 3 = neu lernen */
  state: number
  last_review?: number
}

export interface StudyCard extends CardContent {
  /** `${examId}:${packageId}:${uid}` */
  id: string
  profileId: string
  examId: string
  packageId: string
  chapterTitle?: string
  /** Position innerhalb des Pakets, bestimmt die Reihenfolge neuer Karten. */
  order: number
  archived: 0 | 1
  addedAt: number
  s: MemoryState
}

export interface ReviewLog {
  id?: number
  profileId: string
  examId: string
  cardId: string
  mode: Mode
  rating: number
  /** Zustand vor der Bewertung (0 = Karte war neu). */
  stateBefore: number
  reviewedAt: number
  durationMs: number
}

export interface PackageRecord {
  /** `${examId}:${packageId}` */
  id: string
  profileId: string
  examId: string
  packageId: string
  title: string
  version: number
  importedAt: number
  cardCount: number
}

export interface Snapshot {
  /** `${examId}:${YYYY-MM-DD}` */
  id: string
  profileId: string
  examId: string
  date: string
  total: number
  introduced: number
  secure: number
}

export const db = new Dexie('lernapp') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  semesters: EntityTable<Semester, 'id'>
  exams: EntityTable<Exam, 'id'>
  cards: EntityTable<StudyCard, 'id'>
  logs: EntityTable<ReviewLog, 'id'>
  packages: EntityTable<PackageRecord, 'id'>
  snapshots: EntityTable<Snapshot, 'id'>
}

db.version(1).stores({
  profiles: 'id',
  semesters: 'id, profileId',
  exams: 'id, profileId, semesterId',
  cards: 'id, profileId, examId, [examId+archived], packageId',
  logs: '++id, profileId, examId, cardId, reviewedAt',
  packages: 'id, profileId, examId',
  snapshots: 'id, profileId, examId',
})

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)

export const cardMode = (c: Pick<CardContent, 'type' | 'mode'>): Mode =>
  c.mode ?? (c.type === 'task' ? 'desk' : 'mobile')

export const MAX_EXAMS_PER_SEMESTER = 10

export const EXAM_COLORS = ['#0071e3', '#ff9500', '#34c759', '#af52de', '#ff2d55', '#5ac8fa', '#ffcc00', '#5856d6', '#a2845e', '#8e8e93']

/** Löscht ein Profil mit allen zugehörigen Daten. */
export async function deleteProfile(profileId: string) {
  await db.transaction('rw', [db.profiles, db.semesters, db.exams, db.cards, db.logs, db.packages, db.snapshots], async () => {
    for (const t of [db.semesters, db.exams, db.cards, db.logs, db.packages, db.snapshots] as const) {
      await (t as Dexie.Table).where('profileId').equals(profileId).delete()
    }
    await db.profiles.delete(profileId)
  })
}

/** Löscht eine Prüfung mit Karten, Verlauf und Paketen. */
export async function deleteExam(examId: string) {
  await db.transaction('rw', [db.exams, db.cards, db.logs, db.packages, db.snapshots], async () => {
    for (const t of [db.cards, db.logs, db.packages, db.snapshots] as const) {
      await (t as Dexie.Table).where('examId').equals(examId).delete()
    }
    await db.exams.delete(examId)
  })
}

export async function deleteSemester(semesterId: string) {
  const exams = await db.exams.where('semesterId').equals(semesterId).toArray()
  for (const e of exams) await deleteExam(e.id)
  await db.semesters.delete(semesterId)
}
