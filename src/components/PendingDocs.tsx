import { useState, type FormEvent } from 'react'
import type { Exam } from '../lib/db'
import { addPending, completePending, duePending, removePending, reopenPending, snoozePending } from '../lib/pending'
import { formatDate } from '../lib/dates'

/** Liste der noch fehlenden Unterlagen einer Prüfung mit Erinnerung, Zurückstellen und Abhaken. */
export function PendingDocs({ exam }: { exam: Exam }) {
  const [title, setTitle] = useState('')
  const [from, setFrom] = useState('')
  const list = exam.pendingDocs ?? []
  const due = new Set(duePending(exam).map((d) => d.id))
  const open = list.filter((d) => !d.doneAt)
  const done = list.filter((d) => d.doneAt)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await addPending(exam, title, from || undefined)
    setTitle('')
    setFrom('')
  }

  return (
    <div className="card stack">
      {open.length === 0 && <p className="muted" style={{ margin: 0 }}>Keine fehlenden Unterlagen eingetragen.</p>}
      {open.map((d) => (
        <div key={d.id} className="pending-row">
          <div className="grow" style={{ minWidth: 0 }}>
            <b>{d.title}</b>
            <br />
            <small className={due.has(d.id) ? 'badge-warn' : 'muted'}>
              {d.repeatDays ? `alle ${d.repeatDays === 7 ? 'Woche' : `${d.repeatDays} Tage`} · ` : ''}
              {due.has(d.id)
                ? 'Erinnerung aktiv'
                : d.snoozedUntil && (!d.from || d.snoozedUntil > d.from)
                  ? `zurückgestellt bis ${formatDate(d.snoozedUntil)}`
                  : `Erinnerung ab ${formatDate(d.from!)}`}
              {d.note && ` · ${d.note}`}
            </small>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {due.has(d.id) && (
              <button className="btn small" onClick={() => snoozePending(exam, d.id)} aria-label={`${d.title} später erinnern`}>Später</button>
            )}
            <button className="btn small primary" onClick={() => completePending(exam, d.id)} aria-label={`${d.title} erledigt`}>{d.repeatDays ? 'Diesmal erledigt' : 'Erledigt'}</button>
          </div>
        </div>
      ))}
      <form className="row" style={{ gap: 6, flexWrap: 'wrap' }} onSubmit={add}>
        <input className="grow" style={{ minWidth: 160 }} placeholder="z. B. Altklausuren, Musterlösung Blatt 3" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Fehlende Unterlage" />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Erinnern ab" title="Erinnern ab (optional)" />
        <button className="btn small" type="submit" disabled={!title.trim()}>Eintragen</button>
      </form>
      <small className="muted">
        Die App erinnert auf der Startseite (und in der Dropbox-Erinnerung), bis du die Unterlage abhakst. „Später“ stellt die Erinnerung eine Woche zurück. Offene Unterlagen stehen auch im Auftrag für Claude.
      </small>
      {done.length > 0 && (
        <details>
          <summary className="muted" style={{ fontSize: 14 }}>Erledigt ({done.length})</summary>
          {done.map((d) => (
            <div key={d.id} className="row between" style={{ marginTop: 8 }}>
              <span className="muted">{d.title}</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn small" onClick={() => reopenPending(exam, d.id)}>Wieder öffnen</button>
                <button className="btn small" onClick={() => removePending(exam, d.id)} aria-label={`${d.title} entfernen`}>Entfernen</button>
              </span>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
