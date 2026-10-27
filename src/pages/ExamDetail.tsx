import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { cardMode, db } from '../lib/db'
import { loadStudyData } from '../lib/study'
import { addDays, daysUntil, formatCountdown, formatDate, isoDate } from '../lib/dates'
import { examStats } from '../lib/stats'
import { exportPackage, safeFileName, saveFile } from '../lib/packages'
import { HistoryChart } from '../components/HistoryChart'
import { Icon, Progress, Stat, pct } from '../components/ui'

export function ExamDetail() {
  const { id = '' } = useParams()
  const { profile } = useActive()
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const exam = await db.exams.get(id)
    if (!exam) return { exam: undefined }
    const [cards, snapshots, packages, study] = await Promise.all([
      db.cards.where('[examId+archived]').equals([id, 0]).toArray(),
      db.snapshots.where('examId').equals(id).toArray(),
      db.packages.where('examId').equals(id).toArray(),
      loadStudyData(profile),
    ])
    return { exam, cards, snapshots, packages, plan: study.plan.exams.find((p) => p.examId === id) }
  }, [id, profile])

  if (!data) return null
  const { exam } = data
  if (!exam) {
    return (
      <div className="card empty">
        <p>Prüfung nicht gefunden.</p>
        <Link to="/pruefungen">Zur Übersicht</Link>
      </div>
    )
  }
  const { cards, snapshots, packages, plan } = data
  const stats = examStats(exam, cards, Date.now(), profile.retention)
  const days = daysUntil(exam.date)
  const hasDesk = cards.some((c) => cardMode(c) === 'desk')
  const hasMobile = cards.some((c) => cardMode(c) === 'mobile')

  async function share(packageId: string) {
    const pkg = await exportPackage(exam!, packageId)
    await saveFile(`${safeFileName(pkg.title)}.lernpaket.json`, JSON.stringify(pkg, null, 1))
  }

  return (
    <>
      <div className="header">
        <button className="btn ghost small" onClick={() => navigate(-1)} aria-label="Zurück">
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1 className="row" style={{ gap: 8 }}>
            <span className="dot" style={{ background: exam.color, width: 14, height: 14 }} />
            {exam.name}
          </h1>
          <span className="muted">
            {formatDate(exam.date)} · {formatCountdown(days)}
          </span>
        </div>
        <Link className="btn small" to={`/pruefung/${exam.id}/bearbeiten`}>Bearbeiten</Link>
      </div>

      {stats.total === 0 ? (
        <div className="card empty stack">
          <p className="muted">Für diese Prüfung gibt es noch keine Karten.</p>
          <Link className="btn primary" to={`/import?exam=${exam.id}`}>Karten importieren</Link>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="stats">
              <Stat value={pct(stats.introduced, stats.total)} label="begonnen" />
              <Stat value={pct(stats.secure, stats.total)} label="sicher bis Klausur" />
              <Stat value={stats.introduced ? `${Math.round(stats.recall * 100)} %` : '–'} label="aktuell abrufbar" />
            </div>
            {plan && days > 0 && (
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
                {plan.modes.mobile.newRemaining + plan.modes.desk.newRemaining > 0 ? (
                  <>
                    Neuer Stoff bis <b>{formatDate(isoDate(addDays(Date.now(), plan.introDeadline - 1)))}</b>, danach nur noch Wiederholung.{' '}
                    {plan.behind ? (
                      <span className="badge-warn">Das Zeitbudget reicht aktuell nicht ganz.</span>
                    ) : (
                      <span className="badge-good">Im Plan.</span>
                    )}
                  </>
                ) : (
                  <span className="badge-good">Aller Stoff ist begonnen – jetzt wird bis zur Klausur gefestigt.</span>
                )}
              </p>
            )}
          </div>

          <div className="row" style={{ marginBottom: 12 }}>
            {hasMobile && <Link className="btn grow" to={`/lernen/mobile?exam=${exam.id}`}>Karten üben</Link>}
            {hasDesk && <Link className="btn grow" to={`/lernen/desk?exam=${exam.id}`}>Aufgaben üben</Link>}
          </div>

          <div className="section-title">Verlauf</div>
          <div className="card">
            <HistoryChart snapshots={snapshots} examDate={exam.date} color={exam.color} />
          </div>

          <div className="section-title">Kapitel</div>
          <div className="card chapters">
            {stats.chapters.map((ch) => {
              const weak = ch.introduced > 0 && ch.recall < 0.8
              return (
                <div className="chapter-row" key={ch.chapter}>
                  <span>{ch.title}</span>
                  <small className={weak ? 'badge-warn' : ''}>
                    {ch.introduced}/{ch.total}
                    {ch.introduced > 0 && ` · ${Math.round(ch.recall * 100)} %`}
                  </small>
                  <Progress value={ch.total ? ch.introduced / ch.total : 0} color={weak ? 'var(--warn)' : exam.color} />
                </div>
              )
            })}
            <small>Zahlen: begonnene Karten / alle · aktuelle Abrufwahrscheinlichkeit. Orange = Schwachstelle.</small>
          </div>
        </>
      )}

      <div className="section-title">Kartenpakete</div>
      <div className="card stack">
        {packages.length === 0 && <p className="muted">Noch keine Pakete importiert.</p>}
        {packages.map((p) => (
          <div className="row between" key={p.id}>
            <div className="grow">
              <b>{p.title}</b>
              <br />
              <small>
                Version {p.version} · {p.cardCount} Karten · importiert {new Date(p.importedAt).toLocaleDateString('de-DE')}
              </small>
            </div>
            <button className="btn small" onClick={() => share(p.packageId)}>Teilen</button>
          </div>
        ))}
        <Link className="btn block" to={`/import?exam=${exam.id}`}>Paket importieren oder aktualisieren</Link>
      </div>
    </>
  )
}
