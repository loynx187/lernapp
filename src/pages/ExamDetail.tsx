import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { cardMode, db } from '../lib/db'
import { loadStudyData } from '../lib/study'
import { addDays, daysUntil, formatCountdown, formatDate, isoDate } from '../lib/dates'
import { examStats, packageBlocks } from '../lib/stats'
import { exportPackage, safeFileName, saveFile } from '../lib/packages'
import { deletedCards, restoreCard } from '../lib/cards'
import { deleteReport, exportReports, REPORT_CATEGORIES, setResolved } from '../lib/reports'
import { HistoryChart } from '../components/HistoryChart'
import { OrderButton, OrderSteps } from '../components/OrderButton'
import { fieldLabel, PROFILE_FIELDS } from '../lib/profile'
import { PageHeader, Progress, Stat, pct } from '../components/ui'

/** Bei laufender Vorlesung: Hinweis, wenn so lange kein neues Paket kam. */
const LECTURE_REMINDER_DAYS = 14

export function ExamDetail() {
  const { id = '' } = useParams()
  const { profile, semester } = useActive()
  const data = useLiveQuery(async () => {
    const exam = await db.exams.get(id)
    if (!exam) return { exam: undefined }
    const [cards, deleted, snapshots, packages, reports, study] = await Promise.all([
      db.cards.where('[examId+archived]').equals([id, 0]).toArray(),
      deletedCards(id),
      db.snapshots.where('examId').equals(id).toArray(),
      db.packages.where('examId').equals(id).toArray(),
      db.reports.where('examId').equals(id).toArray(),
      loadStudyData(profile),
    ])
    return { exam, cards, deleted, snapshots, packages, reports, plan: study.plan.exams.find((p) => p.examId === id) }
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
  const { cards, deleted, snapshots, packages, reports, plan } = data
  const openReports = reports.filter((r) => !r.resolvedAt).sort((a, b) => b.createdAt - a.createdAt)
  const cardById = new Map(cards.map((c) => [c.id, c]))
  const stats = examStats(exam, cards, Date.now(), profile.retention, packageBlocks(packages))
  const days = daysUntil(exam.date)
  const hasDesk = cards.some((c) => cardMode(c) === 'desk')
  const hasMobile = cards.some((c) => cardMode(c) === 'mobile')
  const suggested = exam.profile?.suggested ?? []
  const lastImport = Math.max(0, ...packages.map((p) => p.importedAt))
  const sinceImport = lastImport ? Math.floor((Date.now() - lastImport) / 864e5) : 0
  const staleLecture = exam.ongoing && days > 0 && sinceImport >= LECTURE_REMINDER_DAYS ? sinceImport : 0
  const filled = PROFILE_FIELDS.filter((f) => exam.profile?.[f.key] !== undefined)
  const profileSummary = filled.length
    ? [exam.profile?.form, exam.profile?.duration && `${exam.profile.duration} min`, exam.profile?.taskShare && `Rechenaufgaben: ${exam.profile.taskShare}`]
        .filter(Boolean)
        .join(' · ') || `${filled.length} von ${PROFILE_FIELDS.length} Angaben`
    : 'Noch leer – optional, Claude fragt sonst nach.'

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

      {staleLecture > 0 && (
        <div className="notice">
          <b>Neue Unterlagen da?</b> Seit {staleLecture} Tagen kam kein neues Kartenpaket. Unten „Auftrag für Claude kopieren“ und die neuen Folien anhängen – oder unter <Link to={`/pruefung/${exam.id}/bearbeiten`}>Bearbeiten</Link> „Vorlesung läuft noch“ ausschalten, wenn alles da ist.
        </div>
      )}

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
                label={plan ? (exam.ongoing ? 'Prognose (vorläufig)' : 'Prognose Klausurtag') : 'sicher zur Klausur'}
              />
              <Stat value={stats.introduced ? `${Math.round(stats.recall * 100)} %` : '–'} label="aktuell abrufbar" />
            </div>
            {plan && days > 0 && (
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
                {plan.modes.mobile.newRemaining + plan.modes.desk.newRemaining > 0 ? (
                  <>
                    {exam.ongoing ? (
                      <>Vorhandener neuer Stoff wird bis <b>{formatDate(isoDate(addDays(Date.now(), plan.introDeadline - 1)))}</b> begonnen – die Vorlesung läuft noch.{' '}</>
                    ) : (
                      <>Neuer Stoff bis <b>{formatDate(isoDate(addDays(Date.now(), plan.introDeadline - 1)))}</b>, danach nur noch Wiederholung.{' '}</>
                    )}
                    {plan.behind ? (
                      <span className="badge-warn">Das Zeitbudget reicht aktuell nicht für den ganzen Kernstoff.</span>
                    ) : (
                      <span className="badge-good">Im Plan.</span>
                    )}
                  </>
                ) : exam.ongoing ? (
                  <span className="badge-good">Aller bisherige Stoff ist begonnen – bis die nächsten Unterlagen kommen, wird gefestigt.</span>
                ) : (
                  <span className="badge-good">Aller Stoff ist begonnen – jetzt wird bis zur Klausur gefestigt.</span>
                )}
              </p>
            )}
            {plan && (
              <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
                Prognose: Anteil des Stoffs, den du am Klausurtag voraussichtlich abrufen kannst, wenn du täglich dein heutiges Pensum lernst. Zusatzstoff (Relevanz 1) kommt nur dran, wenn Zeit übrig ist.
                {exam.ongoing && ' Vorläufig, weil noch Unterlagen fehlen – sie bezieht sich nur auf den bisherigen Stoff.'}
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
                  <div className="truncate" style={{ fontWeight: 500 }}>{plainText(cardById.get(r.cardId)?.front) || r.uid}</div>
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
            Offene Meldungen stehen automatisch im Auftrag für Claude (unten). Korrigierte Karten werden nach dem Import als erledigt markiert.
          </p>
        </>
      )}

      {deleted.length > 0 && (
        <>
          <div className="section-title">Gelöschte Karten</div>
          <div className="list">
            {deleted.map((c) => (
              <div className="list-item" key={c.id} style={{ flexWrap: 'wrap', rowGap: 4 }}>
                <div className="grow" style={{ flexBasis: '100%', minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 500 }}>{plainText(c.front)}</div>
                  <small>{[c.chapterTitle, `gelöscht am ${new Date(c.deletedAt!).toLocaleDateString('de-DE')}`].filter(Boolean).join(' · ')}</small>
                </div>
                <button className="btn small ghost" style={{ color: 'var(--accent)', marginLeft: 'auto' }} onClick={() => restoreCard(c)}>Wiederherstellen</button>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>
            Gelöschte Karten werden nicht mehr abgefragt, auch nicht nach einem Paket-Update. Der Lernfortschritt bleibt für eine Wiederherstellung erhalten.
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
        <Link className="btn block" to="/unterlagen">Skripte für „Folie ansehen“</Link>
      </div>

      <div className="section-title">Karten mit Claude erstellen</div>
      <div className="card stack">
        <div className="row between">
          <div className="grow">
            <b>Fachprofil</b>
            <br />
            <small>{profileSummary}</small>
          </div>
          <Link className="btn small" to={`/pruefung/${exam.id}/profil`}>{suggested.length ? 'Prüfen' : filled.length ? 'Ändern' : 'Ausfüllen'}</Link>
        </div>
        {suggested.length > 0 && (
          <div className="notice" style={{ margin: 0 }}>
            Claude hat {suggested.map(fieldLabel).join(', ')} vorgeschlagen – bitte prüfen und speichern.
          </div>
        )}
        <OrderButton exams={[exam]} semester={semester} label="Auftrag für Claude kopieren" />
        <OrderSteps />
      </div>
    </>
  )
}

/** Kartentext ohne Markdown- und Formelzeichen für einzeilige Listen. */
const plainText = (text = '') => text.replace(/[*_$#>{}]/g, '')
