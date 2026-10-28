import type { Mode } from './db'
import { addDays, daysUntil, studyDayStart } from './dates'

/** Die Felder einer Karte, die der Planer braucht. */
export interface PlanCard {
  id: string
  examId: string
  mode: Mode
  /** FSRS-Zustand: 0 = neu */
  state: number
  due: number
  order: number
  /** Position des Pakets innerhalb der Prüfung (Reihenfolge des ersten Imports), siehe packageBlocks. */
  block?: number
  relevance?: number
}

export interface PlanExam {
  id: string
  date: string
  weight: number
  /** Datum, bis zu dem (abzüglich Puffer) neuer Stoff eingeführt sein soll. Standard: Klausurtermin. */
  introBy?: string
  /** Vorlesung läuft noch: vorhandener neuer Stoff soll innerhalb dieser Anzahl Tage begonnen werden. */
  introWithin?: number
}

/** Wiederholungspuffer vor dem Stichtag: Anteil der verbleibenden Tage, begrenzt auf min/max Tage. */
export interface BufferParams {
  share: number
  min: number
  max: number
}

export const DEFAULT_BUFFER: BufferParams = { share: 0.2, min: 2, max: 10 }

/** Was heute bereits gelernt wurde (je Karte nur der erste Durchgang des Tages). */
export interface DoneToday {
  examId: string
  mode: Mode
  wasNew: boolean
}

export interface Costs {
  /** Sekunden für eine neue Karte inkl. Lernschritten am selben Tag. */
  newCard: number
  /** Sekunden für eine Wiederholung. */
  review: number
}

export interface PlanInput {
  now: number
  exams: PlanExam[]
  cards: PlanCard[]
  done: DoneToday[]
  budgetMinutes: Record<Mode, number>
  costs: Record<Mode, Costs>
  buffer?: BufferParams
}

export interface ExamModePlan {
  /** Neue Karten, die noch gar nicht begonnen wurden. */
  newRemaining: number
  /** davon Kernstoff (Relevanz 2–3) */
  coreRemaining: number
  /** Neue Kernstoff-Karten pro Tag, damit er rechtzeitig vor der Klausur eingeführt ist. */
  quota: number
  /** Neue Zusatzstoff-Karten (Relevanz 1) pro Tag – nur, wenn das Budget nach dem Kernstoff reicht. */
  optionalQuota: number
  /** Neue Karten (Kern- und Zusatzstoff), die das Zeitbudget heute zulässt. */
  allowed: number
  newDoneToday: number
  /** Heute noch zu lernende neue Karten. */
  newLeft: number
  reviewsDue: number
  reviewsDoneToday: number
}

export interface ExamPlan {
  examId: string
  daysLeft: number
  /** Letzter Tag, an dem neuer Stoff eingeführt werden soll. */
  introDeadline: number
  modes: Record<Mode, ExamModePlan>
  /** Das Budget reicht nicht, um den Kernstoff rechtzeitig zu schaffen. */
  behind: boolean
  /** Erwarteter Anteil begonnener Karten zum Stichtag, wenn täglich das heutige Pensum gelernt wird. */
  forecastShare: number
}

export interface ModeTotals {
  reviewsLeft: number
  newLeft: number
  minutesLeft: number
  /** Minuten pro Tag, die nötig wären, um voll im Plan zu sein. */
  minutesNeeded: number
}

export interface DayPlan {
  exams: ExamPlan[]
  modes: Record<Mode, ModeTotals>
}

export const MODES: Mode[] = ['mobile', 'desk']

export const DEFAULT_COSTS: Record<Mode, Costs> = {
  mobile: { newCard: 60, review: 15 },
  desk: { newCard: 15 * 60, review: 8 * 60 },
}

/**
 * Anzahl Tage, an denen neuer Stoff eingeführt wird. Vor dem Stichtag bleibt ein Puffer,
 * in dem nur noch wiederholt wird (Standard: ca. 20 % der Zeit, 2–10 Tage), höchstens
 * aber die Hälfte der verbleibenden Zeit.
 */
