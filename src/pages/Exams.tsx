import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { db, MAX_EXAMS_PER_SEMESTER } from '../lib/db'
import { daysUntil, formatCountdown, formatDate } from '../lib/dates'
import { examStats } from '../lib/stats'
import { PageHeader, Progress, pct } from '../components/ui'

export function Exams() {
  const { profile, semester } = useActive()
  const rows = useLiveQuery(async () => {
    const exams = (await db.exams.where('semesterId').equals(semester.id).toArray()).sort((a, b) => a.date.localeCompare(b.date))
    const now = Date.now()
    return Promise.all(
      exams.map(async (e) => ({ exam: e, stats: examStats(e, await db.cards.where('[examId+archived]').equals([e.id, 0]).toArray(), now, profile.retention) })),
    )
  }, [semester.id, profile.retention])
  if (!rows) return null
  const full = rows.length >= MAX_EXAMS_PER_SEMESTER

  return (
    <>
      <PageHeader
        title="Prüfungen"
        subtitle={semester.name}
        action={
          <Link className="btn small primary" to="/pruefung/neu" aria-disabled={full} onClick={(e) => full && e.preventDefault()}>
            Neue Prüfung
          </Link>
        }
      />
      {full && <div className="notice">Maximal {MAX_EXAMS_PER_SEMESTER} Prüfungen pro Semester.</div>}
      {rows.length === 0 && (
        <div className="card empty">
          <p className="muted">Noch keine Prüfungen in diesem Semester.</p>
        </div>
      )}
      {rows.map(({ exam: e, stats }) => {
        const d = daysUntil(e.date)
        return (
          <Link key={e.id} to={`/pruefung/${e.id}`} className="card link" style={d < 0 ? { opacity: 0.6 } : undefined}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <span className="row grow">
                <span className="dot" style={{ background: e.color }} />
                <b>{e.name}</b>
              </span>
              <span className="chip">{formatCountdown(d)}</span>
            </div>
            <small>{formatDate(e.date)} · {stats.total} Karten</small>
            <div style={{ marginTop: 10 }}>
              <Progress value={stats.total ? stats.introduced / stats.total : 0} color={e.color} />
            </div>
            <div className="row between" style={{ marginTop: 6 }}>
              <small>begonnen {pct(stats.introduced, stats.total)}</small>
              <small>sicher bis Klausur {pct(stats.secure, stats.total)}</small>
            </div>
          </Link>
        )
      })}
      <Link className="btn block" to="/import" style={{ marginTop: 8 }}>Karten importieren</Link>
    </>
  )
}
