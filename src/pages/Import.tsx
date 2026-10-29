import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActive } from '../state'
import { db } from '../lib/db'
import { importPackage, parsePackage, parseTextCards, textToPackage, type CardPackage, type ImportResult } from '../lib/packages'
import { appTooOld } from '../lib/package-format'
import { OTHER_AI_PROMPT } from '../lib/textCards'
import { PageHeader } from '../components/ui'
import { applyPending, applyProfile, fieldLabel, matchExam, parseProfilesFile, PROFILES_FORMAT, type ProfileEntry } from '../lib/profile'
import { importTemplate, parseTemplate, templateStatus, templateSummary, TEMPLATE_FORMAT, type ProfileTemplate, type TemplateResult } from '../lib/template'
import { BUNDLE_FORMAT, bundlePlan, bundleTotals, importBundle, parseBundle, type BundlePlanEntry, type BundleResult, type PackageBundle } from '../lib/bundle'

/** Paketname ohne vorangestellten Prüfungsnamen („Maschinendynamik – Fragenkatalog“ → „Fragenkatalog“). */
const shortTitle = (title: string, exam?: string) => {
  const prefix = exam?.trim().toLowerCase()
  const m = title.match(/^(.+?)\s+[–-]\s+(.+)$/)
  return prefix && m && m[1].trim().toLowerCase() === prefix ? m[2] : title
}

