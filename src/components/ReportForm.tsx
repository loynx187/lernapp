import { useState } from 'react'
import type { ReportCategory } from '../lib/db'
import { REPORT_CATEGORIES } from '../lib/reports'

/** Formular „Karte melden“ – in der Lernsitzung und in der Kartenübersicht. */
export function ReportForm({ onSubmit, onCancel }: { onSubmit: (category: ReportCategory, note: string) => void; onCancel: () => void }) {
  const [category, setCategory] = useState<ReportCategory>('fehler')
  const [note, setNote] = useState('')
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Karte melden</h3>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        Die Meldung wird gesammelt und bei der nächsten Paketerstellung von Claude bearbeitet (steht automatisch im Auftrag für Claude). Bis dahin wird die Karte nicht mehr abgefragt.
      </p>
      <div className="row wrap" role="radiogroup" aria-label="Art des Problems">
        {REPORT_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={category === c.value}
            className={`chip${category === c.value ? ' accent' : ''}`}
            style={{ border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 14 }}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was stimmt nicht? (optional)" style={{ minHeight: 90 }} />
      <div className="row">
        <button className="btn grow" onClick={onCancel}>Abbrechen</button>
        <button className="btn primary grow" onClick={() => onSubmit(category, note)}>Melden</button>
      </div>
    </div>
  )
}
