import { SEMESTER_KINDS, type SemesterKind } from '../lib/semesters'

/** Auswahl der Semesterart als Karten mit Erklärung. */
export function SemesterKindPicker({ value, onChange }: { value: SemesterKind; onChange: (k: SemesterKind) => void }) {
  return (
    <div className="stack" role="radiogroup" aria-label="Art der Prüfungsphase">
      {(Object.keys(SEMESTER_KINDS) as SemesterKind[]).map((k) => {
        const info = SEMESTER_KINDS[k]
        const on = value === k
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            className={`option${on ? ' selected' : ''}`}
            onClick={() => onChange(k)}
          >
            <b>{info.label}</b>
            <br />
            <small>{info.description}</small>
          </button>
        )
      })}
    </div>
  )
}
