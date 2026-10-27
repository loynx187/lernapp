import { db, type Exam, type PackageRecord, type Profile, type ReviewLog, type Semester, type Snapshot, type StudyCard } from './db'
import { BACKUP_FORMAT } from './packages'

export interface Backup {
  format: typeof BACKUP_FORMAT
  formatVersion: 1
  exportedAt: string
  profile: Profile
  semesters: Semester[]
  exams: Exam[]
  cards: StudyCard[]
  logs: ReviewLog[]
  packages: PackageRecord[]
  snapshots: Snapshot[]
}

export async function createBackup(profileId: string): Promise<Backup> {
  const profile = await db.profiles.get(profileId)
  if (!profile) throw new Error('Profil nicht gefunden.')
  return {
    format: BACKUP_FORMAT,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    profile,
    semesters: await db.semesters.where('profileId').equals(profileId).toArray(),
    exams: await db.exams.where('profileId').equals(profileId).toArray(),
    cards: await db.cards.where('profileId').equals(profileId).toArray(),
    logs: (await db.logs.where('profileId').equals(profileId).toArray()).map(({ id: _id, ...l }) => l),
    packages: await db.packages.where('profileId').equals(profileId).toArray(),
    snapshots: await db.snapshots.where('profileId').equals(profileId).toArray(),
  }
}

export function parseBackup(raw: unknown): Backup {
  const b = raw as Partial<Backup> | null
  if (!b || b.format !== BACKUP_FORMAT) throw new Error('Die Datei ist keine Lernapp-Sicherung.')
  if (b.formatVersion !== 1) throw new Error('Diese Sicherung stammt aus einer neueren App-Version.')
  if (!b.profile?.id || !Array.isArray(b.cards) || !Array.isArray(b.exams)) throw new Error('Die Sicherung ist unvollständig.')
  return b as Backup
}

/** Stellt ein Profil aus einer Sicherung wieder her; vorhandene Daten dieses Profils werden ersetzt. */
export async function restoreBackup(b: Backup) {
  const pid = b.profile.id
  const tables = [db.profiles, db.semesters, db.exams, db.cards, db.logs, db.packages, db.snapshots]
  await db.transaction('rw', tables, async () => {
    for (const t of [db.semesters, db.exams, db.cards, db.logs, db.packages, db.snapshots]) {
      await t.where('profileId').equals(pid).delete()
    }
    await db.profiles.put(b.profile)
    await db.semesters.bulkPut(b.semesters ?? [])
    await db.exams.bulkPut(b.exams)
    await db.cards.bulkPut(b.cards)
    await db.logs.bulkAdd((b.logs ?? []).map(({ id: _id, ...l }) => l))
    await db.packages.bulkPut(b.packages ?? [])
    await db.snapshots.bulkPut(b.snapshots ?? [])
  })
}
