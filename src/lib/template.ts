// Profil-Vorlage: alle Semester, Prüfungen und Kartenpakete eines Profils ohne Lernfortschritt –
// zum Weitergeben an Kommilitonen oder für einen Neustart. Bewertungen, Lernstand, Hausaufgaben,
// Meldungen und persönliche Einstellungen bleiben draußen.
import { db, EXAM_COLORS, MAX_EXAMS_PER_SEMESTER, uid, type Exam, type ExamProfile } from './db'
import { exportPackage, importPackage } from './packages'
import { parsePackage, parsePending, parseProfile, type CardPackage, type PendingInput } from './package-format'
import { HOMEWORK_PACKAGE_ID } from './homework'
import { chapterKey, openPending } from './pending'
import { applyPending, applyProfile } from './profile'
import { semesterKind, type SemesterKind } from './semesters'
import { sortPackages } from './stats'

export const TEMPLATE_FORMAT = 'lernapp-vorlage'

export interface TemplateExam {
  name: string
  date: string
  weight: number
  color: string
  ongoing?: boolean
  ongoingDays?: number
  profile?: ExamProfile
  /** Offene Erinnerungen an fehlende Unterlagen (ohne „zurückgestellt“). */
  pending?: PendingInput[]
  /** Pausierte Kapitel stehen als `later` in den Paketen. */
  packages: CardPackage[]
}

export interface TemplateSemester {
  name: string
  kind: SemesterKind
  /** Das beim Export aktive Semester – wird beim Import ausgewählt. */
  active?: boolean
  exams: TemplateExam[]
}

export interface ProfileTemplate {
  format: typeof TEMPLATE_FORMAT
  formatVersion: 1
  exportedAt: string
  semesters: TemplateSemester[]
}

export async function createTemplate(profileId: string): Promise<ProfileTemplate> {
  const profile = await db.profiles.get(profileId)
  const semesters = await db.semesters.where('profileId').equals(profileId).sortBy('createdAt')
  const out: TemplateSemester[] = []
  for (const s of semesters) {
    const exams = await db.exams.where('semesterId').equals(s.id).sortBy('date')
    const tExams: TemplateExam[] = []
    for (const e of exams) {
      const paused = new Set(e.pausedChapters ?? [])
      const records = sortPackages(await db.packages.where('examId').equals(e.id).toArray()).filter((p) => p.packageId !== HOMEWORK_PACKAGE_ID)
      const packages: CardPackage[] = []
      for (const r of records) {
        const pkg = await exportPackage(e, r.packageId)
        if (!pkg.cards.length) continue
        pkg.chapters = pkg.chapters?.map((c) => (paused.has(chapterKey({ packageId: r.packageId, chapter: c.id })) ? { ...c, later: true } : c))
        packages.push(pkg)
      }
      const pending = openPending(e).map(({ id, title, note, from, repeatDays }) => ({ id, title, note, from, repeatDays }))
      tExams.push({
        name: e.name,
        date: e.date,
        weight: e.weight,
        color: e.color,
        ongoing: e.ongoing || undefined,
        ongoingDays: e.ongoingDays,
        profile: e.profile,
        pending: pending.length ? pending : undefined,
        packages,
      })
    }
    out.push({ name: s.name, kind: semesterKind(s), active: s.id === profile?.activeSemesterId || undefined, exams: tExams })
  }
  return { format: TEMPLATE_FORMAT, formatVersion: 1, exportedAt: new Date().toISOString(), semesters: out }
}

const isStr = (v: unknown): v is string => typeof v === 'string'

