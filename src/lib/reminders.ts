// Freie Erinnerungen („an etwas denken“), z. B. eine Hausaufgabe früher bearbeiten oder Feedback geben.
// Unabhängig vom Lernplan: Sie erscheinen ab ihrem Tag auf der Startseite und in der Kurzbefehle-Erinnerung.
import { db, tombstone, uid, type Exam, type Homework, type Reminder } from './db'
import { addDays, daysUntil, isoDate } from './dates'
import { slugify } from './package-format'
import { matchExam } from './profile'

export const REMINDERS_FORMAT = 'lernapp-erinnerungen'

/** Offen = nicht abgehakt und die verknüpfte Hausaufgabe (falls vorhanden) nicht erledigt. */
export function isOpenReminder(r: Reminder, homework: Map<string, Homework>) {
  if (r.doneAt) return false
  const h = r.homeworkId ? homework.get(r.homeworkId) : undefined
  return !h?.doneAt
}

/** Fällig = offen und der Tag ist erreicht. */
export const isDueReminder = (r: Reminder, homework: Map<string, Homework>, now = Date.now()) => isOpenReminder(r, homework) && daysUntil(r.date, now) <= 0

/** Offene Erinnerungen, die nächste zuerst. */
export const sortReminders = (list: Reminder[]) => [...list].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)

export async function saveReminder(r: Omit<Reminder, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) {
  const record: Reminder = { ...r, id: r.id ?? uid(), createdAt: r.createdAt ?? Date.now() }
  await db.reminders.put(record)
  return record
}

export const completeReminder = (r: Reminder, now = Date.now()) => db.reminders.update(r.id, { doneAt: now })
export const reopenReminder = (r: Reminder) => db.reminders.update(r.id, { doneAt: undefined })

/** Auf einen späteren Tag verschieben (Standard: morgen). */
export const postponeReminder = (r: Reminder, days = 1, now = Date.now()) => db.reminders.update(r.id, { date: isoDate(addDays(now, days)), doneAt: undefined })

export async function deleteReminder(r: Reminder) {
  await db.transaction('rw', db.reminders, db.tombstones, async () => {
    await db.reminders.delete(r.id)
    await db.tombstones.put(tombstone('reminders', r.id, r.profileId))
  })
}

/** Vorschlag für eine Erinnerung zu einer Hausaufgabe: zwei Tage vor der Abgabe, frühestens heute. */
export function homeworkReminderDate(h: Homework, now = Date.now()) {
  const d = daysUntil(h.due, now)
  return isoDate(addDays(now, Math.max(0, d - 2)))
}

export interface ReminderEntry {
  /** Stabile ID – dieselbe Erinnerung wird nicht doppelt angelegt. */
  id: string
  title: string
  note?: string
  date: string
  /** Prüfung über den Archiv-Ordner (wie im Auftrag) oder den Namen */
  exam?: string
}

/** Datei mit Erinnerungen (z. B. von Claude: „Feedback zum Pilot geben“). */
export function parseRemindersFile(raw: unknown): ReminderEntry[] {
  const r = raw as { format?: unknown; formatVersion?: unknown; reminders?: unknown }
  if (r?.format !== REMINDERS_FORMAT || !Array.isArray(r.reminders)) throw new Error('Die Datei enthält keine Erinnerungen.')
  if (r.formatVersion !== 1) throw new Error('Diese Erinnerungen stammen aus einer neueren App-Version. Bitte App aktualisieren.')
  const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
  return r.reminders.flatMap((e: Record<string, unknown>) =>
    e && isStr(e.id) && isStr(e.title) && isStr(e.date) && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
      ? [{ id: e.id.trim(), title: e.title.trim(), note: isStr(e.note) ? e.note.trim() : undefined, date: e.date, exam: isStr(e.exam) ? e.exam.trim() : undefined }]
      : [],
  )
}

/**
 * Legt Erinnerungen aus einer Datei an. Vorhandene oder bereits gelöschte (gleiche ID) werden
 * nicht erneut angelegt. Liefert die Zahl neuer Erinnerungen.
 */
export async function importReminders(profileId: string, entries: ReminderEntry[], exams: Exam[], now = Date.now()) {
  let added = 0
  for (const e of entries) {
    const id = `${profileId}:${e.id}`
    if ((await db.reminders.get(id)) || (await db.tombstones.get(`reminders:${id}`))) continue
    const exam = e.exam ? matchExam(exams, { slug: slugify(e.exam), name: e.exam }) : undefined
    await db.reminders.add({ id, profileId, title: e.title, note: e.note, date: e.date, examId: exam?.id, createdAt: now })
    added++
  }
  return added
}