export function Import() {
  const { profile, semester } = useActive()
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
  const [template, setTemplate] = useState<ProfileTemplate | null>(null)
  const [templateDone, setTemplateDone] = useState<TemplateResult | null>(null)
  const [status, setStatus] = useState<Awaited<ReturnType<typeof templateStatus>> | null>(null)
  const [bundle, setBundle] = useState<PackageBundle | null>(null)
  const [plan, setPlan] = useState<BundlePlanEntry[] | null>(null)
  const [bundleDone, setBundleDone] = useState<BundleResult | null>(null)
  // Alle Prüfungen des Profils, die des aktiven Semesters zuerst – für die Zuordnung einer Paket-Sammlung.
  const allExams = useLiveQuery(
    async () => (await db.exams.where('profileId').equals(profile.id).sortBy('date')).sort((a, b) => Number(b.semesterId === semester.id) - Number(a.semesterId === semester.id)),
    [profile.id, semester.id],
  )

  useEffect(() => {
    setPlan(null)
    if (bundle && allExams) bundlePlan(allExams, bundle).then(setPlan)
  }, [bundle, allExams])

  useEffect(() => {
    setStatus(null)
    if (template) templateStatus(profile.id, template).then(setStatus)
  }, [template, profile.id])

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
    setTemplateDone(null)
    setBundleDone(null)
    setBundle(null)
    try {
      if ((raw as { format?: unknown })?.format === BUNDLE_FORMAT) {
        setPkg(null)
        setProfiles(null)
        setTemplate(null)
        const b = parseBundle(raw)
        const tooOld = b.exams.flatMap((e) => e.packages).map((p) => appTooOld(p, __APP_VERSION__)).find(Boolean)
        if (tooOld) throw new Error(tooOld)
        setBundle(b)
        return
      }
      if ((raw as { format?: unknown })?.format === TEMPLATE_FORMAT) {
        setPkg(null)
        setProfiles(null)
        setTemplate(parseTemplate(raw))
        return
      }
      if ((raw as { format?: unknown })?.format === PROFILES_FORMAT) {
        setPkg(null)
        setProfiles(parseProfilesFile(raw))
        return
      }
      setProfiles(null)
      const p = parsePackage(raw)
      const tooOld = appTooOld(p, __APP_VERSION__)
      if (tooOld) throw new Error(tooOld)
      setPkg(p)
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
      const changed = entry.profile ? await applyProfile(exam.id, entry.profile, true) : []
      const reminders = await applyPending(exam.id, entry.pending)
      const parts = [changed.length && changed.map(fieldLabel).join(', '), reminders && `${reminders} ${reminders === 1 ? 'Erinnerung' : 'Erinnerungen'}`].filter(Boolean)
      done.push(`${exam.name} (${parts.join('; ') || 'unverändert'})`)
    }
    setProfiles(null)
    setProfilesDone(done)
  }

  async function doTemplate(t: ProfileTemplate) {
    try {
      setTemplateDone(await importTemplate(profile.id, t))
      setTemplate(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function doBundle(p: BundlePlanEntry[]) {
    try {
      setBundleDone(await importBundle(p))
      setBundle(null)
    } catch (e) {
      setError((e as Error).message)
    }
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

      {templateDone && (
        <div className="notice">
          <b>Vorlage übernommen.</b> {templateDone.examsAdded} {templateDone.examsAdded === 1 ? 'Prüfung' : 'Prüfungen'} neu
          {templateDone.examsUpdated > 0 && `, ${templateDone.examsUpdated} vorhandene ergänzt (Lernfortschritt bleibt)`}
          {templateDone.semestersAdded > 0 && `, ${templateDone.semestersAdded} ${templateDone.semestersAdded === 1 ? 'Semester' : 'Semester'} angelegt`}
          {' '}· {templateDone.packages} {templateDone.packages === 1 ? 'Paket' : 'Pakete'} mit {templateDone.cards} Karten
          {templateDone.cardsChanged > 0 && ` · ${templateDone.cardsChanged} ${templateDone.cardsChanged === 1 ? 'Karte korrigiert' : 'Karten korrigiert'} (Lernfortschritt bleibt)`}{templateDone.reports > 0 && ` · ${templateDone.reports} ${templateDone.reports === 1 ? 'offene Meldung' : 'offene Meldungen'}`}.
          {templateDone.olderSkipped.length > 0 && ` Nicht übernommen, weil deine Version neuer ist: ${templateDone.olderSkipped.join(', ')}.`}
          {templateDone.skipped.length > 0 && ` Nicht angelegt (höchstens 10 Prüfungen pro Semester): ${templateDone.skipped.join(', ')}.`}{' '}
          <Link to="/pruefungen">Zu den Prüfungen</Link>
        </div>
      )}
      {bundleDone && (() => {
        const t = bundleTotals(bundleDone)
        const n = bundleDone.imported.length
        return (
          <div className="notice">
            <b>Paket-Sammlung übernommen.</b> {n} {n === 1 ? 'Paket' : 'Pakete'} importiert
            {n > 0 && ` · ${t.updated} ${t.updated === 1 ? 'Karte geändert' : 'Karten geändert'}, ${t.added} neu`}
            {t.archived > 0 && `, ${t.archived} archiviert (nicht mehr im Paket)`}
            {t.resolvedReports > 0 && ` · ${t.resolvedReports} ${t.resolvedReports === 1 ? 'Meldung' : 'Meldungen'} erledigt`}
            {t.pausedChapters > 0 && ` · ${t.pausedChapters} Kapitel noch nicht dran (pausiert)`}. Dein Lernfortschritt bleibt.
            {bundleDone.same.length > 0 && ` Schon aktuell: ${bundleDone.same.join(', ')}.`}
            {bundleDone.older.length > 0 && ` Nicht übernommen, weil deine Version neuer ist: ${bundleDone.older.join(', ')}.`}
            {bundleDone.unmatched.length > 0 && ` Keine passende Prüfung: ${bundleDone.unmatched.join(', ')}.`}{' '}
            <Link to="/pruefungen">Zu den Prüfungen</Link>
          </div>
        )
      })()}
      {bundle ? (
        <div className="card stack">
          <h2>Paket-Sammlung</h2>
          {error && <div className="notice warn" style={{ margin: 0 }}>{error}</div>}
          {!plan ? (
            <p className="muted" style={{ margin: 0 }}>Abgleich mit deinen Karten …</p>
          ) : (
            <>
              {plan.map(({ entry, exam, packages }, i) => (
                <div key={i} className="stack bundle-exam" style={{ gap: 4 }}>
                  <div className="row between" style={{ gap: 8 }}>
                    <b className="truncate">{exam?.name ?? entry.name ?? entry.slug}</b>
                    {!exam && <small className="badge-warn" style={{ flexShrink: 0 }}>keine passende Prüfung</small>}
                  </div>
                  {packages.map(({ pkg, status, installed }) => (
                    <div key={pkg.id} className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ minWidth: 0 }}>{shortTitle(pkg.title, exam?.name ?? entry.name)}</span>
                      <small className={status === 'neuer' || status === 'neu' ? '' : 'muted'} style={{ flexShrink: 0, paddingTop: 2 }}>
                        {!exam
                          ? `Version ${pkg.version}`
                          : status === 'neuer'
                            ? `Update ${installed} → ${pkg.version}`
                            : status === 'neu'
                              ? `neu (Version ${pkg.version})`
                              : status === 'gleich'
                                ? 'schon aktuell'
                                : `deine Version ${installed} ist neuer`}
                      </small>
                    </div>
                  ))}
                </div>
              ))}
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
                Jedes Paket wird wie ein einzelnes Update übernommen: geänderte Karten werden korrigiert, neue kommen dazu, entfernte werden archiviert. Dein Lernfortschritt bleibt. Pakete, die schon aktuell sind oder von denen du eine neuere Version hast, bleiben unverändert.
              </p>
            </>
          )}
          <div className="row">
            <button className="btn grow" onClick={() => setBundle(null)}>Abbrechen</button>
            <button
              className="btn primary grow"
              disabled={!plan?.some((e) => e.exam && e.packages.some((p) => p.status === 'neu' || p.status === 'neuer'))}
              onClick={() => plan && doBundle(plan)}
            >
              Übernehmen
            </button>
          </div>
        </div>
      ) : template ? (
        <div className="card stack">
          <h2>Vorlage ohne Lernfortschritt</h2>
          {(() => {
            const sum = templateSummary(template)
            return (
              <p className="muted" style={{ margin: 0 }}>
                {sum.semesters} Semester · {sum.exams} {sum.exams === 1 ? 'Prüfung' : 'Prüfungen'} · {sum.packages} {sum.packages === 1 ? 'Paket' : 'Pakete'} · {sum.cards} Karten
                {sum.reports > 0 && ` · ${sum.reports} ${sum.reports === 1 ? 'offene Meldung' : 'offene Meldungen'}`}
              </p>
            )
          })()}
          {template.semesters.map((s, i) => (
            <div key={i} className="stack" style={{ gap: 4 }}>
              <b>{s.name}</b>
              {s.exams.map((e, j) => (
                <div key={j} className="row between">
                  <span className="row" style={{ gap: 8, minWidth: 0 }}>
                    <span className="dot" style={{ background: e.color }} />
                    <span className="truncate">{e.name}</span>
                  </span>
                  <small className="muted">{e.packages.reduce((n, p) => n + p.cards.length, 0)} Karten</small>
                </div>
              ))}
            </div>
          ))}
          {status && status.neu + status.newExams < templateSummary(template).packages + templateSummary(template).exams && (
            <div className="notice" style={{ margin: 0 }}>
              <b>Abgleich mit deinen Karten:</b>{' '}
              {[
                status.neuer && `${status.neuer} ${status.neuer === 1 ? 'Paket ist neuer' : 'Pakete sind neuer'} – geänderte Karten werden korrigiert`,
                status.gleich && `${status.gleich} gleich`,
                status.aelter && `${status.aelter} älter als deine Version – werden nicht übernommen`,
                status.neu && `${status.neu} neu`,
              ]
                .filter(Boolean)
                .join(' · ')}
              . Dein Lernfortschritt bleibt, und es werden keine Karten entfernt.
            </div>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Prüfungen mit gleichem Namen werden ergänzt – auch wenn das Semester anders heißt –, alle anderen neu angelegt. Neuere Paketversionen korrigieren geänderte Karten, ältere überschreiben deine nicht. Lernstand, Hausaufgaben und Einstellungen sind nicht enthalten. Gemeldete Karten bleiben pausiert, bis ein Paket-Update sie korrigiert.
          </p>
          <div className="row">
            <button className="btn grow" onClick={() => setTemplate(null)}>Abbrechen</button>
            <button className="btn primary grow" onClick={() => doTemplate(template)}>Übernehmen</button>
          </div>
        </div>
      ) : exams.length === 0 ? (
        <div className="card empty stack">
          {error && <div className="notice warn">{error}</div>}
          <p className="muted">Lege zuerst eine Prüfung an, in die die Karten importiert werden – oder übernimm eine Vorlage mit Prüfungen und Karten (z. B. von Kommilitonen).</p>
          <Link className="btn primary" to="/pruefung/neu">Prüfung anlegen</Link>
          <label className="btn">
            Vorlage importieren
            <input type="file" accept=".json,application/json" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
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
          {result && (result.pausedChapters > 0 || result.pendingAdded > 0) && (
            <div className="notice">
              {result.pausedChapters > 0 && <>{result.pausedChapters === 1 ? '1 Kapitel ist' : `${result.pausedChapters} Kapitel sind`} in der Vorlesung noch nicht dran und pausiert – fortsetzen auf der Prüfungsseite unter „Kapitel“. </>}
              {result.pendingAdded > 0 && <>{result.pendingAdded === 1 ? '1 fehlende Unterlage' : `${result.pendingAdded} fehlende Unterlagen`} eingetragen – die App erinnert dich daran.</>}
            </div>
          )}
          {result && result.profileFields.length > 0 && (
            <div className="notice">
              Claude hat fürs Fachprofil vorgeschlagen: {result.profileFields.map(fieldLabel).join(', ')}. <Link to={`/pruefung/${examId}/profil`}>Prüfen</Link>
            </div>
          )}
          {profilesDone && (
            <div className="notice">
              <b>Übernommen:</b> {profilesDone.join(' · ') || 'keine passende Prüfung gefunden'}. Die Vorschläge sind im Fachprofil der jeweiligen Prüfung markiert.
            </div>
          )}
          {error && <div className="notice warn">{error}</div>}

          {profiles ? (
            <div className="card stack">
              <h2>Fachprofile und Erinnerungen von Claude</h2>
              {profiles.map((entry, i) => {
                const exam = matchExam(exams, entry)
                return (
                  <div key={i} className="row between">
                    <span>
                      {entry.name ?? entry.slug}
                      {entry.pending && <small className="muted"> · {entry.pending.map((d) => d.title).join(', ')}</small>}
                    </span>
                    <small className={exam ? '' : 'badge-warn'}>{exam ? `→ ${exam.name}` : 'keine passende Prüfung'}</small>
                  </div>
                )
              })}
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>Fachprofil-Angaben ersetzen die bisherigen Felder und werden als Vorschlag markiert, bis du das Fachprofil speicherst. Erinnerungen an fehlende Unterlagen kommen zur jeweiligen Prüfung (schon vorhandene bleiben, wie sie sind).</p>
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
                <p className="muted" style={{ margin: 0 }}>Eine <code>.lernpaket.json</code>-Datei, z. B. von Claude erstellt oder von Kommilitonen geteilt, eine Paket-Sammlung mit mehreren Updates, eine Datei mit Fachprofilen von Claude, eine Vorlage mit allen Prüfungen ohne Lernfortschritt – oder Karten aus ChatGPT, Anki, Quizlet &amp; Co. (.txt, .csv, .md, siehe unten).</p>
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
                    <li>Die fertige <code>.lernpaket.json</code> sichern und hier über „Datei auswählen“ importieren. Updates behalten deinen Lernfortschritt; die Vorversion holt Claude aus deinem privaten Archiv. Betrifft ein Auftrag mehrere Pakete, kommt alles als eine Paket-Sammlung (<code>.lernsammlung.json</code>) – ein Import aktualisiert dann alle Prüfungen.</li>
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