export function introductionDays(daysLeft: number, buffer: BufferParams = DEFAULT_BUFFER): number {
  if (daysLeft <= 3) return Math.max(1, daysLeft - 1)
  const days = Math.min(buffer.max, Math.max(buffer.min, Math.round(daysLeft * buffer.share)))
  return daysLeft - Math.min(days, Math.floor(daysLeft / 2))
}

const isCore = (c: PlanCard) => (c.relevance ?? 2) >= 2

/** In den letzten Tagen vor der Klausur wird neuer Stoff paketübergreifend gemischt statt Paket für Paket. */
export const MIX_WITHIN_DAYS = 14

/**
 * Reihenfolge neuer Karten einer Prüfung: Kernstoff vor Zusatzstoff, sonst Paket für Paket
 * (Vorlesungsblöcke nacheinander) in Skript-Reihenfolge. `byRelevance` zieht klausurrelevante
 * Karten vor, `mix` wechselt die Pakete reihum ab – beides nur kurz vor der Klausur (MIX_WITHIN_DAYS).
 */
export function orderNew(cards: PlanCard[], mix: boolean, byRelevance: boolean): PlanCard[] {
  const byScript = (a: PlanCard, b: PlanCard) => (a.block ?? 0) - (b.block ?? 0) || a.order - b.order
  const rank = new Map<string, number>()
  if (mix) {
    // Position innerhalb des eigenen Pakets – gleiche Positionen verschiedener Pakete wechseln sich ab.
    const seen = new Map<number, number>()
    for (const c of [...cards].sort(byScript)) {
      const n = seen.get(c.block ?? 0) ?? 0
      rank.set(c.id, n)
      seen.set(c.block ?? 0, n + 1)
    }
  }
  return [...cards].sort(
    (a, b) =>
      Number(isCore(b)) - Number(isCore(a)) ||
      (byRelevance ? (b.relevance ?? 2) - (a.relevance ?? 2) : 0) ||
      (mix ? rank.get(a.id)! - rank.get(b.id)! : 0) ||
      byScript(a, b),
  )
}

/**
 * Verteilt `budget` Sekunden auf Bedarfe nach Gewicht, ohne einen Bedarf zu überschreiten
 * (Water-Filling). Liefert die zugeteilten Sekunden je Eintrag.
 */
export function distribute(budget: number, demands: { cost: number; weight: number }[]): number[] {
  const alloc = demands.map(() => 0)
  let open = demands.map((d, i) => (d.cost > 0 ? i : -1)).filter((i) => i >= 0)
  let rest = budget
  while (rest > 1e-9 && open.length) {
    const totalWeight = open.reduce((s, i) => s + demands[i].weight, 0)
    const stillOpen: number[] = []
    let used = 0
    for (const i of open) {
      const share = (rest * demands[i].weight) / totalWeight
      const give = Math.min(share, demands[i].cost - alloc[i])
      alloc[i] += give
      used += give
      if (alloc[i] < demands[i].cost - 1e-9) stillOpen.push(i)
    }
    rest -= used
    if (stillOpen.length === open.length) break
    open = stillOpen
  }
  return alloc
}

