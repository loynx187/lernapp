import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { useSync } from '../sync-state'
import { db } from '../lib/db'
import { dropboxDocuments, findPdf, getPdfSync, matchFiles, removePdf, requiredDocuments, setPdfSync, storePdf } from '../lib/pdfs'
import { PageHeader } from '../components/ui'

/** Unterlagen für „Folie ansehen“: alle PDFs auf einmal zuordnen, Status je Gerät und Dropbox. */
export function Documents() {
  const { profile, semester } = useActive()
  const sync = useSync()
  const data = useLiveQuery(async () => {
    const exams = await db.exams.where('semesterId').equals(semester.id).sortBy('date')
    const docs = await requiredDocuments(exams.map((e) => e.id))
    const local = new Set((await db.pdfs.toCollection().primaryKeys()) as string[])
    return { exams, docs, local, pdfSync: await getPdfSync(profile.id) }
  }, [semester.id, profile.id])
  const [inDropbox, setInDropbox] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const refreshDropbox = () =>
    dropboxDocuments(profile.id)
      .then(setInDropbox)
      .catch(() => setInDropbox(new Set()))

  useEffect(() => {
    if (sync.connected) refreshDropbox()
  }, [sync.connected, profile.id])

  if (!data) return null
  const { exams, docs, local, pdfSync } = data
  const shareViaDropbox = sync.connected && pdfSync

  async function pickMany(list: FileList | null) {
    if (!list?.length) return
    const { matched, unmatched } = matchFiles([...list], docs.map((d) => d.name))
    setBusy(`Speichere ${matched.size} ${matched.size === 1 ? 'Datei' : 'Dateien'} …`)
    try {
      for (const [name, file] of matched) await storePdf(name, file, profile.id)
      setMessage(
        `${matched.size} ${matched.size === 1 ? 'Unterlage' : 'Unterlagen'} zugeordnet${shareViaDropbox ? ' und in Dropbox abgelegt' : ''}.` +
          (unmatched.length ? ` Nicht zuordenbar: ${unmatched.map((f) => f.name).join(', ')} – bei Bedarf unten einzeln zuweisen.` : ''),
      )
    } catch (e) {
      setMessage(`Gespeichert, aber Dropbox-Upload fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setBusy('')
      refreshDropbox()
    }
  }

  async function pickOne(name: string, file?: File) {
    if (!file) return
    setBusy(`Speichere ${name} …`)
    try {
      await storePdf(name, file, profile.id)
      setMessage(`${file.name} als „${name}“ gespeichert.`)
    } catch (e) {
      setMessage(`Gespeichert, aber Dropbox-Upload fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setBusy('')
      refreshDropbox()
    }
  }

  async function downloadAll() {
    const missing = docs.filter((d) => !local.has(d.name) && inDropbox.has(d.name.toLowerCase()))
    setBusy(`Lade ${missing.length} ${missing.length === 1 ? 'Unterlage' : 'Unterlagen'} …`)
    try {
      for (const d of missing) await findPdf(d.name, profile.id)
      setMessage('Alle Unterlagen sind jetzt auch offline auf diesem Gerät.')
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  const status = (name: string) =>
    local.has(name)
      ? { label: 'auf diesem Gerät', cls: 'badge-good' }
      : inDropbox.has(name.toLowerCase())
        ? { label: 'in Dropbox', cls: '' }
        : { label: 'fehlt', cls: 'badge-warn' }
  const missingHere = docs.filter((d) => !local.has(d.name))
  const loadable = missingHere.filter((d) => inDropbox.has(d.name.toLowerCase()))

  return (
    <>
      <PageHeader back title="Unterlagen" subtitle="Skripte für „Folie ansehen“" />
      {message && <div className="notice">{message}</div>}
      {busy && <div className="notice">{busy}</div>}

      <div className="card stack">
        <p style={{ margin: 0 }}>
          {docs.length === 0
            ? 'Die Karten dieses Semesters verweisen noch auf keine Unterlagen.'
            : `${docs.length - missingHere.length} von ${docs.length} Unterlagen auf diesem Gerät${loadable.length ? `, ${loadable.length} weitere in Dropbox` : ''}.`}
        </p>
        <label className="btn primary block">
          PDFs auswählen
          <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => pickMany(e.target.files)} />
        </label>
        <small>
          Tipp: In der Dateien-App den Ordner mit deinen Skripten öffnen, oben rechts „Auswählen“ und alle PDFs markieren. Die App ordnet sie anhand der Dateinamen den Karten zu.
        </small>
        {loadable.length > 0 && (
          <button className="btn block" onClick={downloadAll} disabled={!!busy}>
            Alle aus Dropbox laden (für offline)
          </button>
        )}
      </div>

      <div className="card stack">
        {sync.connected ? (
          <label className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={pdfSync} onChange={(e) => setPdfSync(profile.id, e.target.checked)} style={{ width: 20, height: 20, marginTop: 3 }} />
            <span>
              <b>Über Dropbox auf alle Geräte verteilen</b>
              <br />
              <small>Einmal ausgewählte Unterlagen landen in Dropbox (Apps → App-Ordner → Unterlagen) und öffnen sich auf deinen anderen Geräten automatisch.</small>
            </span>
          </label>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            <b>Mehrere Geräte?</b> Ohne Synchronisation wählst du die PDFs auf jedem Gerät einmal aus. Mit <Link to="/einstellungen">Dropbox-Sync</Link> reicht es einmal – die anderen Geräte laden sie dann selbst.
          </p>
        )}
        <details>
          <summary style={{ fontSize: 15 }}>Warum kann die App nicht direkt auf iCloud zugreifen?</summary>
          <p className="muted" style={{ marginTop: 8, fontSize: 15 }}>
            Apple erlaubt Web-Apps nicht, Ordner oder Dateipfade in iCloud Drive dauerhaft zu verknüpfen – beim Auswählen erhält die App immer eine Kopie der Datei. Deshalb speichert die App die Unterlagen selbst und verteilt sie bei Bedarf über deine Dropbox.
          </p>
        </details>
      </div>

      {exams.map((e) => {
        const own = docs.filter((d) => d.examIds.includes(e.id))
        if (!own.length) return null
        return (
          <div key={e.id}>
            <div className="section-title row" style={{ gap: 8 }}>
              <span className="dot" style={{ background: e.color }} />
              {e.name}
            </div>
            <div className="list">
              {own.map((d) => {
                const st = status(d.name)
                return (
                  <div className="list-item" key={d.name} style={{ flexWrap: 'wrap', rowGap: 4 }}>
                    <div className="grow" style={{ flexBasis: '100%' }}>
                      <div className="truncate" style={{ fontWeight: 500 }}>{d.name}</div>
                      <small>
                        {d.cards} Karten · <span className={st.cls}>{st.label}</span>
                      </small>
                    </div>
                    <label className="btn small ghost" style={{ color: 'var(--accent)', marginLeft: 'auto' }}>
                      {local.has(d.name) ? 'Ersetzen' : 'Auswählen'}
                      <input type="file" accept="application/pdf,.pdf" hidden onChange={(ev) => pickOne(d.name, ev.target.files?.[0])} />
                    </label>
                    {local.has(d.name) && (
                      <button className="btn small ghost danger" onClick={() => removePdf(d.name)}>Vom Gerät entfernen</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
