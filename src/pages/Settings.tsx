import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState, useActive } from '../state'
import { db, deleteProfile, deleteSemester, uid, type Profile } from '../lib/db'
import { createBackup, parseBackup, restoreBackup } from '../lib/backup'
import { readJsonFile, safeFileName, saveFile } from '../lib/packages'
import { isoDate } from '../lib/dates'
import { PageHeader } from '../components/ui'

export function Settings() {
  const { profile, semester, semesters } = useActive()
  const { profiles, selectProfile } = useAppState()
  const [message, setMessage] = useState('')
  const [storage, setStorage] = useState<{ persisted?: boolean; usage?: number }>({})

  useEffect(() => {
    const s = navigator.storage
    Promise.all([s?.persisted?.(), s?.estimate?.()]).then(([persisted, est]) => setStorage({ persisted, usage: est?.usage })).catch(() => {})
  }, [])

  const update = (patch: Partial<Profile>) => db.profiles.update(profile.id, patch)

  async function addSemester() {
    const name = prompt('Name des neuen Semesters', '')
    if (!name?.trim()) return
    const id = uid()
    await db.semesters.add({ id, profileId: profile.id, name: name.trim(), createdAt: Date.now() })
    await update({ activeSemesterId: id })
  }

  async function renameSemester(id: string, current: string) {
    const name = prompt('Neuer Name', current)
    if (name?.trim()) await db.semesters.update(id, { name: name.trim() })
  }

  async function removeSemester(id: string, name: string) {
    if (!confirm(`Semester „${name}“ mit allen Prüfungen, Karten und dem Lernfortschritt löschen?`)) return
    await deleteSemester(id)
    if (id === profile.activeSemesterId) {
      const rest = semesters.filter((s) => s.id !== id)
      await update({ activeSemesterId: rest[rest.length - 1]?.id })
    }
  }

  async function addProfile() {
    const name = prompt('Name des neuen Profils', '')
    if (!name?.trim()) return
    const id = uid()
    await db.profiles.add({ id, name: name.trim(), createdAt: Date.now(), minutesMobile: 20, minutesDesk: 30, retention: 0.9 })
    selectProfile(id)
  }

  async function removeProfile() {
    const typed = prompt(`Profil „${profile.name}“ mit allen Daten unwiderruflich löschen? Zum Bestätigen den Namen eingeben.`)
    if (typed !== profile.name) return
    await deleteProfile(profile.id)
    const next = profiles.find((p) => p.id !== profile.id)
    if (next) selectProfile(next.id)
  }

  async function exportBackup() {
    const b = await createBackup(profile.id)
    await saveFile(`lernapp-sicherung-${safeFileName(profile.name)}-${isoDate(Date.now())}.json`, JSON.stringify(b))
    setMessage('Sicherung erstellt.')
  }

  async function importBackup(file?: File) {
    if (!file) return
    try {
      const b = parseBackup(await readJsonFile(file))
      const exists = await db.profiles.get(b.profile.id)
      const q = exists
        ? `Profil „${b.profile.name}“ auf den Stand vom ${new Date(b.exportedAt).toLocaleString('de-DE')} zurücksetzen? Neuere Daten auf diesem Gerät gehen verloren.`
        : `Profil „${b.profile.name}“ aus der Sicherung wiederherstellen?`
      if (!confirm(q)) return
      await restoreBackup(b)
      selectProfile(b.profile.id)
      setMessage('Sicherung wiederhergestellt.')
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader title="Einstellungen" />
      {message && <div className="notice">{message}</div>}

      <div className="section-title">Lernplan</div>
      <div className="card">
        <label className="field">
          <span>Unterwegs (Karten): {profile.minutesMobile} min pro Tag</span>
          <input type="range" min={5} max={120} step={5} value={profile.minutesMobile} onChange={(e) => update({ minutesMobile: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Am Schreibtisch (Rechenaufgaben): {profile.minutesDesk} min pro Tag</span>
          <input type="range" min={0} max={240} step={15} value={profile.minutesDesk} onChange={(e) => update({ minutesDesk: Number(e.target.value) })} />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Zielsicherheit: {Math.round(profile.retention * 100)} %</span>
          <input type="range" min={0.8} max={0.95} step={0.01} value={profile.retention} onChange={(e) => update({ retention: Number(e.target.value) })} />
          <small>Wie sicher du eine Karte bei der nächsten Wiederholung noch wissen sollst. Höher = mehr Wiederholungen. 90 % ist ein guter Standard.</small>
        </label>
      </div>

      <div className="section-title">Semester</div>
      <div className="list">
        {semesters.map((s) => (
          <div className="list-item" key={s.id}>
            <button
              className="grow truncate"
              style={{ border: 'none', background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', padding: 0, cursor: 'pointer' }}
              onClick={() => update({ activeSemesterId: s.id })}
              aria-pressed={s.id === semester.id}
            >
              <span style={{ display: 'inline-block', width: 22, color: 'var(--accent)', fontWeight: 600 }}>{s.id === semester.id ? '✓' : ''}</span>
              {s.name}
            </button>
            <button className="btn small ghost" style={{ color: 'var(--accent)' }} onClick={() => renameSemester(s.id, s.name)}>Ändern</button>
            <button className="btn small ghost danger" onClick={() => removeSemester(s.id, s.name)} aria-label={`${s.name} löschen`}>Löschen</button>
          </div>
        ))}
        <div className="list-item">
          <button className="btn small ghost" style={{ color: 'var(--accent)', marginLeft: -8 }} onClick={addSemester}>Neues Semester hinzufügen</button>
        </div>
      </div>

      <div className="section-title">Profil</div>
      <div className="card stack">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Name</span>
          <input type="text" defaultValue={profile.name} onBlur={(e) => e.target.value.trim() && update({ name: e.target.value.trim() })} />
        </label>
        {profiles.length > 1 && (
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Profil wechseln</span>
            <select value={profile.id} onChange={(e) => selectProfile(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="row">
          <button className="btn grow" onClick={addProfile}>+ Neues Profil</button>
          <button className="btn danger grow" onClick={removeProfile}>Profil löschen</button>
        </div>
      </div>

      <div className="section-title">Daten & Sicherung</div>
      <div className="card stack">
        <p className="muted" style={{ margin: 0 }}>
          Alle Daten liegen nur auf diesem Gerät
          {storage.usage !== undefined && ` (${(storage.usage / 1024 / 1024).toFixed(1)} MB)`}.{' '}
          {storage.persisted === false && 'Der Browser darf sie bei Speichermangel löschen – lege regelmäßig eine Sicherung an. '}
          Mit einer Sicherungsdatei kannst du dein Profil auf ein anderes Gerät übertragen (z. B. über iCloud Drive). Automatische Synchronisation folgt in Phase 2.
        </p>
        <button className="btn block" onClick={exportBackup}>Sicherung exportieren</button>
        <label className="btn block">
          Sicherung wiederherstellen
          <input type="file" accept=".json,application/json" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
        </label>
      </div>

      <div className="section-title">Hilfe</div>
      <div className="card">
        <Link to="/hilfe">Installation, Erinnerungen & Lernmethode</Link>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>Lernapp {__APP_VERSION__}</p>
    </>
  )
}
