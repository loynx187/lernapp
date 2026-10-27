import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useActive } from '../state'
import { db, uid } from '../lib/db'
import { semesterKind, type SemesterKind } from '../lib/semesters'
import { PageHeader } from '../components/ui'
import { SemesterKindPicker } from '../components/SemesterKindPicker'

export function SemesterForm() {
  const { id } = useParams()
  const { profile } = useActive()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SemesterKind>('dual')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    db.semesters.get(id).then((s) => {
      if (!s) return
      setName(s.name)
      setKind(semesterKind(s))
    })
  }, [id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Bitte gib einen Namen ein.')
    if (id) {
      await db.semesters.update(id, { name: name.trim(), kind })
    } else {
      const sid = uid()
      await db.semesters.add({ id: sid, profileId: profile.id, name: name.trim(), kind, createdAt: Date.now() })
      await db.profiles.update(profile.id, { activeSemesterId: sid })
    }
    navigate(-1)
  }

  return (
    <form onSubmit={submit}>
      <PageHeader back title={id ? 'Semester bearbeiten' : 'Neues Semester'} />
      <div className="card">
        <label className="field">
          <span>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. 5. Semester WS 26/27" />
        </label>
        <div className="field">
          <span className="field-label">Prüfungsphase</span>
          <SemesterKindPicker value={kind} onChange={setKind} />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" type="submit">Speichern</button>
      </div>
    </form>
  )
}
