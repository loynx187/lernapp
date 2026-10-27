import { useState, type FormEvent } from 'react'
import { db, uid } from '../lib/db'
import { useAppState } from '../state'

/** Erster Start: Profil und erstes Semester anlegen. Auch nach dem Löschen des letzten Semesters. */
export function Onboarding() {
  const { profile, selectProfile } = useAppState()
  const [name, setName] = useState('')
  const [semesterName, setSemesterName] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const now = Date.now()
    let pid = profile?.id
    if (!pid) {
      pid = uid()
      await db.profiles.add({ id: pid, name: name.trim() || 'Ich', createdAt: now, minutesMobile: 20, minutesDesk: 30, retention: 0.9 })
      // Bittet den Browser, die Daten nicht automatisch zu löschen.
      navigator.storage?.persist?.().catch(() => {})
    }
    const sid = uid()
    await db.semesters.add({ id: sid, profileId: pid, name: semesterName.trim() || 'Semester 1', createdAt: now })
    await db.profiles.update(pid, { activeSemesterId: sid })
    selectProfile(pid)
  }

  return (
    <form onSubmit={submit} className="stack" style={{ paddingTop: 24 }}>
      <img src="icon.svg" alt="" width={64} height={64} />
      <h1>{profile ? 'Neues Semester' : 'Willkommen'}</h1>
      <p className="muted">
        {profile
          ? 'Lege ein Semester an, um Prüfungen hinzuzufügen.'
          : 'Die App plant dein Lernen rückwärts von den Klausurterminen – mit wissenschaftlich fundierter Wiederholung (FSRS). Deine Daten bleiben auf diesem Gerät.'}
      </p>
      {!profile && (
        <label className="field">
          <span>Dein Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vorname" autoComplete="given-name" />
        </label>
      )}
      <label className="field">
        <span>Semester</span>
        <input type="text" value={semesterName} onChange={(e) => setSemesterName(e.target.value)} placeholder="z. B. 5. Semester WS 26/27" />
      </label>
      <button className="btn primary block" type="submit">
        Los geht’s
      </button>
    </form>
  )
}
