import { db, type Profile } from './db'
import { addDays, daysUntil, isoWeek, studyDayStart } from './dates'
import { adoptPendingTokens, deleteFile, download, DropboxError, getRev, listFolder, upload } from './dropbox'
import { loadStudyData, type StudyData } from './study'
import { examStats, streak } from './stats'
import { applyDoc, docSignature, exportDoc, mergeDocs, parseSyncDoc, replaceProfile, type SyncDoc } from './sync'

const syncPath = (profileId: string) => `/sync/${profileId}.lernsync`
const backupFolder = (profileId: string) => `/backups/${profileId}`
export const REMINDER_PATH = '/Erinnerung.txt'
export const PROGRESS_PATH = '/Fortschritt.json'
/** So viele Wochensicherungen bleiben in Dropbox erhalten. */
const KEEP_BACKUPS = 8

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
  /** Dropbox-Version der Sync-Datei beim letzten Abgleich */
  rev?: string
  /** Fingerabdruck des lokalen Stands nach dem letzten Abgleich */
  localSig?: string
  reminder?: string
  progress?: string
  backupWeek?: string
}

const statusKey = (profileId: string) => `syncstatus:${profileId}`

export async function getSyncStatus(profileId: string): Promise<SyncStatus> {
  return ((await db.meta.get(statusKey(profileId)))?.value as SyncStatus | undefined) ?? {}
}

async function setSyncStatus(profileId: string, s: SyncStatus) {
  await db.meta.put({ key: statusKey(profileId), value: s })
}

/**
 * Gleicht ein Profil mit Dropbox ab. Zuerst wird nur die Dateiversion abgefragt:
 * - nichts geändert (weder hier noch anderswo) → fertig, kein Datentransfer
 * - nur hier geändert → hochladen
 * - anderswo geändert → herunterladen, zusammenführen, lokal übernehmen, hochladen
 * Hat ein anderes Gerät zwischenzeitlich hochgeladen, wird neu begonnen.
 */
export async function syncProfile(profileId: string, now = Date.now()) {
  const status = await getSyncStatus(profileId)
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const path = syncPath(profileId)
      const base = await exportDoc(profileId)
      const baseSig = docSignature(base)
      const remoteRev = await getRev(profileId, path)
      let rev: string
      let doc: SyncDoc

      try {
        if (remoteRev && remoteRev === status.rev) {
          // Seit dem letzten Abgleich hat kein anderes Gerät hochgeladen.
          rev = baseSig === status.localSig ? remoteRev : await upload(profileId, path, await encode({ ...base, savedAt: now }), remoteRev)
          doc = base
        } else {
          const remote = remoteRev ? await download(profileId, path) : null
          const remoteDoc = remote ? await decode(remote.data) : undefined
          if (remoteDoc && remoteDoc.profile.id !== profileId) throw new DropboxError('Die Daten in Dropbox gehören zu einem anderen Profil.')
          const merged = remoteDoc ? mergeDocs(base, remoteDoc) : base
          if (docSignature(merged) !== baseSig) await applyDoc(merged, base)
          rev =
            remote && remoteDoc && docSignature(merged) === docSignature(remoteDoc)
              ? remote.rev
              : await upload(profileId, path, await encode({ ...merged, savedAt: now }), remote ? remote.rev : null)
          doc = merged
        }
      } catch (e) {
        if (e instanceof DropboxError && e.conflict) continue
        throw e
      }

      const next: SyncStatus = { ...status, rev, localSig: docSignature(await exportDoc(profileId)), lastSync: Date.now(), error: undefined }
      const written = await writeReminder(profileId, now, status).catch(() => ({ reminder: status.reminder, progress: status.progress }))
      next.reminder = written.reminder
      next.progress = written.progress
      next.backupWeek = await weeklyBackup(profileId, doc, now, status.backupWeek).catch(() => status.backupWeek)
      await setSyncStatus(profileId, next)
      return
    }
    throw new DropboxError('Ein anderes Gerät synchronisiert gerade. Bitte gleich noch einmal versuchen.')
  } catch (e) {
    await setSyncStatus(profileId, { ...(await getSyncStatus(profileId)), error: (e as Error).message })
    throw e
  }
}

/** Legt einmal pro Kalenderwoche eine Sicherung in Dropbox ab und behält die letzten acht. */
async function weeklyBackup(profileId: string, doc: SyncDoc, now: number, lastWeek?: string): Promise<string> {
  const week = isoWeek(now)
  if (week === lastWeek) return week
  await upload(profileId, `${backupFolder(profileId)}/${week}.lernsync`, await encode({ ...doc, savedAt: now }))
  const old = (await listBackups(profileId)).slice(KEEP_BACKUPS)
  for (const b of old) await deleteFile(profileId, b.path)
  return week
}

export interface BackupEntry {
  week: string
  path: string
}

/** Wochensicherungen in Dropbox, neueste zuerst. */
export async function listBackups(profileId: string): Promise<BackupEntry[]> {
  return (await listFolder(profileId, backupFolder(profileId)))
    .filter((f) => f.name.endsWith('.lernsync'))
    .map((f) => ({ week: f.name.replace(/\.lernsync$/, ''), path: f.path }))
    .sort((a, b) => b.week.localeCompare(a.week))
}

