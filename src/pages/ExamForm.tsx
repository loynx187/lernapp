import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useActive } from '../state'
import { db, deleteExam, EXAM_COLORS, MAX_EXAMS_PER_SEMESTER, uid } from '../lib/db'
import { addDays, isoDate } from '../lib/dates'
import { PageHeader } from '../components/ui'
import { DEFAULT_ONGOING_DAYS } from '../lib/semesters'

const WEIGHTS = [
  { v: 1, label: 'Niedrig' },
  { v: 2, label: 'Normal' },
  { v: 3, label: 'Hoch' },
]

export function ExamForm() {
  const { id } = useParams()
  const { profile, semester } = useActive()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [date, setDate] = useState(isoDate(addDays(Date.now(), 60)))
  const [weight, setWeight] = useState(2)
  const [color, setColor] = useState(EXAM_COLORS[0])
  const [ongoing, setOngoing] = useState(false)
  const [ongoingDays, setOngoingDays] = useState(String(DEFAULT_ONGOING_DAYS))
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      db.exams.get(id).then((e) => {
        if (!e) return
        setName(e.name)
        setDate(e.date)
        setWeight(e.weight)
        setColor(e.color)
        setOngoing(!!e.ongoing)
        setOngoingDays(String(e.ongoingDays ?? DEFAULT_ONGOING_DAYS))
      })
    } else {
      db.exams.where('semesterId').equals(semester.id).toArray().then((list) => {
        const used = new Set(list.map((e) => e.color))
        setColor(EXAM_COLORS.find((c) => !used.has(c)) ?? EXAM_COLORS[list.length % EXAM_COLORS.length])
      })
    }
  }, [id, semester.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Bitte gib einen Namen ein.')
    if (!date) return setError('Bitte wähle einen Termin.')
    const days = Math.round(Number(ongoingDays))
    if (ongoing && !(days >= 1 && days <= 60)) return setError('Bitte gib für die laufende Vorlesung 1 bis 60 Tage an.')
    const lecture = { ongoing: ongoing || undefined, ongoingDays: ongoing && days !== DEFAULT_ONGOING_DAYS ? days : undefined }
    if (id) {
      await db.exams.update(id, { name: name.trim(), date, weight, color, ...lecture })
      navigate(`/pruefung/${id}`, { replace: true })
    } else {
      const count = await db.exams.where('semesterId').equals(semester.id).count()
      if (count >= MAX_EXAMS_PER_SEMESTER) return setError(`Maximal ${MAX_EXAMS_PER_SEMESTER} Prüfungen pro Semester.`)
      const newId = uid()
      await db.exams.add({ id: newId, profileId: profile.id, semesterId: semester.id, name: name.trim(), date, weight, color, createdAt: Date.now(), ...lecture })
      navigate(`/pruefung/${newId}`, { replace: true })
    }
  }

  async function remove() {
    if (!id || !confirm('Prüfung mit allen Karten und dem Lernfortschritt löschen?')) return
    await deleteExam(id)
    navigate('/pruefungen', { replace: true })
  }

  return (
    <form onSubmit={submit}>
      <PageHeader back title={id ? 'Prüfung bearbeiten' : 'Neue Prüfung'} />
      <div className="card">
        <label className="field">
          <span>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Thermodynamik II" />
        </label>
        <label className="field">
          <span>Klausurtermin</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="field">
          <span className="field-label">Wichtigkeit</span>
          <div className="segmented" role="radiogroup" aria-label="Wichtigkeit">
            {WEIGHTS.map((w) => (
              <button type="button" key={w.v} role="radio" aria-checked={weight === w.v} className={weight === w.v ? 'on' : ''} onClick={() => setWeight(w.v)}>
                {w.label}
              </button>
            ))}
          </div>
          <small>Bei knapper Zeit bekommen wichtigere Prüfungen mehr vom Tagesbudget (z. B. nach ECTS oder Schwierigkeit).</small>
        </div>
        <div className="field">
          <label className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} style={{ width: 20, height: 20, marginTop: 3 }} />
            <span>
              <b>Vorlesung läuft noch</b>
              <br />
              <small style={{ marginTop: 2 }}>Weitere Unterlagen folgen. Neuer Stoff wird dann zeitnah begonnen, statt bis zur Klausur gestreckt zu werden. Ausschalten, sobald alle Unterlagen da sind.</small>
            </span>
          </label>
          {ongoing && (
            <label className="row" style={{ gap: 10, marginTop: 12 }}>
              <span className="grow">Neuen Stoff beginnen innerhalb von</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={ongoingDays}
                onChange={(e) => setOngoingDays(e.target.value)}
                aria-label="Tage bis neuer Stoff begonnen ist"
                style={{ width: 72, textAlign: 'center' }}
              />
              <span>Tagen</span>
            </label>
          )}
        </div>
        <div className="field">
          <span className="field-label">Farbe</span>
          <div className="row wrap">
            {EXAM_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Farbe ${c}`}
                style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }}
              />
            ))}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" type="submit">Speichern</button>
      </div>
      {id && (
        <button type="button" className="btn danger block" onClick={remove}>Prüfung löschen</button>
      )}
    </form>
  )
}
