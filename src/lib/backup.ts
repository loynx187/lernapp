import { uid, type ReviewLog } from './db'
import { BACKUP_FORMAT } from './packages'
import { exportDoc, parseSyncDoc, replaceProfile, type SyncDoc } from './sync'

/** Sicherungsdatei: derselbe Inhalt wie ein Synchronisationsstand, nur mit eigenem Formatnamen. */
export type Backup = Omit<SyncDoc, 'format' | 'formatVersion'> & { format: typeof BACKUP_FORMAT; formatVersion: 2; exportedAt: string }

export async function createBackup(profileId: string): Promise<Backup> {
  const { format: _f, formatVersion: _v, ...doc } = await exportDoc(profileId)
  return { format: BACKUP_FORMAT, formatVersion: 2, exportedAt: new Date().toISOString(), ...doc }
}

export function parseBackup(raw: unknown): Backup {
  const b = raw as (Partial<Omit<Backup, 'formatVersion'>> & { formatVersion?: number; logs?: Omit<ReviewLog, 'id'>[] }) | null
  if (!b || b.format !== BACKUP_FORMAT) throw new Error('Die Datei ist keine Lernapp-Sicherung.')
  if (b.formatVersion !== 1 && b.formatVersion !== 2) throw new Error('Diese Sicherung stammt aus einer neueren App-Version.')
  if (!b.profile?.id || !Array.isArray(b.cards) || !Array.isArray(b.exams)) throw new Error('Die Sicherung ist unvollständig.')
  // Version 1 speicherte Bewertungen als „logs“ ohne geräteübergreifende ID.
  const reviews = b.formatVersion === 1 ? (b.logs ?? []).map((l) => ({ ...l, id: uid() })) : b.reviews
  const doc = parseSyncDoc({ ...b, format: 'lernapp-sync', formatVersion: 1, savedAt: Date.parse(b.exportedAt ?? '') || Date.now(), reviews })
  return { ...doc, format: BACKUP_FORMAT, formatVersion: 2, exportedAt: b.exportedAt ?? new Date().toISOString() }
}

/** Stellt ein Profil aus einer Sicherung wieder her; vorhandene Daten dieses Profils werden ersetzt. */
export async function restoreBackup(b: Backup) {
  const { exportedAt: _e, ...doc } = b
  // Neue Zeitstempel, damit der wiederhergestellte Stand bei der nächsten Synchronisation gewinnt.
  await replaceProfile({ ...doc, format: 'lernapp-sync', formatVersion: 1 }, false)
}
