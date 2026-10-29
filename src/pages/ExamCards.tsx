import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CardReport, type StudyCard } from '../lib/db'
import { deleteCard, plainText, restoreCard } from '../lib/cards'
import { deleteReport, exportReports, REPORT_CATEGORIES, reportCard, setResolved } from '../lib/reports'
import { safeFileName, saveFile } from '../lib/packages'
import { sortPackages } from '../lib/stats'
import { isoDate } from '../lib/dates'
import { Rich } from '../components/Rich'
import { ReportForm } from '../components/ReportForm'
import { PageHeader } from '../components/ui'

type Filter = 'alle' | 'gemeldet' | 'geloescht'

/**
 * Alle Karten einer Prüfung in Lernreihenfolge (Paket → Kapitel → Karte), mit Meldungen:
 * Karten ansehen, melden, Meldungen abhaken, Karten löschen und wiederherstellen.
 */
export function ExamCards() {
  const { id = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const filter = (search.get('filter') as Filter) || 'alle'
  const [query, setQuery] = useState('')
  const [reporting, setReporting] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    const exam = await db.exams.get(id)
    if (!exam) return { exam: undefined }
    const [cards, packages, reports] = await Promise.all([
      db.cards.where('examId').equals(id).filter((c) => !c.archived || !!c.deletedAt).toArray(),
      db.packages.where('examId').equals(id).toArray(),
      db.reports.where('examId').equals(id).toArray(),
    ])
    return { exam, cards, packages: sortPackages(packages), reports }
  }, [id])

  if (!data) return null
  const { exam } = data
  if (!exam) {
    return (
      <div className="card empty">
        <p>Prüfung nicht gefunden.</p>
        <Link to="/pruefungen">Zur Übersicht</Link>
      </div>
    )
  }
  const { cards, packages, reports } = data
  const active = cards.filter((c) => !c.deletedAt)
  // Nur Meldungen zu vorhandenen Karten zählen – archivierte (vom Update entfernte) Karten erscheinen hier nicht.
  const activeIds = new Set(active.map((c) => c.id))
  const openByCard = new Map<string, CardReport[]>()
  for (const r of reports.filter((r) => !r.resolvedAt && activeIds.has(r.cardId)).sort((a, b) => a.createdAt - b.createdAt)) {
    openByCard.set(r.cardId, [...(openByCard.get(r.cardId) ?? []), r])
  }
  const deleted = cards.filter((c) => c.deletedAt)
  const reported = active.filter((c) => openByCard.has(c.id))
  const openCount = [...openByCard.values()].flat().length

  const q = query.trim().toLowerCase()
  const shown = (filter === 'gemeldet' ? reported : filter === 'geloescht' ? deleted : active).filter(
    (c) => !q || `${c.front} ${c.back}`.toLowerCase().includes(q),
  )
  const setFilter = (f: Filter) => setSearch(f === 'alle' ? {} : { filter: f }, { replace: true })

  // Gruppen in Lernreihenfolge: Paket (wie auf der Prüfungsseite festgelegt) → Kapitel → Skript-Reihenfolge
  const packageTitle = new Map(packages.map((p) => [p.packageId, p.title]))
  const packageRank = new Map(packages.map((p, i) => [p.packageId, i]))
  const sorted = [...shown].sort((a, b) => (packageRank.get(a.packageId) ?? 999) - (packageRank.get(b.packageId) ?? 999) || a.order - b.order)
  const groups: { key: string; title: string; chapter?: string; cards: StudyCard[] }[] = []
  for (const c of sorted) {
    const key = `${c.packageId}:${c.chapter ?? ''}`
    const last = groups[groups.length - 1]
    if (last?.key === key) last.cards.push(c)
    else groups.push({ key, title: packageTitle.get(c.packageId) ?? c.packageId, chapter: c.chapterTitle, cards: [c] })
  }

  async function exportOpen() {
    const file = await exportReports(exam!)
    await saveFile(`Meldungen_${safeFileName(exam!.name)}_${isoDate(Date.now())}.json`, JSON.stringify(file, null, 1))
  }

  const chip = (f: Filter, label: string, n: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={filter === f}
      className={`chip${filter === f ? ' accent' : ''}`}
      style={{ border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 14 }}
      onClick={() => setFilter(f)}
    >
      {label} ({n})
    </button>
  )

  return (
    <>
      <PageHeader back title="Karten und Meldungen" subtitle={exam.name} />

      <div className="row wrap" role="tablist" aria-label="Filter" style={{ marginBottom: 12 }}>
        {chip('alle', 'Alle', active.length)}
        {chip('gemeldet', 'Gemeldet', reported.length)}
        {chip('geloescht', 'Gelöscht', deleted.length)}
      </div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Karten durchsuchen" style={{ width: '100%', marginBottom: 12 }} />

      {filter === 'gemeldet' && (
        <div className="notice">
          Gemeldete Karten sind pausiert und werden nicht abgefragt. Offene Meldungen stehen automatisch im <b>Auftrag für Claude</b> (Seite Prüfungen). Ändert ein Paket-Update eine gemeldete Karte, ist die Meldung danach erledigt und die Karte kommt zurück – ebenso, wenn du sie hier abhakst. Entfernt das Update die Karte, ist die Meldung ebenfalls erledigt.
          {openCount > 0 && (
            <>
              {' '}
              <button className="btn small ghost" style={{ color: 'var(--accent)', padding: 0, minHeight: 0 }} onClick={exportOpen}>
                {openCount === 1 ? 'Meldung' : `${openCount} Meldungen`} exportieren
              </button>
            </>
          )}
        </div>
      )}
      {filter === 'geloescht' && (
        <div className="notice">Gelöschte Karten werden nicht mehr abgefragt, auch nicht nach einem Paket-Update. Der Lernfortschritt bleibt für eine Wiederherstellung erhalten.</div>
      )}

      {groups.length === 0 && (
        <div className="card empty">
          <p className="muted">{q ? 'Keine Karte passt zur Suche.' : filter === 'gemeldet' ? 'Keine offenen Meldungen.' : filter === 'geloescht' ? 'Keine gelöschten Karten.' : 'Noch keine Karten.'}</p>
        </div>
      )}

      {groups.map((g, i) => (
        <div key={g.key}>
          {(i === 0 || groups[i - 1].title !== g.title) && <div className="section-title">{g.title}</div>}
          {g.chapter && <p className="muted" style={{ margin: '0 0 6px 4px', fontSize: 14 }}>{g.chapter}</p>}
          <div className="list">
            {g.cards.map((c) => {
              const open = openByCard.get(c.id) ?? []
              return (
                <details className="list-item card-entry" key={c.id} style={{ display: 'block' }} open={filter === 'gemeldet' || undefined}>
                  <summary>
                    <span className="grow" style={{ minWidth: 0, fontWeight: 500, fontSize: 16 }}>
                      <span className="truncate" style={{ display: 'block' }}>{plainText(c.front)}</span>
                      <small className="muted" style={{ fontWeight: 400 }}>
                        {[c.s.state === 0 ? 'neu' : 'begonnen', open.length > 0 && 'gemeldet, pausiert', c.deletedAt && `gelöscht am ${new Date(c.deletedAt).toLocaleDateString('de-DE')}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </span>
                  </summary>
                  <div className="stack" style={{ marginTop: 10 }}>
                    <Rich text={c.front} cloze={c.type === 'cloze' ? 'back' : 'none'} />
                    {c.image && <img className="card-image" src={c.image} alt="" />}
                    {c.type === 'mc' && c.options && (
                      <ul style={{ margin: 0 }}>
                        {c.options.map((o, k) => (
                          <li key={k} style={{ color: c.correct?.includes(k) ? 'var(--ok)' : undefined }}>
                            {c.correct?.includes(k) ? '✓ ' : ''}
                            {plainText(o)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.type === 'match' && c.pairs && (
                      <ul style={{ margin: 0 }}>
                        {c.pairs.map(([l, r], k) => (
                          <li key={k}>
                            <b>{plainText(l)}</b> → {plainText(r)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.steps?.map((s, k) => (
                      <div className="step" key={k}>
                        <b>Schritt {k + 1}</b>
                        <Rich text={s} />
                      </div>
                    ))}
                    {c.result && (
                      <div className="step result">
                        <b>Ergebnis</b>
                        <Rich text={c.result} />
                      </div>
                    )}
                    {c.back.trim() && (
                      <>
                        <hr />
                        <Rich text={c.back} />
                      </>
                    )}
                    {!!c.prompts?.length && (
                      <div className="hints-list">
                        <b>Leitfragen</b>
                        <ol>{c.prompts.map((p, i) => <li key={i}><Rich text={p} /></li>)}</ol>
                      </div>
                    )}
                    {!!c.keyPoints?.length && (
                      <div className="hints-list">
                        <b>Kernpunkte</b>
                        <ul>{c.keyPoints.map((p, i) => <li key={i}><Rich text={p} /></li>)}</ul>
                      </div>
                    )}
                    {c.source?.file && (
                      <small className="muted">
                        Quelle: {c.source.file}
                        {c.source.slide !== undefined && `, Folie ${c.source.slide}`}
                      </small>
                    )}

                    {open.map((r) => (
                      <div className="notice" key={r.id} style={{ margin: 0 }}>
                        <b>Gemeldet:</b> {REPORT_CATEGORIES.find((x) => x.value === r.category)?.label}
                        {r.note && ` · ${r.note}`}
                        <div className="row" style={{ marginTop: 6 }}>
                          <button className="btn small ghost" style={{ color: 'var(--accent)' }} onClick={() => setResolved(r, true)}>Erledigt</button>
                          <button className="btn small ghost danger" onClick={() => deleteReport(r)} aria-label="Meldung löschen">Meldung löschen</button>
                        </div>
                      </div>
                    ))}

                    {reporting === c.id ? (
                      <ReportForm
                        onCancel={() => setReporting(null)}
                        onSubmit={async (category, note) => {
                          await reportCard(c, category, note)
                          setReporting(null)
                        }}
                      />
                    ) : (
                      <div className="row">
                        {c.deletedAt ? (
                          <button className="btn small grow" onClick={() => restoreCard(c)}>Wiederherstellen</button>
                        ) : (
                          <>
                            <button className="btn small grow" onClick={() => setReporting(c.id)}>Melden</button>
                            <button
                              className="btn small grow danger"
                              onClick={() => confirm('Karte löschen? Sie wird nicht mehr abgefragt – auch nicht nach einem Paket-Update. Wiederherstellen kannst du sie hier unter „Gelöscht“.') && deleteCard(c)}
                            >
                              Löschen
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
