import { db, type Profile } from './db'
import { addDays, daysUntil, startOfDay } from './dates'
import { adoptPendingTokens, download, DropboxError, listFolder, upload } from './dropbox'
import { loadStudyData, type StudyData } from './study'
import { applyDoc, docSignature, exportDoc, mergeDocs, parseSyncDoc, replaceProfile, type SyncDoc } from './sync'

const syncPath = (profileId: string) => `/sync/${profileId}.lernsync`
export const REMINDER_PATH = '/Erinnerung.txt'

async function encode(doc: SyncDoc): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new TextEncoder().encode(JSON.stringify(doc))
  if (typeof CompressionStream === 'undefined') return bytes
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decode(data: Uint8Array<ArrayBuffer>): Promise<SyncDoc> {
  let bytes = data
  // gzip erkennt man an den ersten beiden Bytes; ältere Browser speichern unkomprimiert.
  if (data[0] === 0x1f && data[1] === 0x8b) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))
    bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  }
  return parseSyncDoc(JSON.parse(new TextDecoder().decode(bytes)))
}

export interface SyncStatus {
  lastSync?: number
  error?: string
}

const statusKey = (profileId: string) => `syncstatus:${profileId}`

export async function getSyncStatus(profileId: string): Promise<SyncStatus> {
  return ((await db.meta.get(statusKey(profileId)))?.value as SyncStatus | undefined) ?? {}
}

async function setSyncStatus(profileId: string, s: SyncStatus) {
  await db.meta.put({ key: statusKey(profileId), value: s })
}

/**
 * Gleicht ein Profil mit Dropbox ab: herunterladen, zusammenführen, lokal übernehmen,
 * hochladen. Hat ein anderes Gerät zwischenzeitlich hochgeladen, wird neu begonnen.
 */
export async function syncProfile(profileId: string, now = Date.now()) {
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await download(profileId, syncPath(profileId))
      const base = await exportDoc(profileId)
      const remoteDoc = remote ? await decode(remote.data) : undefined
      if (remoteDoc && remoteDoc.profile.id !== profileId) throw new DropboxError('Die Daten in Dropbox gehören zu einem anderen Profil.')
      const merged = remoteDoc ? mergeDocs(base, remoteDoc) : base
      if (docSignature(merged) !== docSignature(base)) await applyDoc(merged, base)
      if (!remoteDoc || docSignature(merged) !== docSignature(remoteDoc)) {
        try {
          await upload(profileId, syncPath(profileId), await encode({ ...merged, savedAt: now }), remote ? remote.rev : null)
        } catch (e) {
          if (e instanceof DropboxError && e.conflict) continue
          throw e
        }
      }
      await writeReminder(profileId, now).catch(() => {})
      await setSyncStatus(profileId, { lastSync: Date.now() })
      return
    }
    throw new DropboxError('Ein anderes Gerät synchronisiert gerade. Bitte gleich noch einmal versuchen.')
  } catch (e) {
    const prev = await getSyncStatus(profileId)
    await setSyncStatus(profileId, { ...prev, error: (e as Error).message })
    throw e
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Text für die tägliche Erinnerung (Kurzbefehle-Automation liest die Datei aus Dropbox). */
export function reminderText(profile: Profile, today: StudyData, tomorrow: StudyData, now: number): string {
  const left = (d: StudyData) => d.plan.modes.mobile.reviewsLeft + d.plan.modes.mobile.newLeft + d.plan.modes.desk.reviewsLeft + d.plan.modes.desk.newLeft
  const useToday = left(today) > 0
  const d = useToday ? today : tomorrow
  const day = useToday ? now : addDays(startOfDay(now), 1)
  const lines = [`Lernplan ${new Date(day).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}`]
  const m = d.plan.modes.mobile
  const k = d.plan.modes.desk
  if (m.reviewsLeft + m.newLeft) lines.push(`Unterwegs: ${plural(m.reviewsLeft + m.newLeft, 'Karte', 'Karten')} · ca. ${m.minutesLeft} min`)
  if (k.reviewsLeft + k.newLeft) lines.push(`Schreibtisch: ${plural(k.reviewsLeft + k.newLeft, 'Aufgabe', 'Aufgaben')} · ca. ${k.minutesLeft} min`)
  if (lines.length === 1) lines.push('Nichts fällig – gut gemacht!')
  const next = d.exams.find((e) => daysUntil(e.date, day) >= 0)
  if (next) lines.push(`Nächste Klausur: ${next.name} in ${plural(daysUntil(next.date, day), 'Tag', 'Tagen')}`)
  if (profile.name) lines[0] = `${lines[0]} (${profile.name})`
  return lines.join('\n')
}

async function writeReminder(profileId: string, now: number) {
  const profile = await db.profiles.get(profileId)
  if (!profile) return
  const today = await loadStudyData(profile, now)
  const tomorrow = await loadStudyData(profile, addDays(startOfDay(now), 1) + 7 * 3600_000)
  await upload(profileId, REMINDER_PATH, reminderText(profile, today, tomorrow, now))
}

export interface RemoteProfile {
  doc: SyncDoc
  path: string
}

/** Profile, die in der verbundenen Dropbox liegen (für die Einrichtung eines neuen Geräts). */
export async function listRemoteProfiles(tokenOwner: string): Promise<RemoteProfile[]> {
  const files = (await listFolder(tokenOwner, '/sync')).filter((f) => f.name.endsWith('.lernsync'))
  const out: RemoteProfile[] = []
  for (const f of files) {
    const d = await download(tokenOwner, f.path)
    if (d) out.push({ doc: await decode(d.data), path: f.path })
  }
  return out
}

/** Holt ein Profil aus Dropbox auf dieses Gerät und verbindet es dauerhaft. */
export async function importRemoteProfile(r: RemoteProfile) {
  const exists = await db.profiles.get(r.doc.profile.id)
  await adoptPendingTokens(r.doc.profile.id)
  if (exists) await syncProfile(r.doc.profile.id)
  else await replaceProfile(r.doc, true)
  await setSyncStatus(r.doc.profile.id, { lastSync: Date.now() })
}
