import Dexie from 'dexie'
import { db, withSyncedTimestamps, type CardReport, type Exam, type Homework, type PackageRecord, type Profile, type Reminder, type ReviewLog, type Semester, type Snapshot, type StudyCard, type Tombstone } from './db'

/**
 * Synchronisationsstand eines Profils. Jedes Gerät speichert seinen Stand als ein Dokument;
 * beim Abgleich werden zwei Dokumente zusammengeführt (neuerer Datensatz gewinnt,
 * Bewertungen werden vereinigt, Löschungen über Löschmarken übertragen).
 */
export interface SyncDoc {
  format: 'lernapp-sync'
  formatVersion: 1
  savedAt: number
  profile: Profile
  semesters: Semester[]
  exams: Exam[]
  cards: StudyCard[]
  reviews: ReviewLog[]
  packages: PackageRecord[]
  snapshots: Snapshot[]
  reports: CardReport[]
  homework: Homework[]
  /** Fehlt in Ständen älterer App-Versionen. */
  reminders?: Reminder[]
  tombstones: Tombstone[]
}

const TABLES = ['semesters', 'exams', 'cards', 'reviews', 'packages', 'snapshots', 'reports', 'homework', 'reminders'] as const
type TableName = (typeof TABLES)[number]
type Rec = { id: string; updatedAt?: number }

const table = (name: TableName) => db[name] as unknown as Dexie.Table<Rec, string>

export async function exportDoc(profileId: string): Promise<SyncDoc> {
  const profile = await db.profiles.get(profileId)
  if (!profile) throw new Error('Profil nicht gefunden.')
  const doc = { format: 'lernapp-sync', formatVersion: 1, savedAt: Date.now(), profile } as SyncDoc
  for (const t of TABLES) (doc[t] as Rec[]) = await table(t).where('profileId').equals(profileId).toArray()
  doc.tombstones = await db.tombstones.where('profileId').equals(profileId).toArray()
  return doc
}

export function parseSyncDoc(raw: unknown): SyncDoc {
  const d = raw as Partial<SyncDoc> | null
  if (!d || d.format !== 'lernapp-sync') throw new Error('Unbekanntes Synchronisationsformat.')
  if (d.formatVersion !== 1) throw new Error('Die Daten stammen aus einer neueren App-Version. Bitte App aktualisieren.')
  if (!d.profile?.id) throw new Error('Synchronisationsdaten unvollständig.')
  return {
    ...(d as SyncDoc),
    ...Object.fromEntries(TABLES.map((t) => [t, Array.isArray(d[t]) ? d[t] : []])),
    tombstones: Array.isArray(d.tombstones) ? d.tombstones : [],
  }
}

const newer = <T extends Rec>(a: T | undefined, b: T | undefined): T | undefined =>
  !a ? b : !b ? a : (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a

function byId<T extends Rec>(...lists: T[][]): Map<string, T> {
  const m = new Map<string, T>()
  for (const list of lists) for (const r of list) m.set(r.id, newer(m.get(r.id), r)!)
  return m
}

/** Führt zwei Stände zusammen. Reine Funktion, unabhängig von der Datenbank. */
export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  const tombs = new Map<string, Tombstone>()
  for (const t of [...a.tombstones, ...b.tombstones]) {
    const old = tombs.get(t.id)
    if (!old || t.deletedAt > old.deletedAt) tombs.set(t.id, t)
  }
  const deleted = (name: Tombstone['table'], r: Rec) => {
    const t = tombs.get(`${name}:${r.id}`)
    // Bewertungen und Meldungen werden nie bearbeitet, nur gelöscht – eine Löschmarke gilt immer.
    return !!t && (name === 'reviews' || name === 'reports' || t.deletedAt >= (r.updatedAt ?? 0))
  }

  const semesters = [...byId(a.semesters, b.semesters).values()].filter((s) => !deleted('semesters', s))
  const semesterIds = new Set(semesters.map((s) => s.id))
  // Prüfungen gelöschter Semester sind verwaist und fallen ebenfalls weg.
  const exams = [...byId(a.exams, b.exams).values()].filter((e) => !deleted('exams', e) && semesterIds.has(e.semesterId))
  const examIds = new Set(exams.map((e) => e.id))
  const ofExam = <T extends Rec & { examId: string }>(list: T[]) => list.filter((r) => examIds.has(r.examId))

  const profile = newer(a.profile, b.profile)!
  const activeSemesterId =
    profile.activeSemesterId && semesterIds.has(profile.activeSemesterId) ? profile.activeSemesterId : semesters[semesters.length - 1]?.id

  return {
    format: 'lernapp-sync',
    formatVersion: 1,
    savedAt: Math.max(a.savedAt, b.savedAt),
    profile: { ...profile, activeSemesterId },
    semesters,
    exams,
    cards: ofExam([...byId(a.cards, b.cards).values()]),
    reviews: ofExam([...byId(a.reviews, b.reviews).values()].filter((r) => !deleted('reviews', r))),
    packages: ofExam([...byId(a.packages, b.packages).values()]),
    snapshots: ofExam([...byId(a.snapshots, b.snapshots).values()]),
    reports: ofExam([...byId(a.reports, b.reports).values()].filter((r) => !deleted('reports', r))),
    homework: ofExam([...byId(a.homework, b.homework).values()].filter((h) => !deleted('homework', h))),
    reminders: [...byId(a.reminders ?? [], b.reminders ?? []).values()].filter((r) => !deleted('reminders', r)),
    tombstones: [...tombs.values()],
  }
}

