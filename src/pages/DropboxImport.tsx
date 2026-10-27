import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state'
import { importRemoteProfile, listRemoteProfiles, type RemoteProfile } from '../lib/syncService'
import { PageHeader } from '../components/ui'

/** Einrichtung eines weiteren Geräts: Profile aus der verbundenen Dropbox übernehmen. */
export function DropboxImport() {
  const { selectProfile } = useAppState()
  const navigate = useNavigate()
  const [remote, setRemote] = useState<RemoteProfile[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listRemoteProfiles('pending')
      .then(setRemote)
      .catch((e: Error) => setError(e.message))
  }, [])

  async function take(r: RemoteProfile) {
    setBusy(true)
    try {
      await importRemoteProfile(r)
      selectProfile(r.doc.profile.id)
      navigate('/', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader back title="Aus Dropbox laden" subtitle="Wähle das Profil, das auf dieses Gerät übernommen werden soll." />
      {error && <div className="notice warn">{error}</div>}
      {!remote && !error && <p className="muted">Suche Profile in deiner Dropbox …</p>}
      {remote?.length === 0 && (
        <div className="card empty stack">
          <p className="muted">In dieser Dropbox wurde noch kein Lernapp-Profil gefunden. Verbinde zuerst auf deinem anderen Gerät das Profil mit Dropbox (Einstellungen → Synchronisation).</p>
        </div>
      )}
      {remote && remote.length > 0 && (
        <div className="list">
          {remote.map((r) => (
            <div className="list-item" key={r.path}>
              <div className="grow">
                <b>{r.doc.profile.name}</b>
                <br />
                <small>
                  {r.doc.exams.length} {r.doc.exams.length === 1 ? 'Prüfung' : 'Prüfungen'} · {r.doc.cards.length} Karten · Stand {new Date(r.doc.savedAt).toLocaleString('de-DE')}
                </small>
              </div>
              <button className="btn small primary" disabled={busy} onClick={() => take(r)}>
                Übernehmen
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