export function planDay(input: PlanInput): DayPlan {
  const { now, cards, done, budgetMinutes, costs } = input
  const endOfToday = addDays(studyDayStart(now), 1)
  const exams = input.exams
    .map((e) => ({ ...e, daysLeft: daysUntil(e.date, now) }))
    .filter((e) => e.daysLeft >= 0)

  const plans: ExamPlan[] = exams.map((e) => {
    // Stichtag für neuen Stoff: die Klausur selbst oder (duales Semester) der Beginn der Prüfungsphase.
    const anchorDays = Math.min(e.daysLeft, e.introBy ? daysUntil(e.introBy, now) : e.daysLeft)
    let intro = e.daysLeft === 0 ? 0 : anchorDays <= 1 ? 1 : introductionDays(anchorDays, input.buffer)
    // Läuft die Vorlesung noch, kommt weiterer Stoff nach – den vorhandenen also zeitnah beginnen statt bis zur Klausur zu strecken.
    if (intro > 0 && e.introWithin) intro = Math.min(intro, Math.max(1, Math.round(e.introWithin)))
    const modes = {} as Record<Mode, ExamModePlan>
    for (const m of MODES) {
      const own = cards.filter((c) => c.examId === e.id && c.mode === m)
      const fresh = own.filter((c) => c.state === 0)
      const newRemaining = fresh.length
      const coreRemaining = fresh.filter(isCore).length
      const newDoneToday = done.filter((d) => d.examId === e.id && d.mode === m && d.wasNew).length
      const reviewsDoneToday = done.filter((d) => d.examId === e.id && d.mode === m && !d.wasNew).length
      // Quote auf Basis des Stands zu Tagesbeginn, damit sie sich beim Lernen nicht verschiebt.
      // Heute begonnene Karten zählen zuerst zum Kernstoff.
      const corePool = coreRemaining + newDoneToday
      const quota = intro === 0 ? 0 : Math.ceil(corePool / intro)
      const optionalQuota = intro === 0 ? 0 : Math.ceil((newRemaining - coreRemaining) / intro)
      modes[m] = {
        newRemaining,
        coreRemaining,
        quota,
        optionalQuota,
        allowed: 0,
        newDoneToday,
        newLeft: 0,
        reviewsDue: own.filter((c) => c.state !== 0 && c.due < endOfToday).length,
        reviewsDoneToday,
      }
    }
    return { examId: e.id, daysLeft: e.daysLeft, introDeadline: intro, modes, behind: false, forecastShare: 0 }
  })

  const totals = {} as Record<Mode, ModeTotals>
  for (const m of MODES) {
    const cost = costs[m]
    const budget = budgetMinutes[m] * 60
    const reviewCost = plans.reduce((s, p) => s + (p.modes[m].reviewsDue + p.modes[m].reviewsDoneToday) * cost.review, 0)
    // Wichtigere und nähere Prüfungen bekommen bei Knappheit mehr Zeit.
    const weight = (i: number) => exams[i].weight * (1 + 10 / Math.max(1, plans[i].daysLeft))
    const free = Math.max(0, budget - reviewCost)
    // Erst der Kernstoff, vom Rest dann der Zusatzstoff (Relevanz 1).
    const coreAlloc = distribute(
      free,
      plans.map((p, i) => ({ cost: p.modes[m].quota * cost.newCard, weight: weight(i) })),
    )
    const optAlloc = distribute(
      Math.max(0, free - coreAlloc.reduce((a, b) => a + b, 0)),
      plans.map((p, i) => ({ cost: p.modes[m].optionalQuota * cost.newCard, weight: weight(i) })),
    )

    let newLeft = 0
    let reviewsLeft = 0
    plans.forEach((p, i) => {
      const mp = p.modes[m]
      const core = Math.min(mp.quota, Math.floor(coreAlloc[i] / cost.newCard + 1e-9))
      const optional = Math.min(mp.optionalQuota, Math.floor(optAlloc[i] / cost.newCard + 1e-9))
      mp.allowed = core + optional
      mp.newLeft = Math.min(mp.newRemaining, Math.max(0, mp.allowed - mp.newDoneToday))
      if (core < mp.quota) p.behind = true
      newLeft += mp.newLeft
      reviewsLeft += mp.reviewsDue
    })
    const neededSeconds = reviewCost + plans.reduce((s, p) => s + p.modes[m].quota * cost.newCard, 0)
    totals[m] = {
      reviewsLeft,
      newLeft,
      minutesLeft: Math.ceil((reviewsLeft * cost.review + newLeft * cost.newCard) / 60),
      minutesNeeded: Math.ceil(neededSeconds / 60),
    }
  }
  for (const p of plans) {
    const own = cards.filter((c) => c.examId === p.examId)
    if (!own.length) continue
    let expected = 0
    for (const m of MODES) {
      const mp = p.modes[m]
      const perDay = Math.max(mp.allowed, 0)
      // heute noch offen + an den weiteren Einführungstagen im heutigen Tempo
      const reachable = mp.newLeft + perDay * Math.max(0, p.introDeadline - 1)
      expected += Math.min(mp.newRemaining, reachable)
    }
    const remaining = MODES.reduce((s, m) => s + p.modes[m].newRemaining, 0)
    p.forecastShare = (own.length - remaining + expected) / own.length
  }
  return { exams: plans, modes: totals }
}

