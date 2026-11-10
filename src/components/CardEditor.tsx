import { useState } from 'react'
import type { StudyCard } from '../lib/db'
import { checkEdit, editCard, resetCardEdit } from '../lib/cards'
import { Rich } from './Rich'

const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean)

/**
 * Formular „Karte bearbeiten“ – in der Lernsitzung und in der Kartenübersicht. Bearbeitet werden nur die Texte
 * (Frage, Antwort, Tipps, Kernpunkte); Antwortoptionen, Zuordnungen und Lösungswege bleiben aus dem Paket.
 */
export function CardEditor({ card, socratic, onDone }: { card: StudyCard; socratic: boolean; onDone: () => void }) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [prompts, setPrompts] = useState((card.prompts ?? []).join('\n'))
  const [keyPoints, setKeyPoints] = useState((card.keyPoints ?? []).join('\n'))
  const [error, setError] = useState<string | null>(null)
  // Tipps und Kernpunkte nur zeigen, wo sie in der Lernsitzung erscheinen (sokratisches Lernen) oder schon vorhanden sind.
  const showSocratic = socratic || !!card.prompts?.length || !!card.keyPoints?.length

  async function save() {
    const values = { front, back, prompts: showSocratic ? lines(prompts) : card.prompts, keyPoints: showSocratic ? lines(keyPoints) : card.keyPoints }
    const problem = checkEdit(card, values)
    if (problem) return setError(problem)
    await editCard(card, values)
    onDone()
  }

  async function reset() {
    if (!confirm('Eigene Fassung verwerfen und wieder die Fassung aus dem Paket zeigen?')) return
    await resetCardEdit(card)
    onDone()
  }

  return (
    <div className="card stack card-editor">
      <h3 style={{ margin: 0 }}>Karte bearbeiten</h3>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        Deine Fassung bleibt auch bei Paket-Updates erhalten und steht im Auftrag für Claude, damit sie ins Paket übernommen wird. Formeln in LaTeX zwischen $ … ${card.type === 'cloze' ? ', Lücken in {{doppelten geschweiften Klammern}}' : ''}.
      </p>
      {card.edit?.packageChanged && (
        <div className="notice" style={{ margin: 0 }}>
          Das Paket hat diese Karte seit deiner Bearbeitung geändert. Es gilt weiter deine Fassung – mit „Paketfassung wiederherstellen“ übernimmst du die neue.
        </div>
      )}
      <label className="stack" style={{ gap: 4 }}>
        <b>Frage</b>
        <textarea value={front} onChange={(e) => setFront(e.target.value)} aria-label="Frage" style={{ minHeight: 90 }} />
      </label>
      <label className="stack" style={{ gap: 4 }}>
        <b>Antwort</b>
        <textarea value={back} onChange={(e) => setBack(e.target.value)} aria-label="Antwort" style={{ minHeight: 140 }} />
      </label>
      {showSocratic && (
        <>
          <label className="stack" style={{ gap: 4 }}>
            <b>Tipps</b>
            <small className="muted">Ein Tipp pro Zeile, in der Reihenfolge, in der sie erscheinen.</small>
            <textarea value={prompts} onChange={(e) => setPrompts(e.target.value)} aria-label="Tipps" style={{ minHeight: 90 }} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <b>Kernpunkte</b>
            <small className="muted">Ein Kernpunkt pro Zeile – zum Abhaken nach dem Aufdecken.</small>
            <textarea value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} aria-label="Kernpunkte" style={{ minHeight: 90 }} />
          </label>
        </>
      )}
      <details>
        <summary>Vorschau</summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <Rich text={front} cloze={card.type === 'cloze' ? 'back' : 'none'} />
          {back.trim() && <Rich text={back} />}
        </div>
      </details>
      {error && <div className="notice" role="alert" style={{ margin: 0 }}>{error}</div>}
      <div className="row">
        <button className="btn grow" onClick={onDone}>Abbrechen</button>
        <button className="btn primary grow" onClick={save}>Speichern</button>
      </div>
      {card.edit && (
        <button className="btn small ghost" style={{ color: 'var(--accent)' }} onClick={reset}>
          Paketfassung wiederherstellen
        </button>
      )}
    </div>
  )
}
