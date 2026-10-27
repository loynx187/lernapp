import { db, type Exam, type ExamProfile, type ProfileField, type Semester } from './db'
import { isoDate } from './dates'
import { parseProfile, slugify } from './package-format'
import { openReportEntries } from './reports'
import { semesterKind } from './semesters'

export { slugify } from './package-format'

/** Auftrag an Claude: Prüfungen samt Fachprofil, vorhandenen Paketen und offenen Meldungen. */
export const ORDER_FORMAT = 'lernapp-auftrag'
/** Antwort von Claude: Fachprofile zum Importieren in die App. */
export const PROFILES_FORMAT = 'lernapp-fachprofile'

export const PROFILE_FIELDS: { key: Exclude<ProfileField, 'slug'>; label: string }[] = [
  { key: 'form', label: 'Prüfungsform' },
  { key: 'duration', label: 'Dauer' },
  { key: 'aids', label: 'Hilfsmittel' },
  { key: 'taskShare', label: 'Rechenaufgaben' },
  { key: 'focus', label: 'Schwerpunkte' },
  { key: 'omit', label: 'Weglassen' },
  { key: 'notation', label: 'Notation' },
  { key: 'notes', label: 'Sonstiges' },
]

export const fieldLabel = (k: ProfileField) => PROFILE_FIELDS.find((f) => f.key === k)?.label ?? k

/** Ordner des Fachs im Inhalte-Archiv. */
export const examSlug = (exam: Exam) => exam.profile?.slug || slugify(exam.name)

/**
 * Übernimmt Vorschläge von Claude ins Fachprofil. Ohne `overwrite` nur in leere oder
 * noch unbestätigte Felder – was der Nutzer selbst eingetragen hat, bleibt.
 * Übernommene Felder gelten als Vorschlag, bis der Nutzer das Profil speichert.
 */
export function mergeProfile(current: ExamProfile | undefined, incoming: ExamProfile, overwrite: boolean) {
  const profile: ExamProfile = { ...current }
  const suggested = new Set(current?.suggested ?? [])
  const changed: ProfileField[] = []
  if (incoming.slug && !profile.slug) profile.slug = incoming.slug
  for (const { key } of PROFILE_FIELDS) {
    const value = incoming[key]
    if (value === undefined || value === profile[key]) continue
    if (!overwrite && profile[key] !== undefined && !suggested.has(key)) continue
    Object.assign(profile, { [key]: value })
    suggested.add(key)
    changed.push(key)
  }
  if (suggested.size) profile.suggested = [...suggested]
  else delete profile.suggested
  return { profile, changed }
}

/** Merkt sich den Archiv-Ordner, damit ein späteres Umbenennen der Prüfung die Zuordnung nicht verliert. */
export async function rememberSlugs(exams: Exam[]) {
  for (const e of exams) {
    if (!e.profile?.slug) await db.exams.update(e.id, { profile: { ...e.profile, slug: examSlug(e) } })
  }
}

export async function buildOrder(exams: Exam[], semester: Semester, now = Date.now()) {
  return {
    format: ORDER_FORMAT,
    formatVersion: 1,
    created: isoDate(now),
    semester: { name: semester.name, kind: semesterKind(semester) },
    exams: await Promise.all(
      exams.map(async (e) => {
        const { slug: _slug, suggested, ...profile } = e.profile ?? {}
        const packages = await db.packages.where('examId').equals(e.id).toArray()
        const reports = await openReportEntries(e.id)
        return {
          name: e.name,
          slug: examSlug(e),
          date: e.date,
          weight: e.weight,
          profile: Object.keys(profile).length ? profile : undefined,
          unconfirmed: suggested?.length ? suggested : undefined,
          packages: packages.map((p) => ({ id: p.packageId, title: p.title, version: p.version, cards: p.cardCount })),
          reports: reports.length ? reports : undefined,
        }
      }),
    ),
  }
}

export function orderText(order: Awaited<ReturnType<typeof buildOrder>>) {
  return `/kartenpaket ${order.exams.map((e) => e.name).join(', ')}\n\nAuftrag aus der Lernapp:\n\`\`\`json\n${JSON.stringify(order, null, 1)}\n\`\`\`\n`
}

export interface ProfileEntry {
  name?: string
  slug?: string
  profile: ExamProfile
}

export function parseProfilesFile(raw: unknown): ProfileEntry[] {
  const r = raw as { format?: unknown; exams?: unknown }
  if (r?.format !== PROFILES_FORMAT || !Array.isArray(r.exams)) throw new Error('Die Datei enthält keine Fachprofile.')
  return r.exams.flatMap((e: Record<string, unknown>) => {
    const profile = parseProfile(e?.profile)
    if (!profile) return []
    const slug = typeof e.slug === 'string' ? slugify(e.slug) : undefined
    return [{ name: typeof e.name === 'string' ? e.name : undefined, slug, profile: slug ? { ...profile, slug } : profile }]
  })
}

/** Zuordnung über den Archiv-Ordner, sonst über den Namen. */
export function matchExam(exams: Exam[], entry: ProfileEntry): Exam | undefined {
  return (
    (entry.slug && exams.find((e) => examSlug(e) === entry.slug)) ||
    (entry.name ? exams.find((e) => slugify(e.name) === slugify(entry.name!)) : undefined)
  )
}

export async function applyProfile(examId: string, incoming: ExamProfile, overwrite: boolean) {
  const exam = await db.exams.get(examId)
  if (!exam) return []
  const { profile, changed } = mergeProfile(exam.profile, incoming, overwrite)
  await db.exams.update(examId, { profile })
  return changed
}
