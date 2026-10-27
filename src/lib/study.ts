import { db, type Exam, type Mode, type Profile, type ReviewLog, type StudyCard } from './db'
import { DAY, isoDate } from './dates'
import { planDay, type DayPlan } from './planner'
import { review, type Grade } from './scheduler'
import { doneToday, estimateCosts, examStats, toPlanCard } from './stats'

export interface StudyData {
  exams: Exam[]
  cards: StudyCard[]
  logs: ReviewLog[]
  plan: DayPlan
}

/** Lädt alles, was für Tagesplan und Lernsitzung des aktiven Semesters nötig ist. */
export async function loadStudyData(profile: Profile, now = Date.now()): Promise<StudyData> {
  const exams = profile.activeSemesterId ? await db.exams.where('semesterId').equals(profile.activeSemesterId).toArray() : []
  exams.sort((a, b) => a.date.localeCompare(b.date))
  const cards = (await Promise.all(exams.map((e) => db.cards.where('[examId+archived]').equals([e.id, 0]).toArray()))).flat()
  const examIds = new Set(exams.map((e) => e.id))
  const logs = await db.logs
    .where('reviewedAt')
    .above(now - 60 * DAY)
    .filter((l) => l.profileId === profile.id)
    .toArray()
  const plan = planDay({
    now,
    exams,
    cards: cards.map(toPlanCard),
    done: doneToday(
      logs.filter((l) => examIds.has(l.examId)),
      now,
    ),
    budgetMinutes: { mobile: profile.minutesMobile, desk: profile.minutesDesk },
    costs: estimateCosts(logs),
  })
  return { exams, cards, logs, plan }
}

export interface Undo {
  card: StudyCard
  logId: number
}

export async function recordReview(
  profile: Profile,
  exam: Exam | undefined,
  card: StudyCard,
  rating: Grade,
  mode: Mode,
  durationMs: number,
  now = Date.now(),
): Promise<{ updated: StudyCard; undo: Undo }> {
  const updated: StudyCard = { ...card, s: review(card.s, rating, now, profile.retention, exam?.date, card.id) }
  let logId = 0
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.cards.put(updated)
    logId = (await db.logs.add({
      profileId: profile.id,
      examId: card.examId,
      cardId: card.id,
      mode,
      rating,
      stateBefore: card.s.state,
      reviewedAt: now,
      durationMs,
    })) as number
  })
  return { updated, undo: { card, logId } }
}

export async function undoReview(u: Undo) {
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.cards.put(u.card)
    await db.logs.delete(u.logId)
  })
}

/** Speichert den heutigen Stand jeder Prüfung für den Verlaufsgraphen. */
export async function updateSnapshots(profile: Profile, exams: Exam[], cards: StudyCard[], now = Date.now()) {
  const date = isoDate(now)
  const rows = exams
    .filter((e) => e.date >= date)
    .map((e) => {
      const st = examStats(
        e,
        cards.filter((c) => c.examId === e.id),
        now,
        profile.retention,
      )
      return { id: `${e.id}:${date}`, profileId: profile.id, examId: e.id, date, total: st.total, introduced: st.introduced, secure: st.secure }
    })
  if (rows.length) await db.snapshots.bulkPut(rows)
}
