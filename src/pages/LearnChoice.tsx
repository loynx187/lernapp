import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { useActive } from '../state'
import { loadStudyData } from '../lib/study'
import { subjectsToday } from '../lib/planner'
import { homeworkDueByExam } from '../lib/homework'
import { daysUntil, formatCountdown } from '../lib/dates'
import { materialByExam } from '../lib/stats'
import type { Mode } from '../lib/db'
import { PageHeader } from '../components/ui'
import { MODE_INFO } from './Dashboard'

/** Auswahl hinter dem Startseiten-Widget: alle Fächer gemischt oder ein einzelnes Fach lernen. */
export function LearnChoice() {
  const { mode: param } = useParams()
  const mode: Mode = param === 'desk' ? 'desk' : 'mobile'
  const { profile } = useActive()
  const data = useLiveQuery(() => loadStudyData(profile), [profile])
  if (!data) return null
  const now = Date.now()
  const info = MODE_INFO[mode]
  const t = data.plan.modes[mode]
  const hwByExam = homeworkDueByExam(data.homework, now)
  const hwCount = mode === 'desk' ? [...hwByExam.values()].reduce((a, b) => a + b, 0) : 0
  const left = t.reviewsLeft + t.newLeft + hwCount
  const subjects = subjectsToday(data.plan, hwByExam).filter((s) => s.left[mode] > 0)
  // Fächer mit Stoff, aber heute nichts eingeplant: gezielt extra üben (wie „Alle Fächer“ nach dem Tagespensum).
  const material = materialByExam(data.cards, mode)
  const planned = new Set(subjects.map((s) => s.examId))
  const others = data.exams.filter((e) => material.has(e.id) && !planned.has(e.id))
  const examById = new Map(data.exams.map((e) => [e.id, e]))
  const count = (n: number) => `${n} ${n === 1 ? info.one : info.unit}`

  return (
    <>
      <PageHeader back eyebrow="Heute" title={`${info.title} lernen`} subtitle={left > 0 ? `${count(left)} · ca. ${t.minutesLeft} min` : 'Für heute erledigt'} />
      <Link to={left > 0 ? `/lernen/${mode}` : `/lernen/${mode}?extra=${info.extra}`} className="card link" aria-label="Alle Fächer lernen">
        <div className="row between" style={{ marginBottom: 4 }}>
          <b>Alle Fächer</b>
          <span className="chip">{left > 0 ? count(left) : `${info.extra} extra`}</span>
        </div>
        <small>Wechselt zwischen den Fächern ab – gut, wenn du einfach das Tagespensum abarbeiten willst.</small>
      </Link>
      {subjects.length + others.length > 0 && <div className="section-title">Ein Fach lernen</div>}
      {subjects.map((s, i) => {
        const e = examById.get(s.examId)!
        return (
          <Link key={s.examId} to={`/lernen/${mode}?exam=${s.examId}`} className="card link" aria-label={`${e.name} lernen`}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <span className="row grow">
                <span className="dot" style={{ background: e.color }} />
                <b className="truncate">{e.name}</b>
              </span>
              {i === 0 && subjects.length > 1 && <span className="w-badge">Empfohlen</span>}
            </div>
            <small>
              {count(s.left[mode])} · {s.behind ? <span className="badge-warn">Rückstand</span> : `Klausur ${formatCountdown(s.daysLeft)}`}
              {mode === 'mobile' && <> · {s.perDay > 0 ? `noch ${s.newRemaining} neue Karten, ${s.perDay} pro Tag nötig` : 'nur Wiederholungen'}</>}
            </small>
          </Link>
        )
      })}
      {others.length > 0 && (
        <>
          {subjects.length > 0 && <p className="muted" style={{ fontSize: 14, margin: '4px 0 8px' }}>Heute nichts eingeplant – zum Üben nach Bedarf:</p>}
          {others.map((e) => (
            <Link key={e.id} to={`/lernen/${mode}?exam=${e.id}&extra=${info.extra}`} className="card link" aria-label={`${e.name} üben`}>
              <div className="row between" style={{ marginBottom: 4 }}>
                <span className="row grow">
                  <span className="dot" style={{ background: e.color }} />
                  <b className="truncate">{e.name}</b>
                </span>
                <span className="chip">{info.extra} extra</span>
              </div>
              <small>{count(material.get(e.id)!)} im Fach · Klausur {formatCountdown(daysUntil(e.date, now))}</small>
            </Link>
          ))}
        </>
      )}
    </>
  )
}