/** Mischt Gruppen reihum (Interleaving), z. B. Karten verschiedener Prüfungen. */
export function interleave<T>(groups: T[][]): T[] {
  const out: T[] = []
  const queues = groups.map((g) => [...g])
  while (queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift()
      if (next !== undefined) out.push(next)
    }
  }
  return out
}

export interface QueueOptions {
  mode: Mode
  now: number
  /** Nur diese Prüfung lernen. */
  examId?: string
  /** Zusätzliche neue Karten über den Plan hinaus. */
  extraNew?: number
}

/**
 * Stellt die Lernsitzung zusammen: fällige Wiederholungen aller Prüfungen gemischt,
 * dazwischen gleichmäßig verteilt die neuen Karten laut Tagesplan.
 */
export function buildQueue(plan: DayPlan, cards: PlanCard[], opts: QueueOptions): PlanCard[] {
  const { mode, now, examId } = opts
  const endOfToday = addDays(studyDayStart(now), 1)
  const examPlans = plan.exams.filter((p) => !examId || p.examId === examId)

  const reviewGroups = examPlans.map((p) =>
    cards
      .filter((c) => c.examId === p.examId && c.mode === mode && c.state !== 0 && c.due < endOfToday)
      .sort((a, b) => a.due - b.due),
  )
  const newGroups = examPlans.map((p) => {
    const mp = p.modes[mode]
    const count = mp.newLeft + (opts.extraNew ?? 0)
    const fresh = cards.filter((c) => c.examId === p.examId && c.mode === mode && c.state === 0)
    // Bis kurz vor der Klausur chronologisch (Konzepte bauen aufeinander auf) – auch bei Rückstand;
    // Zusatzstoff steht dabei immer hinten. Erst am Ende relevante Karten zuerst und Pakete gemischt.
    const mix = p.daysLeft <= MIX_WITHIN_DAYS
    return orderNew(fresh, mix, mix).slice(0, count)
  })

  const reviews = interleave(reviewGroups)
  const fresh = interleave(newGroups)
  if (!fresh.length) return reviews
  if (!reviews.length) return fresh
  // Neue Karten gleichmäßig zwischen die Wiederholungen streuen.
  const out: PlanCard[] = []
  const step = (reviews.length + fresh.length) / fresh.length
  let r = 0
  let n = 0
  for (let i = 0; i < reviews.length + fresh.length; i++) {
    const wantNew = n < fresh.length && (r >= reviews.length || i >= Math.floor(n * step + step / 2))
    out.push(wantNew ? fresh[n++] : reviews[r++])
  }
  return out
}

export interface SubjectToday {
  examId: string
  /** Heute noch offen je Modus (fällige Wiederholungen + neue Karten). */
  left: Record<Mode, number>
  behind: boolean
  daysLeft: number
}

/**
 * Fächer mit heute offenem Pensum (`extraDesk`: fällige Hausaufgaben je Prüfung), das empfohlene zuerst: Fächer mit Rückstand (Budget reicht nicht
 * für den Kernstoff) vor den anderen, dann das mit dem meisten offenen Pensum, bei Gleichstand die nähere Klausur.
 */
export function subjectsToday(plan: DayPlan, extraDesk: Map<string, number> = new Map()): SubjectToday[] {
  return plan.exams
    .map((p) => ({
      examId: p.examId,
      left: { mobile: p.modes.mobile.reviewsDue + p.modes.mobile.newLeft, desk: p.modes.desk.reviewsDue + p.modes.desk.newLeft + (extraDesk.get(p.examId) ?? 0) },
      behind: p.behind,
      daysLeft: p.daysLeft,
    }))
    .filter((s) => s.left.mobile + s.left.desk > 0)
    .sort((a, b) => Number(b.behind) - Number(a.behind) || b.left.mobile + b.left.desk - (a.left.mobile + a.left.desk) || a.daysLeft - b.daysLeft)
}
