import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useActive } from '../state'
import { db, type Exam, type Mode, type ReportCategory, type StudyCard } from '../lib/db'
import { buildQueue } from '../lib/planner'
import { loadStudyData, recordReview, undoReview, type Undo } from '../lib/study'
import { previewIntervals, Rating, type Grade } from '../lib/scheduler'
import { toPlanCard } from '../lib/stats'
import { formatInterval } from '../lib/dates'
import { REPORT_CATEGORIES, reportCard } from '../lib/reports'
import { Rich } from '../components/Rich'
import { Icon, Progress } from '../components/ui'

/** Karten, die innerhalb dieser Zeit wieder fällig sind, kommen noch in derselben Sitzung dran. */
const REQUEUE_WITHIN = 30 * 60_000

const RATINGS: { r: Grade; label: string; key: string }[] = [
  { r: Rating.Again, label: 'Nochmal', key: '1' },
  { r: Rating.Hard, label: 'Schwer', key: '2' },
  { r: Rating.Good, label: 'Gut', key: '3' },
  { r: Rating.Easy, label: 'Einfach', key: '4' },
]

export function Session() {
  const { profile } = useActive()
  const params = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const mode: Mode = params.mode === 'desk' ? 'desk' : 'mobile'
  const examFilter = search.get('exam') ?? undefined
  const extra = Number(search.get('extra') ?? 0) || 0

  const [queue, setQueue] = useState<StudyCard[] | null>(null)
  const [exams, setExams] = useState<Map<string, Exam>>(new Map())
  const [reviewed, setReviewed] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [stepsShown, setStepsShown] = useState(0)
  const [undo, setUndo] = useState<Undo | null>(null)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportCategory, setReportCategory] = useState<ReportCategory>('fehler')
  const [reportNote, setReportNote] = useState('')
  const [reported, setReported] = useState<Set<string>>(new Set())
  const started = useRef(Date.now())
  const sessionStart = useRef(Date.now())

  useEffect(() => {
    let cancelled = false
    loadStudyData(profile).then((d) => {
      if (cancelled) return
      const byId = new Map(d.cards.map((c) => [c.id, c]))
      const order = buildQueue(d.plan, d.cards.map(toPlanCard), { mode, now: Date.now(), examId: examFilter, extraNew: extra })
      setExams(new Map(d.exams.map((e) => [e.id, e])))
      setQueue(order.map((p) => byId.get(p.id)!))
      started.current = Date.now()
    })
    return () => {
      cancelled = true
    }
    // Die Sitzung wird einmal beim Öffnen zusammengestellt und danach nicht neu geladen.
  }, [])

  const card = queue?.[0]
  const exam = card ? exams.get(card.examId) : undefined

  const resetCardUi = () => {
    setReporting(false)
    setRevealed(false)
    setSelected([])
    setStepsShown(0)
    started.current = Date.now()
  }

  const intervals = useMemo(
    () => (card && revealed ? previewIntervals(card.s, Date.now(), profile.retention, exam?.date, card.id) : null),
    [card, revealed, profile.retention, exam?.date],
  )

  const mcCorrect = card?.type === 'mc' && revealed ? sameSet(selected, card.correct ?? []) : null

  const rate = useCallback(
    async (r: Grade) => {
      if (!card || !queue || busy) return
      setBusy(true)
      try {
        const now = Date.now()
        const { updated, undo: u } = await recordReview(profile, exam, card, r, mode, now - started.current, now)
        const rest = queue.slice(1)
        if (updated.s.due - now < REQUEUE_WITHIN) rest.splice(Math.min(rest.length, 4), 0, updated)
        setQueue(rest)
        setUndo(u)
        setReviewed((n) => n + 1)
        resetCardUi()
      } finally {
        setBusy(false)
      }
    },
    [card, queue, busy, profile, exam, mode],
  )

  async function undoLast() {
    if (!undo || !queue || busy) return
    setBusy(true)
    try {
      await undoReview(undo)
      const restored = (await db.cards.get(undo.card.id)) ?? undo.card
      setQueue([restored, ...queue.filter((c) => c.id !== restored.id)])
      setReviewed((n) => Math.max(0, n - 1))
      setUndo(null)
      resetCardUi()
    } finally {
      setBusy(false)
    }
  }

  async function submitReport() {
    if (!card) return
    await reportCard(card, reportCategory, reportNote)
    setReported((s) => new Set(s).add(card.id))
    setReporting(false)
    setReportNote('')
  }

  const reveal = () => {
    if (!card) return
    if (card.type === 'task') setStepsShown(card.steps?.length ?? 0)
    setRevealed(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (!card || reporting || tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        reveal()
      } else if (revealed) {
        const hit = RATINGS.find((x) => x.key === e.key)
        if (hit) rate(hit.r)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!queue) return null

  const total = reviewed + queue.length
  const top = (
    <div className="session-top">
      <button className="btn ghost small" onClick={() => navigate('/')} aria-label="Sitzung beenden">
        <Icon name="close" />
      </button>
      <Progress value={total ? reviewed / total : 1} />
      {card && (
        <button className="btn ghost small" onClick={() => setReporting((r) => !r)} aria-label="Karte melden" aria-pressed={reporting}>
          <Icon name="flag" />
        </button>
      )}
      <button className="btn ghost small" onClick={undoLast} disabled={!undo || busy} aria-label="Letzte Bewertung rückgängig">
        <Icon name="undo" />
      </button>
    </div>
  )

  if (!card) {
    const minutes = Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000))
    return (
      <>
        {top}
        <div className="card empty stack">
          <h2>{reviewed ? 'Geschafft!' : 'Nichts fällig'}</h2>
          <p className="muted">
            {reviewed
              ? `${reviewed} ${reviewed === 1 ? 'Karte' : 'Karten'} in ca. ${minutes} min gelernt.`
              : 'Für diesen Modus ist gerade nichts geplant.'}
          </p>
          <Link className="btn primary block" to="/">Zur Übersicht</Link>
        </div>
      </>
    )
  }

  const isNew = card.s.state === 0
  const steps = card.steps ?? []

  return (
    <>
      {top}
      <article className="card flashcard">
        <div className="meta">
          {exam && (
            <span className="chip">
              <span className="dot" style={{ background: exam.color }} />
              {exam.name}
            </span>
          )}
          {card.chapterTitle && <span className="chip">{card.chapterTitle}</span>}
          {isNew && <span className="chip accent">neu</span>}
          {reported.has(card.id) && <span className="chip" style={{ color: 'var(--warn)' }}>gemeldet</span>}
        </div>

        <Rich text={card.front} cloze={card.type === 'cloze' ? (revealed ? 'back' : 'front') : 'none'} />
        {card.image && <img className="card-image" src={card.image} alt="" style={{ marginTop: 12 }} />}

        {card.type === 'mc' && card.options && (
          <div className="options">
            {(card.correct?.length ?? 0) > 1 && !revealed && <small>Mehrere Antworten möglich</small>}
            {card.options.map((o, i) => {
              const isSel = selected.includes(i)
              const isRight = card.correct?.includes(i)
              const cls = revealed ? (isRight ? 'correct' : isSel ? 'wrong' : '') : isSel ? 'selected' : ''
              return (
                <button
                  key={i}
                  className={`option ${cls}`}
                  disabled={revealed}
                  onClick={() =>
                    setSelected((s) =>
                      (card.correct?.length ?? 0) > 1 ? (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]) : [i],
                    )
                  }
                >
                  <Rich text={o} />
                </button>
              )
            })}
          </div>
        )}

        {card.type === 'task' && stepsShown > 0 && (
          <div className="steps">
            {steps.slice(0, stepsShown).map((s, i) => (
              <div className="step" key={i}>
                <b>Schritt {i + 1}</b>
                <Rich text={s} />
              </div>
            ))}
          </div>
        )}

        {revealed && (
          <>
            {card.type === 'mc' && (
              <p className={mcCorrect ? 'badge-good' : 'badge-warn'} style={{ marginTop: 12 }}>
                {mcCorrect ? 'Richtig!' : 'Leider nicht ganz – „Nochmal“ empfohlen.'}
              </p>
            )}
            {card.type === 'task' && card.result && (
              <div className="step result" style={{ marginTop: 12 }}>
                <b>Ergebnis</b>
                <Rich text={card.result} />
              </div>
            )}
            {card.back.trim() && (
              <>
                <hr />
                <Rich text={card.back} />
              </>
            )}
          </>
        )}

        {revealed && card.source && (card.source.file || card.source.slide !== undefined) && (
          <div className="source">
            Quelle: {card.source.file ?? 'Skript'}
            {card.source.slide !== undefined && `, Folie ${card.source.slide}`}
          </div>
        )}
      </article>

      {reporting && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Karte melden</h3>
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            Die Meldung wird gesammelt und bei der nächsten Paketerstellung von Claude bearbeitet (Prüfung → Meldungen → Exportieren).
          </p>
          <div className="row wrap" role="radiogroup" aria-label="Art des Problems">
            {REPORT_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={reportCategory === c.value}
                className={`chip${reportCategory === c.value ? ' accent' : ''}`}
                style={{ border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 14 }}
                onClick={() => setReportCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea value={reportNote} onChange={(e) => setReportNote(e.target.value)} placeholder="Was stimmt nicht? (optional)" style={{ minHeight: 90 }} />
          <div className="row">
            <button className="btn grow" onClick={() => setReporting(false)}>Abbrechen</button>
            <button className="btn primary grow" onClick={submitReport}>Melden</button>
          </div>
        </div>
      )}

      <div className="actions">
        {!revealed ? (
          card.type === 'task' && stepsShown < steps.length ? (
            <div className="row">
              <button className="btn grow" onClick={() => setStepsShown((n) => n + 1)}>
                {stepsShown === 0 ? 'Ersten Schritt zeigen' : 'Nächster Schritt'}
              </button>
              <button className="btn primary grow" onClick={reveal}>Lösung</button>
            </div>
          ) : (
            <button className="btn primary block" onClick={reveal} disabled={card.type === 'mc' && selected.length === 0}>
              {card.type === 'mc' ? 'Prüfen' : card.type === 'task' ? 'Lösung' : 'Antwort zeigen'}
            </button>
          )
        ) : (
          <div className="ratings">
            {RATINGS.map(({ r, label }) => (
              <button key={r} className={`r${r}`} onClick={() => rate(r)} disabled={busy}>
                {label}
                <small>{intervals ? formatInterval(intervals[r]) : ''}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function sameSet(a: number[], b: number[]) {
  return a.length === b.length && a.every((x) => b.includes(x))
}
