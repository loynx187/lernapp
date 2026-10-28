import { useState, type FormEvent } from 'react'
import { db, requestPersistentStorage, uid } from '../lib/db'
import { useAppState } from '../state'
import { DROPBOX_APP_KEY, startAuth } from '../lib/dropbox'
import type { SemesterKind } from '../lib/semesters'
import { SemesterKindPicker } from '../components/SemesterKindPicker'
import { readJsonFile } from '../lib/packages'
import { importTemplate, parseTemplate } from '../lib/template'

/** Erster Start: Profil und erstes Semester anlegen. Auch nach dem Löschen des letzten Semesters. */
export function Onboarding() {
  const { profile, selectProfile } = useAppState()
  const [name, setName] = useState('')
  const [semesterName, setSemesterName] = useState('')
  const [kind, setKind] = useState<SemesterKind>('dual')
  const [error, setError] = useState('')

  async function ensureProfile(now: number) {
    if (profile?.id) return profile.id
    const pid = uid()
    await db.profiles.add({ id: pid, name: name.trim() || 'Ich', createdAt: now, minutesMobile: 20, minutesDesk: 30, retention: 0.9 })
    requestPersistentStorage()
    // Bittet den Browser, die Daten nicht automatisch zu löschen.
    navigator.storage?.persist?.().catch(() => {})
    return pid
  }

  /** Vorlage von Kommilitonen: Profil, Semester, Prüfungen und Karten in einem Schritt. */
  async function fromTemplate(file?: File) {
    if (!file) return
    setError('')
    try {
      const t = parseTemplate(await readJsonFile(file))
      const pid = await ensureProfile(Date.now())
      await importTemplate(pid, t)
      selectProfile(pid)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const now = Date.now()
    const pid = await ensureProfile(now)
    const sid = uid()
    await db.semesters.add({ id: sid, profileId: pid, name: semesterName.trim() || 'Semester 1', kind, createdAt: now })
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
      <div className="field">
        <span className="field-label">Prüfungsphase</span>
        <SemesterKindPicker value={kind} onChange={setKind} />
      </div>
      <button className="btn primary block" type="submit">
        Los geht’s
      </button>
      {error && <div className="notice warn">{error}</div>}
      <label className="btn block">
        Vorlage von Kommilitonen übernehmen
        <input type="file" accept=".json,application/json" hidden onChange={(e) => { fromTemplate(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      <small className="muted">Eine Vorlage (Einstellungen → „Vorlage exportieren“) enthält Semester, Prüfungen und alle Karten ohne Lernfortschritt – damit ist alles in einem Schritt eingerichtet.</small>
      {!profile && DROPBOX_APP_KEY && (
        <button className="btn block" type="button" onClick={() => startAuth()}>
          Profil von einem anderen Gerät laden (Dropbox)
        </button>
      )}
    </form>
  )
}
