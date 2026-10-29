import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { db, type Exam, type Homework, type Reminder } from '../lib/db'
import { addDays, daysUntil, formatDate, isoDate } from '../lib/dates'
import { completeReminder, deleteReminder, homeworkReminderDate, isDueReminder, isOpenReminder, postponeReminder, reopenReminder, saveReminder, sortReminders } from '../lib/reminders'
import { PageHeader } from '../components/ui'

/** „heute“, „morgen“, „in 3 Tagen (03.11.2026)“, „seit 2 Tagen“ */
export function reminderLabel(r: Reminder, now = Date.now()) {
  const d = daysUntil(r.date, now)
  if (d < 0) return `seit ${-d} ${d === -1 ? 'Tag' : 'Tagen'}`
  if (d === 0) return 'heute'
  if (d === 1) return 'morgen'
  return `in ${d} Tagen (${formatDate(r.date)})`
}

/** Daten für Liste und Startseite: Erinnerungen des Profils samt Prüfungen und Hausaufgaben. */
export function useReminders() {
  const { profile } = useActive()
  return useLiveQuery(async () => {
    const [reminders, exams, homework] = await Promise.all([
      db.reminders.where('profileId').equals(profile.id).toArray(),
      db.exams.where('profileId').equals(profile.id).toArray(),
      db.homework.where('profileId').equals(profile.id).toArray(),
    ])
    return { reminders: sortReminders(reminders), exams: new Map(exams.map((e) => [e.id, e])), homework: new Map(homework.map((h) => [h.id, h])) }
  }, [profile.id])
}

/** Eine Erinnerung in einer Liste – mit „Erledigt“ (und auf der Übersicht „Morgen“), solange sie offen ist. */
export function ReminderRow({ r, exam, hw, compact }: { r: Reminder; exam?: Exam; hw?: Homework; compact?: boolean }) {
  const open = !r.doneAt && !hw?.doneAt
  const due = open && daysUntil(r.date) <= 0
  const meta = [open ? reminderLabel(r) : r.doneAt ? `erledigt am ${new Date(r.doneAt).toLocaleDateString('de-DE')}` : 'Hausaufgabe erledigt', exam?.name, hw && `zu „${hw.title}“`].filter(Boolean).join(' · ')
  const done = (
    <button className="btn small" onClick={() => completeReminder(r)} aria-label={`Erledigt: ${r.title}`}>Erledigt</button>
  )
  return (
    <div className={`reminder-row${compact ? ' compact' : ''}`}>
      <span className="dot" style={{ background: exam?.color ?? 'var(--muted)' }} />
      <div className="reminder-main">
        <Link to={`/erinnerung/${r.id}`} className="reminder-title">{r.title}</Link>
        <small className={due && daysUntil(r.date) < 0 ? 'badge-warn' : 'muted'}>{meta}</small>
        {open && !compact && (
          <span className="row" style={{ gap: 8, marginTop: 6 }}>
            {done}
            {due && <button className="btn small ghost" style={{ color: 'var(--accent)' }} onClick={() => postponeReminder(r)}>Auf morgen</button>}
          </span>
        )}
      </div>
      {open && compact && done}
    </div>
  )
}

/** Übersicht: fällige, spätere und erledigte Erinnerungen. */
export function RemindersList() {
  const data = useReminders()
  if (!data) return null
  const { reminders, exams, homework } = data
  const open = reminders.filter((r) => isOpenReminder(r, homework))
  const due = open.filter((r) => isDueReminder(r, homework))
  const later = open.filter((r) => !isDueReminder(r, homework))
  const done = reminders.filter((r) => !isOpenReminder(r, homework)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 20)

  const section = (title: string, items: Reminder[]) =>
    items.length > 0 && (
      <>
        <div className="section-title">{title}</div>
        <div className="card reminder-list">
          {items.map((r) => (
            <ReminderRow key={r.id} r={r} exam={r.examId ? exams.get(r.examId) : undefined} hw={r.homeworkId ? homework.get(r.homeworkId) : undefined} />
          ))}
        </div>
      </>
    )

  return (
    <>
      <PageHeader back title="Erinnerungen" action={<Link className="btn small" to="/erinnerung/neu">Neu</Link>} />
      {reminders.length === 0 && (
        <div className="card empty stack">
          <p className="muted">Noch keine Erinnerungen. Erinnerungen erscheinen ab ihrem Tag auf der Startseite – z. B. „Übungsblatt 3 schon am Wochenende bearbeiten“ oder „Altklausur beim Dozenten anfragen“.</p>
          <Link className="btn primary" to="/erinnerung/neu">Erinnerung hinzufügen</Link>
        </div>
      )}
      {section('Fällig', due)}
      {section('Später', later)}
      {section('Erledigt', done)}
    </>
  )
}

