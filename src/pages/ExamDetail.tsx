import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { cardMode, db } from '../lib/db'
import { loadStudyData } from '../lib/study'
import { addDays, daysUntil, formatCountdown, formatDate, isoDate } from '../lib/dates'
import { examStats } from '../lib/stats'
import { exportPackage, safeFileName, saveFile } from '../lib/packages'
import { deleteReport, exportReports, REPORT_CATEGORIES, setResolved } from '../lib/reports'
import { HistoryChart } from '../components/HistoryChart'
import { PageHeader, Progress, Stat, pct } from '../components/ui'

export function ExamDetail() {
  const { id = '' } = useParams()
  const { profile } = useActive()
  const data = useLiveQuery(async () => {
    const exam = await db.exams.get(id)
    if (!exam) return { exam: undefined }
    const [cards, snapshots, packages, reports, study] = await Promise.all([
      db.cards.where('[examId+archived]').equals([id, 0]).toArray(),
      db.snapshots.where('examId').equals(id).toArray(),
      db.packages.where('examId').equals(id).toArray(),
      db.reports.where('examId').equals(id).toArray(),
      loadStudyData(profile),
    ])
    return { exam, cards, snapshots, packages, reports, plan: study.plan.exams.find((p) => p.examId === id) }
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
  const { cards, snapshots, packages, reports, plan } = data
  const openReports = reports.filter((r) => !r.resolvedAt).sort((a, b) => b.createdAt - a.createdAt)
  const cardById = new Map(cards.map((c) => [c.id, c]))
  const stats = examStats(exam, cards, Date.now(), profile.retention)
  const days = daysUntil(exam.date)
  const hasDesk = cards.some((c) => cardMode(c) === 'desk')
  const hasMobile = cards.some((c) => cardMode(c) === 'mobile')

  async function share(packageId: string) {
    const pkg = await exportPackage(exam!, packageId)
    await saveFile(`${safeFileName(pkg.title)}.lernpaket.json`, JSON.stringify(pkg, null, 1))
  }

  async function exportOpenReports() {
    const file = await exportReports(exam!)
    await saveFile(`Meldungen_${safeFileName(exam!.name)}_${isoDate(Date.now())}.json`, JSON.stringify(file, null, 1))
  }

  return (
    <>
      <PageHeader
        back
        action={<Link className="btn small" to={`/pruefung/${exam.id}/bearbeiten`}>Bearbeiten</Link>}
        eyebrow={
          <span className="row" style={{ gap: 6 }}>
            <span className="dot" style={{ background: exam.color, width: 8, height: 8 }} />
            Klausur {formatCountdown(days)}
          </span>
        }
        title={exam.name}
        subtitle={formatDate(exam.date)}
      />

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
              <Stat
                value={plan ? `${Math.round(plan.forecastShare * profile.retention * 100)} %` : pct(stats.secure, stats.total)}
                label={plan ? 'Prognose Klausurtag' : 'sicher zur Klausur'}
              />
              <Stat value={stats.introduced ? `${Math.round(stats.recall * 100)} %` : '–'} label="aktuell abrufbar" />
            </div>
            {plan && days > 0 && (
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
                {plan.modes.mobile.newRemaining + plan.modes.desk.newRemaining > 0 ? (
                  <>
                    Neuer Stoff bis <b>{formatDate(isoDate(addDays(Date.now(), plan.introDeadline - 1)))}</b>, danach nur noch Wiederholung.{' '}
                    {plan.behind ? (
                      <span className="badge-warn">Das Zeitbudget reicht aktuell nicht für den ganzen Kernstoff.</span>
                    ) : (
                      <span className="badge-good">Im Plan.</span>
                    )}
                  </>
                ) : (
                  <span className="badge-good">Aller Stoff ist begonnen – jetzt wird bis zur Klausur gefestigt.</span>
                )}
              </p>
            )}
            {plan && (
              <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
                Prognose: Anteil des Stoffs, den du am Klausurtag voraussichtlich abrufen kannst, wenn du täglich dein heutiges Pensum lernst. Zusatzstoff (Relevanz 1) kommt nur dran, wenn Zeit übrig ist.
              </p>
            )}
          </div>

          <div className="row" style={{ marginBottom: 12 }}>
            {hasMobile && <Link className="btn grow" to={`/lernen/mobile?exam=${exam.id}`}>Karten üben</Link>}
            {hasDesk && <Link className="btn grow" to={`/lernen/desk?exam=${exam.id}`}>Aufgaben üben</Link>}
            <Link className="btn grow" to={`/probeklausur/${exam.id}`}>Probeklausur</Link>
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

      {openReports.length > 0 && (
        <>
          <div className="section-title">Meldungen</div>
          <div className="list">
            {openReports.map((r) => (
              <div className="list-item" key={r.id} style={{ flexWrap: 'wrap', rowGap: 4 }}>
                <div className="grow" style={{ flexBasis: '100%' }}>
                  <div className="truncate" style={{ fontWeight: 500 }}>{cardById.get(r.cardId)?.front.replace(/[*_$#>{}]/g, '') ?? r.uid}</div>
                  <small>
                    {REPORT_CATEGORIES.find((c) => c.value === r.category)?.label}
                    {r.note && ` · ${r.note}`}
                  </small>
                </div>
                <button className="btn small ghost" style={{ color: 'var(--accent)', marginLeft: 'auto' }} onClick={() => setResolved(r, true)}>Erledigt</button>
                <button className="btn small ghost danger" onClick={() => deleteReport(r)} aria-label="Meldung löschen">Löschen</button>
              </div>
            ))}
            <div className="list-item">
              <button className="btn small ghost" style={{ color: 'var(--accent)', marginLeft: -8 }} onClick={exportOpenReports}>
                {openReports.length === 1 ? 'Meldung' : `${openReports.length} Meldungen`} exportieren
              </button>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>
            Die Exportdatei bei der nächsten Paketerstellung zusammen mit <code>/kartenpaket</code> hochladen. Korrigierte Karten werden nach dem Import automatisch als erledigt markiert.
          </p>
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
