import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { db } from '../lib/db'
import { FSRS_PARAM_COUNT, parseFsrsWeights } from '../lib/scheduler'
import { PageHeader } from '../components/ui'

/** Ab dieser Zahl an Bewertungen lohnt sich die Anpassung an das eigene Lernverhalten. */
export const FSRS_HINT_REVIEWS = 1000

export function FsrsSettings() {
  const { profile } = useActive()
  const count = useLiveQuery(() => db.reviews.where('profileId').equals(profile.id).count(), [profile.id])
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save() {
    try {
      const w = parseFsrsWeights(text)
      await db.profiles.update(profile.id, { fsrsWeights: w, fsrsHintDismissed: true })
      setText('')
      setError('')
      setMessage('Persönliche Parameter gespeichert. Sie gelten ab der nächsten Bewertung.')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function reset() {
    if (!confirm('Wieder die Standardparameter verwenden?')) return
    await db.profiles.update(profile.id, { fsrsWeights: undefined })
    setMessage('Standardparameter aktiv.')
  }

  return (
    <>
      <PageHeader back title="Lernalgorithmus" subtitle="FSRS an dein eigenes Lernverhalten anpassen" />
      {message && <div className="notice">{message}</div>}

      <div className="card stack">
        <p style={{ margin: 0 }}>
          <b>Aktuell:</b> {profile.fsrsWeights ? 'persönliche Parameter' : 'Standardparameter'} · {count ?? '…'} Bewertungen
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>
          FSRS schätzt, wann du eine Karte vergessen würdest. Die Standardwerte stammen aus Millionen von Lernenden. Ab etwa {FSRS_HINT_REVIEWS.toLocaleString('de-DE')} eigenen Bewertungen lassen sich die Parameter an dein Gedächtnis anpassen – die Wiederholungen kommen dann genauer zum richtigen Zeitpunkt. Eine erneute Anpassung lohnt sich etwa einmal pro Semester.
        </p>
      </div>

      <div className="section-title">So geht’s</div>
      <div className="card">
        <ol className="help" style={{ margin: 0 }}>
          <li>Einstellungen → „Sicherung exportieren“ und die Datei sichern.</li>
          <li>
            In der Claude-App eine Claude-Code-Sitzung mit dem Repository <code>lernapp</code> starten, die Sicherung hochladen und schreiben: <i>„Bitte FSRS-Parameter aus meiner Sicherung optimieren.“</i>
          </li>
          <li>Claude antwortet mit einer Reihe aus {FSRS_PARAM_COUNT} Zahlen. Diese unten einfügen und speichern.</li>
        </ol>
      </div>

      <div className="card stack">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Parameter einfügen</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="0.4775, 1.2931, 2.6047, …" style={{ minHeight: 100 }} />
        </label>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <button className="btn primary block" disabled={!text.trim()} onClick={save}>Speichern</button>
        {profile.fsrsWeights && (
          <button className="btn danger block" onClick={reset}>Standardparameter verwenden</button>
        )}
        {!profile.fsrsWeights && !profile.fsrsHintDismissed && (count ?? 0) >= FSRS_HINT_REVIEWS && (
          <button className="btn block" onClick={() => db.profiles.update(profile.id, { fsrsHintDismissed: true })}>
            Hinweis auf der Übersicht ausblenden
          </button>
        )}
      </div>
    </>
  )
}
