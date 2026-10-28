import { db, uid, type Exam, type PendingDoc } from './db'
import { addDays, studyDate } from './dates'

/** „Später“ verschiebt eine Erinnerung um so viele Tage. */
export const SNOOZE_DAYS = 7

/** Offen und heute fällig: weder erledigt noch zurückgestellt, Starttag erreicht. */
export function duePending(exam: Pick<Exam, 'pendingDocs'>, now = Date.now()): PendingDoc[] {
  const today = studyDate(now)
  return (exam.pendingDocs ?? []).filter((d) => !d.doneAt && (!d.from || d.from <= today) && (!d.snoozedUntil || d.snoozedUntil <= today))
}

/** Offene (nicht erledigte) Unterlagen, auch zurückgestellte. */
export const openPending = (exam: Pick<Exam, 'pendingDocs'>) => (exam.pendingDocs ?? []).filter((d) => !d.doneAt)

/** Übernimmt Erinnerungen aus einem Paket; bekannte IDs (auch erledigte) bleiben, wie sie sind. Liefert undefined ohne Änderung. */
export function mergePending(current: PendingDoc[] | undefined, incoming: Pick<PendingDoc, 'id' | 'title' | 'note' | 'from'>[] | undefined): PendingDoc[] | undefined {
  const list = current ?? []
  const known = new Set(list.map((d) => d.id))
  const added = (incoming ?? []).filter((d) => !known.has(d.id))
  return added.length ? [...list, ...added.map((d) => ({ ...d }))] : undefined
}

async function patch(exam: Exam, fn: (list: PendingDoc[]) => PendingDoc[]) {
  const current = await db.exams.get(exam.id)
  if (current) await db.exams.update(exam.id, { pendingDocs: fn(current.pendingDocs ?? []) })
}

export const addPending = (exam: Exam, title: string, from?: string) =>
  patch(exam, (list) => [...list, { id: uid(), title: title.trim(), from: from || undefined }])
export const completePending = (exam: Exam, id: string, now = Date.now()) => patch(exam, (list) => list.map((d) => (d.id === id ? { ...d, doneAt: now } : d)))
export const reopenPending = (exam: Exam, id: string) => patch(exam, (list) => list.map((d) => (d.id === id ? { ...d, doneAt: undefined, snoozedUntil: undefined } : d)))
export const snoozePending = (exam: Exam, id: string, now = Date.now()) =>
  patch(exam, (list) => list.map((d) => (d.id === id ? { ...d, snoozedUntil: studyDate(addDays(now, SNOOZE_DAYS)) } : d)))
export const removePending = (exam: Exam, id: string) => patch(exam, (list) => list.filter((d) => d.id !== id))

/** Schlüssel eines Kapitels innerhalb der Prüfung (wie in examStats). */
export const chapterKey = (c: { packageId: string; chapter?: string }) => `${c.packageId}:${c.chapter ?? ''}`

export async function toggleChapterPause(exam: Exam, key: string) {
  const current = await db.exams.get(exam.id)
  if (!current) return
  const paused = new Set(current.pausedChapters ?? [])
  if (paused.has(key)) paused.delete(key)
  else paused.add(key)
  await db.exams.update(exam.id, { pausedChapters: [...paused] })
}