/** Prüft eine Vorlage; ungültige Pakete führen zu einer verständlichen Fehlermeldung. */
export function parseTemplate(raw: unknown): ProfileTemplate {
  const t = raw as Partial<ProfileTemplate> | null
  if (!t || t.format !== TEMPLATE_FORMAT) throw new Error('Die Datei ist keine Lernapp-Vorlage.')
  if (t.formatVersion !== 1) throw new Error('Diese Vorlage stammt aus einer neueren App-Version. Bitte App aktualisieren.')
  if (!Array.isArray(t.semesters)) throw new Error('Die Vorlage enthält keine Semester.')
  const semesters = t.semesters.map((s): TemplateSemester => {
    if (!s || !isStr(s.name) || !Array.isArray(s.exams)) throw new Error('Die Vorlage enthält ein ungültiges Semester.')
    return {
      name: s.name,
      kind: s.kind === 'dual' ? 'dual' : 'regulaer',
      active: s.active === true || undefined,
      exams: s.exams.map((e): TemplateExam => {
        if (!e || !isStr(e.name) || !isStr(e.date) || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error('Die Vorlage enthält eine ungültige Prüfung.')
        return {
          name: e.name,
          date: e.date,
          weight: typeof e.weight === 'number' && e.weight > 0 ? e.weight : 1,
          color: isStr(e.color) ? e.color : EXAM_COLORS[0],
          ongoing: e.ongoing === true || undefined,
          ongoingDays: typeof e.ongoingDays === 'number' ? e.ongoingDays : undefined,
          profile: parseProfile(e.profile),
          pending: parsePending(e.pending),
          packages: Array.isArray(e.packages) ? e.packages.map((p) => parsePackage(p)) : [],
        }
      }),
    }
  })
  return { format: TEMPLATE_FORMAT, formatVersion: 1, exportedAt: isStr(t.exportedAt) ? t.exportedAt : '', semesters }
}

export interface TemplateResult {
  semestersAdded: number
  examsAdded: number
  examsUpdated: number
  packages: number
  cards: number
  /** Prüfungen, die wegen des Limits pro Semester nicht angelegt wurden. */
  skipped: string[]
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Übernimmt eine Vorlage ins Profil. Semester und Prüfungen werden über den Namen zugeordnet und
 * sonst neu angelegt; vorhandene Pakete werden aktualisiert, der Lernfortschritt bleibt erhalten.
 */
export async function importTemplate(profileId: string, t: ProfileTemplate, now = Date.now()): Promise<TemplateResult> {
  const result: TemplateResult = { semestersAdded: 0, examsAdded: 0, examsUpdated: 0, packages: 0, cards: 0, skipped: [] }
  let activeId: string | undefined
  for (const ts of t.semesters) {
    const semesters = await db.semesters.where('profileId').equals(profileId).toArray()
    let semester = semesters.find((s) => norm(s.name) === norm(ts.name))
    if (!semester) {
      semester = { id: uid(), profileId, name: ts.name, kind: ts.kind, createdAt: now }
      await db.semesters.add(semester)
      result.semestersAdded++
    }
    if (ts.active) activeId = semester.id
    for (const te of ts.exams) {
      const exams = await db.exams.where('semesterId').equals(semester.id).toArray()
      let exam: Exam | undefined = exams.find((e) => norm(e.name) === norm(te.name))
      if (exam) {
        if (te.profile) await applyProfile(exam.id, te.profile, false)
        result.examsUpdated++
      } else {
        if (exams.length >= MAX_EXAMS_PER_SEMESTER) {
          result.skipped.push(te.name)
          continue
        }
        exam = { id: uid(), profileId, semesterId: semester.id, name: te.name, date: te.date, weight: te.weight, color: te.color, createdAt: now, ongoing: te.ongoing, ongoingDays: te.ongoingDays, profile: te.profile }
        await db.exams.add(exam)
        result.examsAdded++
      }
      await applyPending(exam.id, te.pending)
      for (const pkg of te.packages) {
        const current = (await db.exams.get(exam.id))!
        // Je Paket ein eigener Zeitstempel, damit die Reihenfolge der Pakete erhalten bleibt.
        await importPackage(current, pkg, now + result.packages)
        result.packages++
        result.cards += pkg.cards.length
      }
    }
  }
  const profile = await db.profiles.get(profileId)
  if (activeId && profile) await db.profiles.update(profileId, { activeSemesterId: activeId })
  return result
}

/** Kurzbeschreibung für die Vorschau. */
export function templateSummary(t: ProfileTemplate) {
  const exams = t.semesters.flatMap((s) => s.exams)
  const packages = exams.flatMap((e) => e.packages)
  return { semesters: t.semesters.length, exams: exams.length, packages: packages.length, cards: packages.reduce((n, p) => n + p.cards.length, 0) }
}
