import type { Exam, Semester } from './db'
import type { BufferParams, PlanExam } from './planner'

export type SemesterKind = 'dual' | 'regulaer'

export interface SemesterKindInfo {
  label: string
  description: string
  /** Stichtag für neuen Stoff: Beginn der Prüfungsphase (erste Klausur) oder jede Klausur einzeln. */
  anchor: 'phase' | 'exam'
  buffer: BufferParams
}

export const SEMESTER_KINDS: Record<SemesterKind, SemesterKindInfo> = {
  dual: {
    label: 'Dual – kompakte Prüfungsphase',
    description:
      'Alle Klausuren innerhalb weniger Tage. Neuer Stoff aller Fächer wird bis vor Beginn der Prüfungsphase eingeführt; davor bleibt ein längerer Wiederholungspuffer (ca. 25 %, 5–14 Tage). In der Prüfungsphase selbst wird nur noch wiederholt – mit Fokus auf die jeweils nächste Klausur.',
    anchor: 'phase',
    buffer: { share: 0.25, min: 5, max: 14 },
  },
  regulaer: {
    label: 'Regulär – entzerrte Prüfungsphase',
    description:
      'Klausuren über mehrere Wochen verteilt. Jedes Fach hat seinen eigenen Zeitplan bis zu seiner Klausur (Puffer ca. 20 %, 2–10 Tage); nach einer Klausur bekommen die übrigen Fächer automatisch mehr Zeit.',
    anchor: 'exam',
    buffer: { share: 0.2, min: 2, max: 10 },
  },
}

/** Semester ohne festgelegte Art verhalten sich wie bisher (regulär). */
export const semesterKind = (s?: Pick<Semester, 'kind'>): SemesterKind => s?.kind ?? 'regulaer'

/** Prüfungen mit dem Stichtag für neuen Stoff gemäß Semesterart. */
export function planExams(exams: Exam[], semester?: Pick<Semester, 'kind'>): PlanExam[] {
  const info = SEMESTER_KINDS[semesterKind(semester)]
  const phaseStart = exams.reduce<string | undefined>((min, e) => (!min || e.date < min ? e.date : min), undefined)
  return exams.map((e) => ({ id: e.id, date: e.date, weight: e.weight, introBy: info.anchor === 'phase' ? phaseStart : undefined }))
}
