import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db, type Exam, type ExamProfile, type ProfileField, type TaskShare } from '../lib/db'
import { examSlug } from '../lib/profile'
import { PageHeader } from '../components/ui'

const SHARES: { v: TaskShare | undefined; label: string }[] = [
  { v: undefined, label: 'Offen' },
  { v: 'keine', label: 'Keine' },
  { v: 'wenig', label: 'Wenig' },
  { v: 'mittel', label: 'Mittel' },
  { v: 'hoch', label: 'Hoch' },
]

type TextField = 'form' | 'aids' | 'focus' | 'omit' | 'notation' | 'notes'

export function ExamProfilePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState<Exam>()
  const [p, setP] = useState<ExamProfile>({})

  useEffect(() => {
    db.exams.get(id).then((e) => {
      setExam(e)
      setP(e?.profile ?? {})
    })
  }, [id])

  if (!exam) return null
  const suggested = new Set(p.suggested ?? [])

  const set = (k: ProfileField, v: unknown) => {
    suggested.delete(k)
    setP({ ...p, [k]: v === '' ? undefined : v, suggested: [...suggested] })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    // Speichern bestätigt auch die Vorschläge von Claude.
    const { suggested: _s, ...rest } = p
    const profile = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== '')) as ExamProfile
    await db.exams.update(id, { profile: { ...profile, slug: examSlug(exam!) } })
    navigate(`/pruefung/${id}`, { replace: true })
  }

  const label = (k: ProfileField, text: string): ReactNode => (
    <span className="row between">
      {text}
      {suggested.has(k) && <span className="chip accent">Vorschlag von Claude</span>}
    </span>
  )

  const text = (k: TextField, title: string, placeholder: string, multiline = false) => (
    <label className="field">
      <span className="field-label">{label(k, title)}</span>
      {multiline ? (
        <textarea value={p[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} rows={3} style={{ minHeight: 84 }} />
      ) : (
        <input type="text" value={p[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
      )}
    </label>
  )

  return (
    <form onSubmit={submit}>
      <PageHeader back title="Fachprofil" subtitle={exam.name} />
      <p className="muted" style={{ fontSize: 14 }}>
        Damit erstellt Claude die Karten passend zur Prüfung. Alles ist optional: Was leer bleibt, leitet Claude aus den Unterlagen ab oder fragt nach – und
        schlägt es dir mit dem nächsten Kartenpaket vor. Mit „Speichern“ bestätigst du die Vorschläge.
      </p>

      <div className="section-title">Prüfung</div>
      <div className="card">
        {text('form', 'Prüfungsform', 'z. B. schriftliche Klausur')}
        <label className="field">
          <span className="field-label">{label('duration', 'Dauer in Minuten')}</span>
          <input type="number" inputMode="numeric" min={0} value={p.duration ?? ''} onChange={(e) => set('duration', e.target.value ? Math.round(Number(e.target.value)) : '')} placeholder="z. B. 120" />
        </label>
        {text('aids', 'Hilfsmittel', 'z. B. Taschenrechner, 1 Seite Formelsammlung')}
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">{label('taskShare', 'Anteil Rechenaufgaben')}</span>
          <div className="segmented" role="radiogroup" aria-label="Anteil Rechenaufgaben">
            {SHARES.map((s) => (
              <button type="button" key={s.label} role="radio" aria-checked={p.taskShare === s.v} className={p.taskShare === s.v ? 'on' : ''} onClick={() => set('taskShare', s.v)}>
                {s.label}
              </button>
            ))}
          </div>
          <small>„Offen“: Claude richtet sich nach Unterlagen und Altklausuren.</small>
        </div>
      </div>

      <div className="section-title">Karten</div>
      <div className="card">
        {text('focus', 'Schwerpunkte', 'z. B. Dozent: Kapitel 3 und 5 sind klausurrelevant, Definitionen wörtlich', true)}
        {text('omit', 'Weglassen', 'z. B. Herleitungen, historische Hintergründe', true)}
        {text('notation', 'Notation', 'z. B. σ für Normalspannung, Einheiten in N und mm', true)}
        {text('notes', 'Sonstiges', 'Alles, was Claude sonst wissen sollte', true)}
        <small className="muted">Ordner im Inhalte-Archiv: {examSlug(exam)}</small>
      </div>

      <button className="btn primary block" type="submit">Speichern</button>
    </form>
  )
}