/**
 * Setzt das Profil auf eine Wochensicherung zurück und überschreibt den Stand in Dropbox.
 * Was andere Geräte seitdem gelernt haben, kommt beim nächsten Abgleich dieser Geräte wieder dazu.
 */
export async function restoreBackup(profileId: string, entry: BackupEntry) {
  const d = await download(profileId, entry.path)
  if (!d) throw new DropboxError('Die Sicherung wurde nicht gefunden.')
  const doc = await decode(d.data)
  if (doc.profile.id !== profileId) throw new DropboxError('Die Sicherung gehört zu einem anderen Profil.')
  await replaceProfile(doc, false)
  const local = await exportDoc(profileId)
  const rev = await upload(profileId, syncPath(profileId), await encode({ ...local, savedAt: Date.now() }))
  await setSyncStatus(profileId, { ...(await getSyncStatus(profileId)), rev, localSig: docSignature(local), lastSync: Date.now(), error: undefined })
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Text für die tägliche Erinnerung (Kurzbefehle-Automation liest die Datei aus Dropbox). */
export function reminderText(profile: Profile, today: StudyData, tomorrow: StudyData, now: number): string {
  const left = (d: StudyData) => d.plan.modes.mobile.reviewsLeft + d.plan.modes.mobile.newLeft + d.plan.modes.desk.reviewsLeft + d.plan.modes.desk.newLeft
  const useToday = left(today) > 0
  const d = useToday ? today : tomorrow
  const day = useToday ? studyDayStart(now) : addDays(studyDayStart(now), 1)
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

/** Schreibt die Erinnerungsdatei, aber nur, wenn sich der Text geändert hat. */
/** Daten für das Scriptable-Widget (public/scriptable/lernapp-widget.js). */
export interface ProgressFile {
  format: 'lernapp-fortschritt'
  version: 1
  stand: string
  profil: string
  semester?: string
  heute: { karten: number; aufgaben: number; minuten: number }
  serie: number
  gesamt: { begonnen: number; prognose: number }
  pruefungen: { name: string; farbe: string; tage: number; begonnen: number; prognose: number; rueckstand: boolean }[]
}

export function progressSummary(profile: Profile, d: StudyData, now: number, semesterName?: string): ProgressFile {
  const m = d.plan.modes.mobile
  const k = d.plan.modes.desk
  let total = 0
  let introduced = 0
  let forecast = 0
  const pruefungen = d.plan.exams.flatMap((p) => {
    const exam = d.exams.find((e) => e.id === p.examId)
    if (!exam) return []
    const st = examStats(exam, d.cards.filter((c) => c.examId === exam.id), now, profile.retention)
    const prognose = p.forecastShare * profile.retention
    total += st.total
    introduced += st.introduced
    forecast += prognose * st.total
    const share = (x: number) => Math.round(x * 100) / 100
    return [{ name: exam.name, farbe: exam.color, tage: p.daysLeft, begonnen: share(st.total ? st.introduced / st.total : 0), prognose: share(prognose), rueckstand: p.behind && st.total > 0 }]
  })
  return {
    format: 'lernapp-fortschritt',
    version: 1,
    stand: new Date(now).toISOString(),
    profil: profile.name,
    semester: semesterName,
    heute: { karten: m.reviewsLeft + m.newLeft, aufgaben: k.reviewsLeft + k.newLeft, minuten: m.minutesLeft + k.minutesLeft },
    serie: streak(d.logs, now),
    gesamt: { begonnen: total ? Math.round((introduced / total) * 100) / 100 : 0, prognose: total ? Math.round((forecast / total) * 100) / 100 : 0 },
    pruefungen,
  }
}

/** Schreibt Erinnerung.txt und Fortschritt.json, jeweils nur, wenn sich der Inhalt geändert hat. */
async function writeReminder(profileId: string, now: number, last: SyncStatus): Promise<{ reminder?: string; progress?: string }> {
  const profile = await db.profiles.get(profileId)
  if (!profile) return last
  const today = await loadStudyData(profile, now)
  const tomorrow = await loadStudyData(profile, addDays(studyDayStart(now), 1) + 3 * 3600_000)
  const text = reminderText(profile, today, tomorrow, now)
  if (text !== last.reminder) await upload(profileId, REMINDER_PATH, text)
  const semester = profile.activeSemesterId ? await db.semesters.get(profile.activeSemesterId) : undefined
  const { stand: _stand, ...summary } = progressSummary(profile, today, now, semester?.name)
  const key = JSON.stringify(summary)
  // Der Zeitstempel allein ist kein Grund für einen Upload
  if (key !== last.progress) await upload(profileId, PROGRESS_PATH, JSON.stringify({ stand: new Date(now).toISOString(), ...summary }, null, 1))
  return { reminder: text, progress: key }
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
  if (!exists) await replaceProfile(r.doc, true)
  await syncProfile(r.doc.profile.id)
}
