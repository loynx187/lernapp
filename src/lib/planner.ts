import type { Mode } from './db'
import { addDays, daysUntil, startOfDay } from './dates'

/** Die Felder einer Karte, die der Planer braucht. */
export interface PlanCard {
  id: string
  examId: string
  mode: Mode
  /** FSRS-Zustand: 0 = neu */
  state: number
  due: number
  order: number
  relevance?: number
}

export interface PlanExam {
  id: string
  date: string
  weight: number
}

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
}

export interface ExamModePlan {
  /** Neue Karten, die noch gar nicht begonnen wurden. */
  newRemaining: number
  /** Neue Karten pro Tag, damit der Stoff rechtzeitig vor der Klausur eingeführt ist. */
  quota: number
  /** Neue Karten, die das Zeitbudget heute zulässt. */
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
  /** Das Budget reicht nicht, um den Stoff rechtzeitig zu schaffen. */
  behind: boolean
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
 * Anzahl Tage, an denen neuer Stoff eingeführt wird. Vor der Klausur bleibt ein
 * Puffer, in dem nur noch wiederholt wird (ca. 20 % der Zeit, 2–10 Tage).
 */
export function introductionDays(daysLeft: number): number {
  if (daysLeft <= 3) return Math.max(1, daysLeft - 1)
  const buffer = Math.min(10, Math.max(2, Math.round(daysLeft * 0.2)))
  return daysLeft - buffer
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
  const endOfToday = addDays(startOfDay(now), 1)
  const exams = input.exams
    .map((e) => ({ ...e, daysLeft: daysUntil(e.date, now) }))
    .filter((e) => e.daysLeft >= 0)

  const plans: ExamPlan[] = exams.map((e) => {
    const intro = e.daysLeft === 0 ? 0 : introductionDays(e.daysLeft)
    const modes = {} as Record<Mode, ExamModePlan>
    for (const m of MODES) {
      const own = cards.filter((c) => c.examId === e.id && c.mode === m)
      const newRemaining = own.filter((c) => c.state === 0).length
      const newDoneToday = done.filter((d) => d.examId === e.id && d.mode === m && d.wasNew).length
      const reviewsDoneToday = done.filter((d) => d.examId === e.id && d.mode === m && !d.wasNew).length
      // Quote auf Basis des Stands zu Tagesbeginn, damit sie sich beim Lernen nicht verschiebt.
      const pool = newRemaining + newDoneToday
      const quota = intro === 0 ? 0 : Math.ceil(pool / intro)
      modes[m] = {
        newRemaining,
        quota,
        allowed: 0,
        newDoneToday,
        newLeft: 0,
        reviewsDue: own.filter((c) => c.state !== 0 && c.due < endOfToday).length,
        reviewsDoneToday,
      }
    }
    return { examId: e.id, daysLeft: e.daysLeft, introDeadline: intro, modes, behind: false }
  })

  const totals = {} as Record<Mode, ModeTotals>
  for (const m of MODES) {
    const cost = costs[m]
    const budget = budgetMinutes[m] * 60
    const reviewCost = plans.reduce((s, p) => s + (p.modes[m].reviewsDue + p.modes[m].reviewsDoneToday) * cost.review, 0)
    const demands = plans.map((p, i) => ({
      cost: p.modes[m].quota * cost.newCard,
      // Wichtigere und nähere Prüfungen bekommen bei Knappheit mehr Zeit.
      weight: exams[i].weight * (1 + 10 / Math.max(1, p.daysLeft)),
    }))
    const alloc = distribute(Math.max(0, budget - reviewCost), demands)

    let newLeft = 0
    let reviewsLeft = 0
    plans.forEach((p, i) => {
      const mp = p.modes[m]
      mp.allowed = Math.min(mp.quota, Math.floor(alloc[i] / cost.newCard + 1e-9))
      mp.newLeft = Math.min(mp.newRemaining, Math.max(0, mp.allowed - mp.newDoneToday))
      if (mp.allowed < mp.quota) p.behind = true
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
  const endOfToday = addDays(startOfDay(now), 1)
  const examPlans = plan.exams.filter((p) => !examId || p.examId === examId)

  const reviewGroups = examPlans.map((p) =>
    cards
      .filter((c) => c.examId === p.examId && c.mode === mode && c.state !== 0 && c.due < endOfToday)
      .sort((a, b) => a.due - b.due),
  )
  const newGroups = examPlans.map((p) => {
    const mp = p.modes[mode]
    const count = mp.newLeft + (opts.extraNew ?? 0)
    return cards
      .filter((c) => c.examId === p.examId && c.mode === mode && c.state === 0)
      .sort((a, b) =>
        // Bei Rückstand zuerst klausurrelevante Karten, sonst in Skript-Reihenfolge.
        p.behind ? (b.relevance ?? 2) - (a.relevance ?? 2) || a.order - b.order : a.order - b.order,
      )
      .slice(0, count)
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