/** Neue Erinnerung anlegen oder bearbeiten – optional mit Prüfung oder Hausaufgabe verknüpft. */
export function ReminderForm() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const { profile, semester } = useActive()
  const navigate = useNavigate()
  const exams = useLiveQuery(() => db.exams.where('semesterId').equals(semester.id).sortBy('date'), [semester.id])
  const homework = useLiveQuery(() => db.homework.where('profileId').equals(profile.id).toArray(), [profile.id])
  const [existing, setExisting] = useState<Reminder>()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(isoDate(addDays(Date.now(), 1)))
  const [examId, setExamId] = useState(search.get('exam') ?? '')
  const [homeworkId, setHomeworkId] = useState(search.get('hausaufgabe') ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      db.reminders.get(id).then((r) => {
        if (!r) return
        setExisting(r)
        setTitle(r.title)
        setNote(r.note ?? '')
        setDate(r.date)
        setExamId(r.examId ?? '')
        setHomeworkId(r.homeworkId ?? '')
      })
      return
    }
    // Von einer Hausaufgabe aus: Titel, Fach und Tag vorschlagen
    const hwId = search.get('hausaufgabe')
    if (hwId)
      db.homework.get(hwId).then((h) => {
        if (!h) return
        setTitle(`„${h.title}“ bearbeiten`)
        setExamId(h.examId)
        setDate(homeworkReminderDate(h))
      })
  }, [id])

  function pickHomework(hid: string) {
    setHomeworkId(hid)
    const h = homework?.find((x) => x.id === hid)
    if (h) setExamId(h.examId)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Bitte gib einen Titel ein.')
    if (!date) return setError('Bitte wähle einen Tag.')
    await saveReminder({
      ...existing,
      profileId: profile.id,
      title: title.trim(),
      note: note.trim() || undefined,
      date,
      examId: examId || undefined,
      homeworkId: homeworkId || undefined,
      doneAt: existing?.doneAt,
    })
    navigate('/erinnerungen', { replace: true })
  }

  if (!exams || !homework) return null
  // Offene Hausaufgaben – und die schon verknüpfte, auch wenn sie inzwischen erledigt ist.
  const hwOptions = homework.filter((h) => !h.doneAt || h.id === homeworkId).sort((a, b) => a.due.localeCompare(b.due))
  return (
    <form onSubmit={submit}>
      <PageHeader back title={id ? 'Erinnerung bearbeiten' : 'Neue Erinnerung'} />
      <div className="card">
        <label className="field">
          <span>Woran erinnern?</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Übungsblatt 3 am Wochenende bearbeiten" />
        </label>
        <label className="field">
          <span>Notiz (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details, Links, was zu tun ist" style={{ minHeight: 70 }} />
        </label>
        <label className="field">
          <span>Ab wann?</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Hausaufgabe (optional)</span>
          <select value={homeworkId} onChange={(e) => pickHomework(e.target.value)}>
            <option value="">keine</option>
            {hwOptions.map((h) => (
              <option key={h.id} value={h.id}>{h.title} (Abgabe {formatDate(h.due)})</option>
            ))}
          </select>
          <small>Ist die Hausaufgabe erledigt, gilt auch die Erinnerung als erledigt.</small>
        </label>
        <label className="field">
          <span>Prüfung (optional)</span>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">keine</option>
            {exams.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </label>
        {error && <p className="badge-warn">{error}</p>}
        <button className="btn primary block" type="submit">Speichern</button>
      </div>
      {existing && (
        <div className="row" style={{ marginTop: 12 }}>
          {existing.doneAt ? (
            <button type="button" className="btn grow" onClick={() => reopenReminder(existing).then(() => navigate('/erinnerungen'))}>Wieder öffnen</button>
          ) : (
            <button type="button" className="btn grow" onClick={() => completeReminder(existing).then(() => navigate('/erinnerungen'))}>Erledigt</button>
          )}
          <button
            type="button"
            className="btn grow ghost danger"
            onClick={async () => {
              if (!confirm('Erinnerung löschen?')) return
              await deleteReminder(existing)
              navigate('/erinnerungen', { replace: true })
            }}
          >
            Löschen
          </button>
        </div>
      )}
    </form>
  )
}
