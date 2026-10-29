import { Rich } from './Rich'

/** Bisher aufgedeckte Leitfragen einer Karte. */
export function Hints({ prompts, shown }: { prompts: string[]; shown: number }) {
  if (shown === 0) return null
  return (
    <ol className="hints" aria-label="Leitfragen">
      {prompts.slice(0, shown).map((p, i) => (
        <li key={i}>
          <Rich text={p} />
        </li>
      ))}
    </ol>
  )
}

/** Kernpunkte der Antwort zum Abhaken: „Was davon hattest du?“ */
export function KeyPoints({ points, checked, onToggle }: { points: string[]; checked: number[]; onToggle: (i: number) => void }) {
  return (
    <div className="keypoints">
      <b>Was davon hattest du?</b>
      {points.map((p, i) => (
        <label key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={checked.includes(i)} onChange={() => onToggle(i)} />
          <span style={{ minWidth: 0 }}>
            <Rich text={p} />
          </span>
        </label>
      ))}
    </div>
  )
}
