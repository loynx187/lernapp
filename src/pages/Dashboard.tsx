import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { loadStudyData, updateSnapshots } from '../lib/study'
import { addDays, formatCountdown, isoDate, startOfDay } from '../lib/dates'
import { cardMode, type Mode } from '../lib/db'
import { examStats, streak } from '../lib/stats'
import { DayBars, PageHeader, Progress, Rings, Widget } from '../components/ui'
import { useSync } from '../sync-state'

const MODE_INFO: Record<Mode, { title: string; unit: string; extra: number }> = {
  mobile: { title: 'Unterwegs', unit: 'Karten', extra: 10 },
  desk: { title: 'Schreibtisch', unit: 'Aufgaben', extra: 1 },
}

/** Startseite im Stil des iPadOS-Homescreens: Widgets führen zu den einzelnen Bereichen. */
export function Dashboard() {
  const { profile, semester } = useActive()
  const sync = useSync()
  const data = useLiveQuery(() => loadStudyData(profile), [profile])

  useEffect(() => {
    if (data) updateSnapshots(profile, data.exams, data.cards).catch(() => {})
    // Einmal pro Aufruf der Seite reicht; der Verlauf speichert einen Wert pro Tag.
  }, [data === undefined])

  if (!data) return null
  const { exams, cards, plan, logs } = data
  const now = Date.now()
  const upcoming = exams.filter((e) => plan.exams.some((p) => p.examId === e.id))
  const next = upcoming[0]
  const nextPlan = next && plan.exams.find((p) => p.examId === next.id)
  const days = streak(logs, now)
  const modes = (['mobile', 'desk'] as Mode[]).filter((m) => cards.some((c) => cardMode(c) === m))

  // Gesamtfortschritt über alle anstehenden Prüfungen
  let total = 0
  let introduced = 0
  let forecast = 0
  const perExam = new Map(
    upcoming.map((e) => {
      const st = examStats(e, cards.filter((c) => c.examId === e.id), now, profile.retention)
      total += st.total
      introduced += st.introduced
      // Prognose: erwartet abrufbarer Anteil am Klausurtag, wenn dem Plan gefolgt wird
      forecast += (plan.exams.find((p) => p.examId === e.id)?.forecastShare ?? 0) * profile.retention * st.total
      return [e.id, st]
    }),
  )

  // Gelernte Karten der letzten 7 Tage
  const today = startOfDay(now)
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const counts = week.map((d) => logs.filter((l) => isoDate(l.reviewedAt) === isoDate(d)).length)
  const dayLabels = week.map((d) => new Date(d).toLocaleDateString('de-DE', { weekday: 'narrow' }))

  return (
    <>
      <PageHeader
        eyebrow={new Date(now).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`Hallo ${profile.name}.`}
        subtitle={
          <>
            {semester.name}
            {semester.kind && ` · ${semester.kind === 'dual' ? 'dual' : 'regulär'}`}
            {sync.connected && <span className={sync.error ? 'badge-warn' : ''}>{sync.error ? ' · Abgleich fehlgeschlagen' : sync.syncing ? ' · gleicht ab …' : ' · synchronisiert'}</span>}
          </>
        }
      />

      <div className="widgets-wrap">
      <div className="widgets">
        {!semester.kind && (
          <Widget size="medium" to={`/semester/${semester.id}`} title="Semester einrichten" icon="settings" tint="var(--warn)">
            <div className="w-headline">Wie sieht deine Prüfungsphase aus?</div>
            <p className="w-caption">Dual mit allen Klausuren in einer Woche oder regulär über mehrere Wochen – danach richtet sich dein Lernplan.</p>
          </Widget>
        )}
        {exams.length === 0 ? (
          <Widget size="medium" to="/pruefung/neu" title="Loslegen" icon="plus">
            <div className="w-headline">Erste Prüfung anlegen</div>
            <p className="w-caption">Mit Termin und Wichtigkeit – danach Karten importieren und die App plant dein Lernen.</p>
          </Widget>
        ) : cards.length === 0 ? (
          <Widget size="medium" to="/import" title="Loslegen" icon="download">
            <div className="w-headline">Karten importieren</div>
            <p className="w-caption">Lade ein Kartenpaket für eine deiner Prüfungen – oder probiere das Beispielpaket aus.</p>
          </Widget>
        ) : (
          modes.map((m) => {
            const t = plan.modes[m]
            const left = t.reviewsLeft + t.newLeft
            const info = MODE_INFO[m]
            const budget = m === 'mobile' ? profile.minutesMobile : profile.minutesDesk
            return (
              <Widget
                key={m}
                size="medium"
                to={left > 0 ? `/lernen/${m}` : `/lernen/${m}?extra=${info.extra}`}
                title={info.title}
                icon={m === 'mobile' ? 'cards' : 'pencil'}
                label={`${info.title} lernen`}
              >
                <div className="w-split">
                  <div>
                    {left > 0 ? (
                      <>
                        <div className="w-number">{left}</div>
                        <div className="w-caption">{info.unit} heute</div>
                      </>
                    ) : (
                      <>
                        <div className="w-number done">✓</div>
                        <div className="w-caption">Für heute erledigt</div>
                      </>
                    )}
                  </div>
                  <div className="w-side">
                    {left > 0 ? (
                      <>
                        <span>{t.reviewsLeft} Wiederholungen</span>
                        <span>{t.newLeft} neu</span>
                        <span className="w-pill">ca. {t.minutesLeft} min · Start</span>
                      </>
                    ) : (
                      <span className="w-pill">{m === 'mobile' ? '10 extra' : '1 extra'}</span>
                    )}
                    {t.minutesNeeded > budget && <span className="w-warn">Budget zu knapp</span>}
                  </div>
                </div>
              </Widget>
            )
          })
        )}

        {next && nextPlan && (
          <Widget size="small" to={`/pruefung/${next.id}`} title="Nächste Klausur" icon="clock" tint={next.color}>
            <div className="w-number">{nextPlan.daysLeft}</div>
            <div className="w-caption">{nextPlan.daysLeft === 1 ? 'Tag' : 'Tage'}</div>
            <div className="w-foot truncate">{next.name}</div>
          </Widget>
        )}

        {total > 0 && (
          <Widget size="small" to="/pruefungen" title="Fortschritt" icon="chart">
            <div className="w-rings">
              <Rings outer={introduced / total} inner={forecast / total} size={76} />
              <div className="w-legend">
                <span><i style={{ background: 'var(--accent)' }} />{Math.round((introduced / total) * 100)} %</span>
                <span><i style={{ background: 'var(--ok)' }} />{Math.round((forecast / total) * 100)} %</span>
              </div>
            </div>
            <div className="w-foot">begonnen · Prognose</div>
          </Widget>
        )}

        {upcoming.length > 0 && (
          <Widget size={upcoming.length > 2 ? 'large' : 'medium'} to="/pruefungen" title="Prüfungen" icon="exams">
            <div className="w-list">
              {upcoming.slice(0, 5).map((e) => {
                const st = perExam.get(e.id)!
                const p = plan.exams.find((x) => x.examId === e.id)!
                return (
                  <div key={e.id} className="w-list-item">
                    <div className="row between">
                      <span className="row grow" style={{ gap: 8 }}>
                        <span className="dot" style={{ background: e.color }} />
                        <span className="truncate">{e.name}</span>
                      </span>
                      <small className={p.behind && st.total ? 'badge-warn' : ''}>{formatCountdown(p.daysLeft)}</small>
                    </div>
                    <Progress value={st.total ? st.introduced / st.total : 0} color={e.color} />
                  </div>
                )
              })}
              {upcoming.length > 5 && <small>+ {upcoming.length - 5} weitere</small>}
            </div>
          </Widget>
        )}

        <Widget size="small" to="/pruefungen" title="Lernserie" icon="flame" tint="var(--hard)">
          <div className="w-number">{days}</div>
          <div className="w-caption">{days === 1 ? 'Tag' : 'Tage'} in Folge</div>
          <DayBars values={counts} labels={dayLabels} />
        </Widget>

        <Widget size="small" to="/import" title="Importieren" icon="download">
          <div className="w-headline">Karten&shy;paket hinzufügen</div>
          <div className="w-foot">Neu oder Update</div>
        </Widget>

        <Widget size="small" to="/einstellungen" title="Einstellungen" icon="settings" tint="var(--subtle)">
          <div className="w-headline">{profile.minutesMobile + profile.minutesDesk} min</div>
          <div className="w-caption">Lernzeit pro Tag</div>
          <div className="w-foot">Profil, Semester, Sicherung</div>
        </Widget>

        <Widget size="small" to="/hilfe" title="Hilfe" icon="help" tint="var(--subtle)">
          <div className="w-headline">So funktioniert’s</div>
          <div className="w-foot">Installation, Erinnerung, Lernmethode</div>
        </Widget>
      </div>
      </div>
    </>
  )
}
