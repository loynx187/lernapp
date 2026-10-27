import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState, useActive } from '../state'
import { db, deleteProfile, deleteSemester, uid, type Profile } from '../lib/db'
import { createBackup, parseBackup, restoreBackup } from '../lib/backup'
import { readJsonFile, safeFileName, saveFile } from '../lib/packages'
import { isoDate } from '../lib/dates'
import { PageHeader } from '../components/ui'
import { useSync } from '../sync-state'
import { SEMESTER_KINDS } from '../lib/semesters'
import { removePdf } from '../lib/pdfs'
import { useLiveQuery } from 'dexie-react-hooks'
import { listBackups, restoreBackup as restoreDropboxBackup, type BackupEntry } from '../lib/syncService'

export function Settings() {
  const { profile, semester, semesters } = useActive()
  const { profiles, selectProfile } = useAppState()
  const sync = useSync()
  const pdfs = useLiveQuery(() => db.pdfs.toArray(), [])
  const [backups, setBackups] = useState<BackupEntry[] | null>(null)

  async function showBackups() {
    try {
      setBackups(await listBackups(profile.id))
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  async function restoreWeek(b: BackupEntry) {
    if (!confirm(`Profil auf die Sicherung aus ${b.week.replace('-KW', ', KW ')} zurücksetzen? Was du seitdem auf diesem Gerät gelernt hast, geht verloren.`)) return
    try {
      await restoreDropboxBackup(profile.id, b)
      setMessage('Sicherung wiederhergestellt.')
      setBackups(null)
    } catch (e) {
      setMessage((e as Error).message)
    }
  }
  const [message, setMessage] = useState('')
  const [storage, setStorage] = useState<{ persisted?: boolean; usage?: number }>({})

  useEffect(() => {
    const s = navigator.storage
    Promise.all([s?.persisted?.(), s?.estimate?.()]).then(([persisted, est]) => setStorage({ persisted, usage: est?.usage })).catch(() => {})
  }, [])

  const update = (patch: Partial<Profile>) => db.profiles.update(profile.id, patch)

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
      <PageHeader back title="Einstellungen" />
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
              <small style={{ display: 'block', marginLeft: 22 }}>{s.kind ? SEMESTER_KINDS[s.kind].label : 'Art der Prüfungsphase noch nicht festgelegt'}</small>
            </button>
            <Link className="btn small ghost" style={{ color: 'var(--accent)' }} to={`/semester/${s.id}`}>Ändern</Link>
            <button className="btn small ghost danger" onClick={() => removeSemester(s.id, s.name)} aria-label={`${s.name} löschen`}>Löschen</button>
          </div>
        ))}
        <div className="list-item">
          <Link className="btn small ghost" style={{ color: 'var(--accent)', marginLeft: -8 }} to="/semester/neu">Neues Semester hinzufügen</Link>
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
          <button className="btn grow" onClick={addProfile}>Neues Profil</button>
          <button className="btn danger grow" onClick={removeProfile}>Profil löschen</button>
        </div>
      </div>

      <div className="section-title">Synchronisation</div>
      <div className="card stack">
        {!sync.available ? (
          <p className="muted" style={{ margin: 0 }}>Die Dropbox-Synchronisation ist für diese App noch nicht eingerichtet.</p>
        ) : sync.connected ? (
          <>
            <p style={{ margin: 0 }}>
              <b>Mit Dropbox verbunden.</b>{' '}
              <span className="muted">
                {sync.syncing
                  ? 'Synchronisiere …'
                  : sync.lastSync
                    ? `Zuletzt abgeglichen: ${new Date(sync.lastSync).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`
                    : 'Noch nicht abgeglichen.'}
              </span>
            </p>
            {sync.error && <div className="notice warn" style={{ margin: 0 }}>{sync.error}</div>}
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              Dein Profil wird automatisch abgeglichen – beim Öffnen, nach dem Lernen und alle paar Minuten. Auf einem weiteren Gerät beim ersten Start „Profil von einem anderen Gerät laden“ wählen.
            </p>
            <div className="row">
              <button className="btn grow" onClick={() => sync.syncNow()} disabled={sync.syncing}>Jetzt abgleichen</button>
              <button className="btn danger grow" onClick={() => confirm('Verbindung zu Dropbox trennen? Deine Daten bleiben auf diesem Gerät und in Dropbox erhalten.') && sync.disconnect()}>
                Trennen
              </button>
            </div>
            {backups === null ? (
              <button className="btn small ghost" style={{ color: 'var(--accent)', alignSelf: 'flex-start', marginLeft: -8 }} onClick={showBackups}>
                Wochensicherungen anzeigen
              </button>
            ) : backups.length === 0 ? (
              <small>Noch keine Wochensicherung vorhanden – sie entsteht beim ersten Abgleich jeder Woche.</small>
            ) : (
              <div className="stack">
                <small>Einmal pro Woche legt die App eine Sicherung in deiner Dropbox ab (die letzten 8 bleiben erhalten).</small>
                {backups.map((b) => (
                  <div className="row between" key={b.path}>
                    <span>{b.week.replace('-KW', ' · KW ')}</span>
                    <button className="btn small" onClick={() => restoreWeek(b)}>Wiederherstellen</button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Gleicht dein Profil automatisch zwischen deinen Geräten ab (z. B. iPhone und iPad). Die App sieht nur ihren eigenen Ordner in deiner Dropbox. Ein kostenloses Dropbox-Konto reicht.
            </p>
            <button className="btn primary block" onClick={sync.connect}>Mit Dropbox verbinden</button>
          </>
        )}
      </div>

      <div className="section-title">Daten & Sicherung</div>
      <div className="card stack">
        <p className="muted" style={{ margin: 0 }}>
          Deine Daten liegen auf diesem Gerät
          {storage.usage !== undefined && ` (${(storage.usage / 1024 / 1024).toFixed(1)} MB)`}
          {sync.connected ? ' und in deiner Dropbox. ' : '. '}
          {storage.persisted === false && !sync.connected && 'Der Browser darf sie bei Speichermangel löschen – lege regelmäßig eine Sicherung an. '}
          Zusätzlich kannst du jederzeit eine Sicherungsdatei anlegen, z. B. in iCloud Drive.
        </p>
        <button className="btn block" onClick={exportBackup}>Sicherung exportieren</button>
        <label className="btn block">
          Sicherung wiederherstellen
          <input type="file" accept=".json,application/json" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
        </label>
      </div>

      {pdfs && pdfs.length > 0 && (
        <>
          <div className="section-title">Unterlagen auf diesem Gerät</div>
          <div className="list">
            {pdfs.map((p) => (
              <div className="list-item" key={p.name}>
                <div className="grow truncate">
                  {p.name}
                  <small style={{ display: 'block' }}>{(p.size / 1024 / 1024).toFixed(1)} MB</small>
                </div>
                <button className="btn small ghost danger" onClick={() => removePdf(p.name)}>Entfernen</button>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>Für „Folie ansehen“ zwischengespeichert. Entfernte Dateien werden bei Bedarf erneut aus Dropbox geladen oder ausgewählt.</p>
        </>
      )}

      <div className="section-title">Hilfe</div>
      <div className="card">
        <Link to="/hilfe">Installation, Erinnerungen & Lernmethode</Link>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>Lernapp {__APP_VERSION__}</p>
    </>
  )
}
