import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { loadStudyData, updateSnapshots } from '../lib/study'
import { addDays, formatCountdown, isoDate, studyDate, studyDayStart } from '../lib/dates'
import { cardMode, type Mode } from '../lib/db'
import { examStats, streak } from '../lib/stats'
import { DayBars, PageHeader, Progress, Rings, Widget } from '../components/ui'
import { Link } from 'react-router-dom'
import { subjectsToday } from '../lib/planner'
import { useSync } from '../sync-state'
import { BACKUP_REMINDER_DAYS, lastBackup } from '../lib/backup'
import { db } from '../lib/db'
import { FSRS_HINT_REVIEWS } from './FsrsSettings'

const MODE_INFO: Record<Mode, { title: string; unit: string; one: string; extra: number }> = {
  mobile: { title: 'Unterwegs', unit: 'Karten', one: 'Karte', extra: 10 },
  desk: { title: 'Schreibtisch', unit: 'Aufgaben', one: 'Aufgabe', extra: 1 },
}

/** Startseite im Stil des iPadOS-Homescreens: Widgets führen zu den einzelnen Bereichen. */
export function Dashboard() {
  const { profile, semester } = useActive()
  const sync = useSync()
  const data = useLiveQuery(() => loadStudyData(profile), [profile])
  const reviewCount = useLiveQuery(() => db.reviews.where('profileId').equals(profile.id).count(), [profile.id])
  const backupAt = useLiveQuery(async () => (await lastBackup(profile.id)) ?? 0, [profile.id])

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
  // Ohne Dropbox: Erinnerung an eine Sicherungsdatei, sobald seit der letzten (bzw. dem ersten Lernen) eine Woche vergangen ist.
  const since = backupAt || Math.min(...logs.map((l) => l.reviewedAt))
  const backupDue =
    !sync.connected && backupAt !== undefined && logs.length && now - since >= BACKUP_REMINDER_DAYS * 864e5
      ? backupAt
        ? Math.floor((now - backupAt) / 864e5)
        : 0
      : null
  const modes = (['mobile', 'desk'] as Mode[]).filter((m) => cards.some((c) => cardMode(c) === m))
  // Nach Fach getrennt lernen: das Fach mit dem größten Rückstand zuerst
  const subjects = subjectsToday(plan)
  const examById = new Map(exams.map((e) => [e.id, e]))

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
  const today = studyDayStart(now)
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const counts = week.map((d) => logs.filter((l) => studyDate(l.reviewedAt) === isoDate(d)).length)
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
        {(reviewCount ?? 0) >= FSRS_HINT_REVIEWS && !profile.fsrsWeights && !profile.fsrsHintDismissed && (
          <Widget size="medium" to="/lernalgorithmus" title="Lernalgorithmus anpassen" icon="chart" tint="var(--ok)">
            <div className="w-headline">{reviewCount?.toLocaleString('de-DE')} Bewertungen geschafft</div>
            <p className="w-caption">Jetzt lässt sich der Wiederholungsplan an dein Gedächtnis anpassen – dauert 2 Minuten. Tippen für die Anleitung.</p>
          </Widget>
        )}

        {backupDue !== null && (
          <Widget size="medium" to="/einstellungen" title="Sicherung" icon="download" tint="var(--warn)">
            <div className="w-headline">{backupDue ? `Letzte Sicherung vor ${backupDue} Tagen` : 'Noch keine Sicherung'}</div>
            <p className="w-caption">Ohne Dropbox liegen deine Lerndaten nur auf diesem Gerät. Tippen und unter „Daten & Sicherung“ eine Sicherungsdatei anlegen, z. B. in iCloud Drive.</p>
          </Widget>
        )}

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
          <>
          {subjects.length > 1 &&
            subjects.map((s, i) => {
              const e = examById.get(s.examId)!
              return (
                <Widget
                  key={s.examId}
                  size="medium"
                  title={e.name}
                  icon="exams"
                  tint={e.color}
                  label={`${e.name} lernen`}
                  badge={i === 0 && <span className="w-badge">Empfohlen</span>}
                >
                  <div className="w-split">
                    <div>
                      <div className="w-number">{s.left.mobile + s.left.desk}</div>
                      <div className="w-caption">{s.behind ? <span className="w-warn">Rückstand</span> : 'heute offen'}</div>
                    </div>
                    <div className="w-side">
                      {(['mobile', 'desk'] as Mode[])
                        .filter((m) => s.left[m] > 0)
                        .map((m) => (
                          <Link key={m} className="w-pill" to={`/lernen/${m}?exam=${s.examId}`} aria-label={`${e.name}: ${MODE_INFO[m].title} lernen`}>
                            {s.left[m]} {s.left[m] === 1 ? MODE_INFO[m].one : MODE_INFO[m].unit} · {MODE_INFO[m].title}
                          </Link>
                        ))}
                    </div>
                  </div>
                </Widget>
              )
            })}
          {modes.map((m) => {
            const t = plan.modes[m]
            const left = t.reviewsLeft + t.newLeft
            const info = MODE_INFO[m]
            const budget = m === 'mobile' ? profile.minutesMobile : profile.minutesDesk
            return (
              <Widget
                key={m}
                size="medium"
                to={left > 0 ? `/lernen/${m}` : `/lernen/${m}?extra=${info.extra}`}
                title={subjects.length > 1 ? `${info.title} · alle Fächer` : info.title}
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
          })}
          </>
        )}

        {next && nextPlan && (
          <Widget size="small" to={`/pruefung/${next.id}`} title="Nächste Klausur" icon="clock" tint={next.color}>
            <div className="w-number">{nextPlan.daysLeft}</div>
            <div className="w-caption">{nextPlan.daysLeft === 1 ? 'Tag' : 'Tage'}</div>
            <div className="w-foot truncate">{next.name}</div>
          </Widget>
        )}

        {next && nextPlan && nextPlan.daysLeft <= 21 && cards.some((c) => c.examId === next.id) && (
          <Widget size="small" to={`/probeklausur/${next.id}`} title="Probeklausur" icon="pencil" tint={next.color}>
            <div className="w-headline">Unter Zeitdruck üben</div>
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
            <div className="w-foot">begonnen · Prognose{upcoming.some((e) => e.ongoing) && ' (vorläufig)'}</div>
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
