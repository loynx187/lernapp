import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { db } from '../lib/db'
import { importPackage, parsePackage, parseTextCards, readJsonFile, textToPackage, type CardPackage, type ImportResult } from '../lib/packages'
import { PageHeader } from '../components/ui'

export function Import() {
  const { semester } = useActive()
  const [search] = useSearchParams()
  const exams = useLiveQuery(() => db.exams.where('semesterId').equals(semester.id).sortBy('date'), [semester.id])
  const [examId, setExamId] = useState(search.get('exam') ?? '')
  const [pkg, setPkg] = useState<CardPackage | null>(null)
  const [existingVersion, setExistingVersion] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [text, setText] = useState('')
  const [textTitle, setTextTitle] = useState('')

  useEffect(() => {
    if (!examId && exams?.length) setExamId(exams[0].id)
  }, [exams, examId])

  useEffect(() => {
    setExistingVersion(null)
    if (pkg && examId) db.packages.get(`${examId}:${pkg.id}`).then((r) => setExistingVersion(r ? r.version : null))
  }, [pkg, examId])

  if (!exams) return null

  const load = (raw: unknown) => {
    setError('')
    setResult(null)
    try {
      setPkg(parsePackage(raw))
    } catch (e) {
      setPkg(null)
      setError((e as Error).message)
    }
  }

  async function onFile(file?: File) {
    if (!file) return
    try {
      load(await readJsonFile(file))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function loadExample() {
    try {
      const res = await fetch('beispiel-paket.json')
      load(await res.json())
    } catch {
      setError('Das Beispielpaket konnte nicht geladen werden.')
    }
  }

  const textPairs = text.trim() ? parseTextCards(text) : []

  async function doImport(p: CardPackage) {
    const exam = exams!.find((e) => e.id === examId)
    if (!exam) return setError('Bitte wähle eine Prüfung.')
    try {
      setResult(await importPackage(exam, p))
      setPkg(null)
      setText('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader back title="Karten importieren" />

      {exams.length === 0 ? (
        <div className="card empty stack">
          <p className="muted">Lege zuerst eine Prüfung an, in die die Karten importiert werden.</p>
          <Link className="btn primary" to="/pruefung/neu">Prüfung anlegen</Link>
        </div>
      ) : (
        <>
          <div className="card">
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Für welche Prüfung?</span>
              <select value={examId} onChange={(e) => setExamId(e.target.value)}>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
          </div>

          {result && (
            <div className="notice">
              <b>Import abgeschlossen.</b> {result.added} neu, {result.updated} aktualisiert, {result.unchanged} unverändert
              {result.restored > 0 && `, ${result.restored} wiederhergestellt`}
              {result.archived > 0 && `, ${result.archived} archiviert (nicht mehr im Paket)`}
              {result.resolvedReports > 0 && `, ${result.resolvedReports} ${result.resolvedReports === 1 ? 'Meldung' : 'Meldungen'} erledigt`}. Dein Lernplan wurde angepasst.{' '}
              <Link to={`/pruefung/${examId}`}>Zur Prüfung</Link>
            </div>
          )}
          {error && <div className="notice warn">{error}</div>}

          {pkg ? (
            <div className="card stack">
              <h2>{pkg.title}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {pkg.cards.length} Karten · {pkg.chapters?.length ?? 0} Kapitel · Version {pkg.version}
              </p>
              {existingVersion !== null && (
                <div className="notice" style={{ margin: 0 }}>
                  Dieses Paket ist bereits importiert (Version {existingVersion}). Es wird aktualisiert – dein Lernfortschritt bleibt erhalten.
                </div>
              )}
              <div className="row">
                <button className="btn grow" onClick={() => setPkg(null)}>Abbrechen</button>
                <button className="btn primary grow" onClick={() => doImport(pkg)}>
                  {existingVersion !== null ? 'Aktualisieren' : 'Importieren'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="section-title">Kartenpaket</div>
              <div className="card stack">
                <p className="muted" style={{ margin: 0 }}>Eine <code>.lernpaket.json</code>-Datei, z. B. von Claude erstellt oder von Kommilitonen geteilt.</p>
                <label className="btn primary block">
                  Datei auswählen
                  <input type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
                <button className="btn block" onClick={loadExample}>Beispielpaket ausprobieren</button>
              </div>

              <div className="card stack">
                <details>
                  <summary>So entstehen Kartenpakete aus deinen Unterlagen</summary>
                  <ol className="help" style={{ marginTop: 8 }}>
                    <li>In der Claude-App eine neue Claude-Code-Sitzung mit dem Repository <code>lernapp</code> starten.</li>
                    <li>Die PDFs hochladen – Skript, Übungsaufgaben und Altklausuren, soweit vorhanden.</li>
                    <li>
                      <code>/kartenpaket &lt;Fach&gt;</code> schreiben, z. B. <code>/kartenpaket Thermodynamik</code>. Bei einem neuen Fach stellt Claude einmalig ein paar Fragen zu Prüfung und Schwerpunkten.
                    </li>
                    <li>
                      <b>Update eines bestehenden Pakets</b> (z. B. neue Folien): zusätzlich das bisherige Paket hochladen – hier in der App unter Prüfung → Kartenpakete → „Teilen“ → „In Dateien sichern“. Sonst geht der Lernfortschritt verloren.
                    </li>
                    <li>Die fertige <code>.lernpaket.json</code> sichern und hier über „Datei auswählen“ importieren. Dein Lernplan passt sich automatisch an.</li>
                  </ol>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Claude arbeitet dabei immer dieselbe Checkliste ab und berücksichtigt die Schwerpunkte des jeweiligen Fachs. Unterlagen und Pakete werden nicht im (öffentlichen) Repository gespeichert.
                  </p>
                </details>
              </div>

              <div className="section-title">Text einfügen</div>
              <div className="card">
                <p className="muted">
                  Für Frage-Antwort-Paare aus NotebookLM, Quizlet o. Ä.: pro Zeile <code>Frage ;; Antwort</code> oder durch Tab getrennt – oder Blöcke mit <code>F:</code> und <code>A:</code>.
                </p>
                <label className="field">
                  <span>Titel</span>
                  <input type="text" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="z. B. Kapitel 3 Definitionen" />
                </label>
                <label className="field">
                  <span>Text</span>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'Was ist die Streckgrenze? ;; Spannung, ab der plastische Verformung beginnt.'} />
                </label>
                <button
                  className="btn primary block"
                  disabled={!textPairs.length}
                  onClick={() => doImport(textToPackage(textTitle.trim() || 'Eingefügte Karten', textPairs))}
                >
                  {textPairs.length ? `${textPairs.length} Karten importieren` : 'Keine Karten erkannt'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
