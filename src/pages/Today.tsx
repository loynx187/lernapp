import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { loadStudyData, updateSnapshots } from '../lib/study'
import { formatCountdown } from '../lib/dates'
import { cardMode, type Mode } from '../lib/db'
import { streak } from '../lib/stats'
import { PageHeader, Progress } from '../components/ui'

const MODE_INFO: Record<Mode, { title: string; hint: string; unit: string }> = {
  mobile: { title: 'Unterwegs', hint: 'Karteikarten, Formeln, Multiple Choice', unit: 'Karten' },
  desk: { title: 'Am Schreibtisch', hint: 'Rechenaufgaben mit Papier und Stift', unit: 'Aufgaben' },
}

export function Today() {
  const { profile, semester } = useActive()
  const data = useLiveQuery(() => loadStudyData(profile), [profile])

  useEffect(() => {
    if (data) updateSnapshots(profile, data.exams, data.cards).catch(() => {})
    // Einmal pro Aufruf der Seite reicht; der Verlauf speichert einen Wert pro Tag.
  }, [data === undefined])

  if (!data) return null
  const { exams, cards, plan, logs } = data
  const upcoming = exams.filter((e) => plan.exams.some((p) => p.examId === e.id))
  const days = streak(logs, Date.now())
  const hasMode = (m: Mode) => cards.some((c) => cardMode(c) === m)

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`Hallo ${profile.name}.`}
        subtitle={
          <>
            {semester.name}
            {days > 0 && ` · ${days} ${days === 1 ? 'Tag' : 'Tage'} in Folge gelernt`}
          </>
        }
      />

      {exams.length === 0 ? (
        <div className="card empty stack">
          <h2>Noch keine Prüfungen</h2>
          <p className="muted">Lege deine Prüfungen mit Termin an. Danach importierst du die Karten und die App erstellt deinen Lernplan.</p>
          <Link className="btn primary" to="/pruefung/neu">Prüfung anlegen</Link>
        </div>
      ) : cards.length === 0 ? (
        <div className="card empty stack">
          <h2>Noch keine Karten</h2>
          <p className="muted">Importiere ein Kartenpaket für eine deiner Prüfungen – oder probiere das Beispielpaket aus.</p>
          <Link className="btn primary" to="/import">Karten importieren</Link>
        </div>
      ) : (
        <>
          {(['mobile', 'desk'] as Mode[]).filter(hasMode).map((m) => {
            const t = plan.modes[m]
            const left = t.reviewsLeft + t.newLeft
            const info = MODE_INFO[m]
            const budget = m === 'mobile' ? profile.minutesMobile : profile.minutesDesk
            return (
              <div className="card plan-block" key={m}>
                <div className="row between">
                  <div>
                    <h2 style={{ margin: 0 }}>{info.title}</h2>
                    <small>{info.hint}</small>
                  </div>
                  {left > 0 && <span className="chip">ca. {t.minutesLeft} min</span>}
                </div>
                {left > 0 ? (
                  <>
                    <div className="row" style={{ gap: 24 }}>
                      <div>
                        <div className="big">{t.reviewsLeft}</div>
                        <small>Wiederholungen</small>
                      </div>
                      <div>
                        <div className="big">{t.newLeft}</div>
                        <small>neue {info.unit}</small>
                      </div>
                    </div>
                    <Link className="btn primary block" to={`/lernen/${m}`}>Lernen starten</Link>
                  </>
                ) : (
                  <>
                    <p className="badge-good" style={{ margin: 0 }}>Für heute erledigt.</p>
                    <Link className="btn block" to={`/lernen/${m}?extra=${m === 'mobile' ? 10 : 1}`}>
                      {m === 'mobile' ? '10 zusätzliche Karten' : '1 zusätzliche Aufgabe'}
                    </Link>
                  </>
                )}
                {t.minutesNeeded > budget && (
                  <div className="notice warn" style={{ margin: 0 }}>
                    Um alle Prüfungen rechtzeitig zu schaffen, bräuchtest du ca. <b>{t.minutesNeeded} min/Tag</b> {info.title.toLowerCase()} (eingestellt: {budget} min).{' '}
                    <Link to="/einstellungen">Zeitbudget anpassen</Link>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="section-title">Anstehende Prüfungen</div>
          {upcoming.map((e) => {
            const p = plan.exams.find((x) => x.examId === e.id)!
            const own = cards.filter((c) => c.examId === e.id)
            const introduced = own.filter((c) => c.s.state !== 0).length
            return (
              <Link key={e.id} to={`/pruefung/${e.id}`} className="card link">
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span className="row grow">
                    <span className="dot" style={{ background: e.color }} />
                    <b className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</b>
                  </span>
                  <span className="chip">{formatCountdown(p.daysLeft)}</span>
                </div>
                <Progress value={own.length ? introduced / own.length : 0} color={e.color} />
                <div className="row between" style={{ marginTop: 6 }}>
                  <small>{own.length ? `${introduced} von ${own.length} begonnen` : 'noch keine Karten'}</small>
                  {p.behind && own.length > 0 && <small className="badge-warn">Rückstand</small>}
                </div>
              </Link>
            )
          })}
        </>
      )}
    </>
  )
}
