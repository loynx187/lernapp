import { db, tombstone, uid, type Exam, type Homework } from './db'
import { daysUntil } from './dates'
import { importPackage } from './packages'
import { PACKAGE_FORMAT, type CardPackage } from './package-format'

/** Ab so vielen Tagen vor der Abgabe erscheint eine Hausaufgabe von selbst in der Schreibtisch-Sitzung. */
export const HOMEWORK_DUE_SOON_DAYS = 3
/** Paket, in dem übernommene Hausaufgaben als Übungsaufgaben landen. */
export const HOMEWORK_PACKAGE_ID = 'hausaufgaben'

export const isOpen = (h: Homework) => !h.doneAt

/** Fällig = offen und Abgabe in höchstens HOMEWORK_DUE_SOON_DAYS Tagen (oder überfällig). */
export const isDueSoon = (h: Homework, now = Date.now()) => isOpen(h) && daysUntil(h.due, now) <= HOMEWORK_DUE_SOON_DAYS

/** Anzahl fälliger Hausaufgaben je Prüfung – zählen am Schreibtisch zum Pensum des Fachs. */
export function homeworkDueByExam(list: Homework[], now = Date.now()) {
  const map = new Map<string, number>()
  for (const h of list) if (isDueSoon(h, now)) map.set(h.examId, (map.get(h.examId) ?? 0) + 1)
  return map
}

/** Offene Hausaufgaben, die nächste Abgabe zuerst. */
export const sortOpen = (list: Homework[]) => list.filter(isOpen).sort((a, b) => a.due.localeCompare(b.due) || a.createdAt - b.createdAt)

/**
 * Minuten, die heute für Hausaufgaben eingeplant werden: Jede offene Hausaufgabe wird gleichmäßig
 * auf die Tage bis zur Abgabe verteilt (überfällige bzw. heute fällige ganz).
 */
export function homeworkMinutesToday(list: Homework[], now = Date.now()): number {
  return list.filter(isOpen).reduce((sum, h) => sum + h.minutes / Math.max(1, daysUntil(h.due, now)), 0)
}

export async function saveHomework(h: Omit<Homework, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) {
  const record: Homework = { ...h, id: h.id ?? uid(), createdAt: h.createdAt ?? Date.now() }
  await db.homework.put(record)
  return record
}

export async function completeHomework(h: Homework, solution?: { text?: string; image?: string }, now = Date.now()) {
  await db.homework.update(h.id, { doneAt: now, solution: solution?.text || undefined, solutionImage: solution?.image })
}

export async function reopenHomework(h: Homework) {
  await db.homework.update(h.id, { doneAt: undefined })
}

export async function deleteHomework(h: Homework) {
  await db.transaction('rw', db.homework, db.tombstones, async () => {
    await db.homework.delete(h.id)
    await db.tombstones.put(tombstone('homework', h.id, h.profileId))
  })
}

/** Text der Übungsaufgabe aus einer Hausaufgabe. */
function taskCard(h: Homework) {
  const back = [h.solution, h.solutionImage && `![Deine Lösung](${h.solutionImage})`].filter(Boolean).join('\n\n')
  return {
    uid: h.id,
    type: 'task' as const,
    mode: 'desk' as const,
    chapter: 'k1',
    front: `**${h.title}**${h.description.trim() ? `\n\n${h.description.trim()}` : ''}`,
    image: h.image,
    steps: [],
    result: back || 'Vergleiche mit deiner damaligen Lösung bzw. der Besprechung in der Vorlesung.',
    back: '',
    tags: ['Hausaufgabe'],
  }
}

/**
 * Übernimmt eine erledigte Hausaufgabe als Übungsaufgabe in die Wiederholung. Alle übernommenen
 * Hausaufgaben einer Prüfung bilden ein eigenes Paket – so bleiben sie bei späteren Übernahmen erhalten.
 */
export async function keepAsTask(h: Homework, exam: Exam, now = Date.now()) {
  await db.homework.update(h.id, { keptAt: now })
  const kept = (await db.homework.where('examId').equals(exam.id).toArray()).filter((x) => x.keptAt).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  const pkg: CardPackage = {
    format: PACKAGE_FORMAT,
    formatVersion: 1,
    id: HOMEWORK_PACKAGE_ID,
    title: 'Hausaufgaben',
    version: 1,
    chapters: [{ id: 'k1', title: 'Hausaufgaben' }],
    cards: kept.map(taskCard),
  }
  await importPackage(exam, pkg, now)
}

/** Verkleinert ein Foto auf max. 1400 px und speichert es als JPEG-Daten-URL. */
export async function imageToDataUrl(file: File, maxSize = 1400): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.75)
}
