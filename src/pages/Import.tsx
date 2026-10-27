import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { db } from '../lib/db'
import { importPackage, parsePackage, parseTextCards, textToPackage, type CardPackage, type ImportResult } from '../lib/packages'
import { OTHER_AI_PROMPT } from '../lib/textCards'
import { PageHeader } from '../components/ui'
import { applyProfile, fieldLabel, matchExam, parseProfilesFile, PROFILES_FORMAT, type ProfileEntry } from '../lib/profile'

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
  const [profiles, setProfiles] = useState<ProfileEntry[] | null>(null)
  const [profilesDone, setProfilesDone] = useState<string[] | null>(null)
  const [promptCopied, setPromptCopied] = useState(false)

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
    setProfilesDone(null)
    try {
      if ((raw as { format?: unknown })?.format === PROFILES_FORMAT) {
        setPkg(null)
        setProfiles(parseProfilesFile(raw))
        return
      }
      setProfiles(null)
      setPkg(parsePackage(raw))
    } catch (e) {
      setPkg(null)
      setError((e as Error).message)
    }
  }

  /** Kartenpakete und Fachprofile direkt laden; alles andere (Anki, Quizlet, CSV, Markdown, fremdes JSON) als Text. */
  async function onFile(file?: File) {
    if (!file) return
    setError('')
    const content = await file.text()
    let raw: unknown
    try {
      raw = JSON.parse(content)
    } catch {
      raw = undefined
    }
    const format = (raw as { format?: unknown } | undefined)?.format
    if (format) return load(raw)
    setPkg(null)
    setProfiles(null)
    setResult(null)
    setText(content)
    setTextTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim())
    if (!parseTextCards(content).length) setError('In der Datei wurden keine Karten erkannt. Unterstützt: Kartenpakete, F:/A:-Text, Tab-/Semikolon-/CSV-Listen, Markdown-Tabellen, JSON-Listen mit Frage und Antwort.')
    else setTimeout(() => document.getElementById('text-import')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(OTHER_AI_PROMPT)
      setPromptCopied(true)
    } catch {
      setError('Kopieren nicht möglich – die Vorlage steht unten zum Markieren.')
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
  const textPkg = textPairs.length ? textToPackage(textTitle.trim() || 'Eingefügte Karten', textPairs) : null
  const textChapters = textPkg?.chapters?.length ?? 0

  async function importProfiles(entries: ProfileEntry[]) {
    const done: string[] = []
    for (const entry of entries) {
      const exam = matchExam(exams!, entry)
      if (!exam) continue
      const changed = await applyProfile(exam.id, entry.profile, true)
      done.push(changed.length ? `${exam.name} (${changed.map(fieldLabel).join(', ')})` : `${exam.name} (unverändert)`)
    }
    setProfiles(null)
    setProfilesDone(done)
  }

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
              {result.deleted > 0 && `, ${result.deleted} von dir gelöscht (bleiben gelöscht)`}
              {result.resolvedReports > 0 && `, ${result.resolvedReports} ${result.resolvedReports === 1 ? 'Meldung' : 'Meldungen'} erledigt`}. Dein Lernplan wurde angepasst.{' '}
              <Link to={`/pruefung/${examId}`}>Zur Prüfung</Link>
            </div>
          )}
          {result && result.profileFields.length > 0 && (
            <div className="notice">
              Claude hat fürs Fachprofil vorgeschlagen: {result.profileFields.map(fieldLabel).join(', ')}. <Link to={`/pruefung/${examId}/profil`}>Prüfen</Link>
            </div>
          )}
          {profilesDone && (
            <div className="notice">
              <b>Fachprofile übernommen:</b> {profilesDone.join(' · ') || 'keine passende Prüfung gefunden'}. Die Vorschläge sind im Fachprofil der jeweiligen Prüfung markiert.
            </div>
          )}
          {error && <div className="notice warn">{error}</div>}

          {profiles ? (
            <div className="card stack">
              <h2>Fachprofile von Claude</h2>
              {profiles.map((entry, i) => {
                const exam = matchExam(exams, entry)
                return (
                  <div key={i} className="row between">
                    <span>{entry.name ?? entry.slug}</span>
                    <small className={exam ? '' : 'badge-warn'}>{exam ? `→ ${exam.name}` : 'keine passende Prüfung'}</small>
                  </div>
                )
              })}
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>Die Angaben ersetzen die bisherigen Felder und werden als Vorschlag markiert, bis du das Fachprofil speicherst.</p>
              <div className="row">
                <button className="btn grow" onClick={() => setProfiles(null)}>Abbrechen</button>
                <button className="btn primary grow" disabled={!profiles.some((e) => matchExam(exams, e))} onClick={() => importProfiles(profiles)}>
                  Übernehmen
                </button>
              </div>
            </div>
          ) : pkg ? (
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
                <p className="muted" style={{ margin: 0 }}>Eine <code>.lernpaket.json</code>-Datei, z. B. von Claude erstellt oder von Kommilitonen geteilt, eine Datei mit Fachprofilen von Claude – oder Karten aus ChatGPT, Anki, Quizlet &amp; Co. (.txt, .csv, .md, siehe unten).</p>
                <label className="btn primary block">
                  Datei auswählen
                  <input type="file" accept=".json,.txt,.csv,.tsv,.md,application/json,text/plain,text/csv,text/markdown" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
                </label>
                <button className="btn block" onClick={loadExample}>Beispielpaket ausprobieren</button>
              </div>

              <div className="card stack">
                <details>
                  <summary>So entstehen Kartenpakete aus deinen Unterlagen</summary>
                  <ol className="help" style={{ marginTop: 8 }}>
                    <li>Auf der Seite der Prüfung unter „Karten mit Claude erstellen“ auf „Auftrag für Claude kopieren“ tippen. Der Auftrag enthält Fach, Klausurtermin, dein Fachprofil, die vorhandenen Pakete und offene Meldungen.</li>
                    <li>In der Claude-App eine neue Claude-Code-Sitzung mit dem Repository <code>lernapp</code> starten, den Auftrag einfügen und die PDFs anhängen – Skript, Übungsaufgaben und Altklausuren, soweit vorhanden.</li>
                    <li>Die fertige <code>.lernpaket.json</code> sichern und hier über „Datei auswählen“ importieren. Updates behalten deinen Lernfortschritt; die Vorversion holt Claude aus deinem privaten Archiv.</li>
                  </ol>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Claude arbeitet dabei immer dieselbe Checkliste ab und berücksichtigt die Schwerpunkte des jeweiligen Fachs. Unterlagen und Pakete werden nicht im (öffentlichen) Repository gespeichert.
                  </p>
                </details>
              </div>

              <div className="section-title" id="text-import">Karten aus anderen Tools</div>
              <div className="card stack">
                <p className="muted" style={{ margin: 0 }}>
                  Für Karten aus ChatGPT, NotebookLM, Quizlet, Anki, Excel o. Ä. – als Datei über „Datei auswählen“ oben oder hier eingefügt. Erkannt werden:
                </p>
                <ul className="help" style={{ margin: 0 }}>
                  <li>Blöcke mit <code>F:</code> / <code>A:</code> (auch <code>Frage:</code>/<code>Antwort:</code>, <code>Q:</code>/<code>A:</code>)</li>
                  <li>je Zeile Frage und Antwort, getrennt durch Tab, <code>;</code> oder <code>;;</code> – z. B. Export aus Anki, Quizlet oder Excel (CSV)</li>
                  <li>Tabellen mit zwei Spalten (Markdown) und JSON-Listen mit Frage und Antwort</li>
                  <li>Überschriften wie <code>## Kapitel</code> gruppieren die folgenden Karten – so werden zusammenhängende Themen gemeinsam und in dieser Reihenfolge gelernt</li>
                </ul>
                <button className="btn block" onClick={copyPrompt}>
                  {promptCopied ? 'Vorlage kopiert ✓' : 'Vorlage für ChatGPT & Co. kopieren'}
                </button>
                <small className="muted">Die Vorlage bittet ein anderes KI-Tool, die Karten genau in diesem Format mit Kapiteln auszugeben – einfach mit den Unterlagen dort einfügen.</small>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>Titel</span>
                  <input type="text" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="z. B. QM Zusammenfassung Lisa" />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>Text</span>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'## Grundlagen\nF: Was ist Qualität?\nA: Grad, in dem inhärente Merkmale Anforderungen erfüllen.'} />
                </label>
                {textPkg && (
                  <small className="muted">
                    {textPairs.length} Karten{textChapters > 0 && ` in ${textChapters} ${textChapters === 1 ? 'Kapitel' : 'Kapiteln'}`}. Gleicher Titel bei einem späteren Import = Update: Neue Karten kommen dazu, der Lernfortschritt bleibt.
                  </small>
                )}
                <button className="btn primary block" disabled={!textPkg} onClick={() => textPkg && doImport(textPkg)}>
                  {textPkg ? `${textPairs.length} Karten importieren` : 'Keine Karten erkannt'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