/** Kurzer Fingerabdruck, um unnötige Uploads und Schreibvorgänge zu vermeiden. */
export function docSignature(d: SyncDoc): string {
  const part = (list: Rec[]) => `${list.length}:${list.reduce((s, r) => s + (r.updatedAt ?? 0), 0)}`
  return [
    `${d.profile.updatedAt ?? 0}:${d.profile.activeSemesterId ?? ''}`,
    ...TABLES.map((t) => part((d[t] ?? []) as Rec[])),
    `${d.tombstones.length}:${d.tombstones.reduce((s, t) => s + t.deletedAt, 0)}`,
  ].join('|')
}

/**
 * Überträgt einen zusammengeführten Stand in die lokale Datenbank. `base` ist der lokale
 * Stand, aus dem zusammengeführt wurde: Was seitdem lokal geändert wurde (z. B. eine
 * Bewertung während des Abgleichs), wird nicht überschrieben.
 */
export async function applyDoc(merged: SyncDoc, base: SyncDoc) {
  await db.transaction('rw', [db.profiles, db.tombstones, ...TABLES.map(table)], () =>
    withSyncedTimestamps(async () => {
      const localProfile = await db.profiles.get(merged.profile.id)
      if (!localProfile || (merged.profile.updatedAt ?? 0) > (localProfile.updatedAt ?? 0) || localProfile.activeSemesterId !== merged.profile.activeSemesterId) {
        await db.profiles.put({ ...merged.profile, updatedAt: Math.max(merged.profile.updatedAt ?? 0, localProfile?.updatedAt ?? 0) })
      }
      for (const name of TABLES) {
        const t = table(name)
        const incoming = (merged[name] ?? []) as Rec[]
        const current = await t.bulkGet(incoming.map((r) => r.id))
        const puts = incoming.filter((r, i) => !current[i] || (r.updatedAt ?? 0) > (current[i]!.updatedAt ?? 0))
        if (puts.length) await t.bulkPut(puts)

        const keep = new Set(incoming.map((r) => r.id))
        const gone = ((base[name] ?? []) as Rec[]).filter((r) => !keep.has(r.id))
        const now = await t.bulkGet(gone.map((r) => r.id))
        const removable = gone.filter((r, i) => now[i] && (now[i]!.updatedAt ?? 0) <= (r.updatedAt ?? 0)).map((r) => r.id)
        if (removable.length) await t.bulkDelete(removable)
      }
      await db.tombstones.bulkPut(merged.tombstones)
    }),
  )
}

/** Ersetzt alle Daten eines Profils (Wiederherstellung aus Sicherung oder Erstimport). */
export async function replaceProfile(doc: SyncDoc, keepTimestamps: boolean) {
  const pid = doc.profile.id
  await db.transaction('rw', [db.profiles, db.tombstones, ...TABLES.map(table)], async () => {
    const write = async () => {
      for (const name of TABLES) await table(name).where('profileId').equals(pid).delete()
      await db.profiles.put(doc.profile)
      for (const name of TABLES) await table(name).bulkPut((doc[name] ?? []) as Rec[])
      await db.tombstones.bulkPut(doc.tombstones)
    }
    await (keepTimestamps ? withSyncedTimestamps(write) : write())
  })
}
