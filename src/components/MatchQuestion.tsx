import { useMemo } from 'react'
import { Rich } from './Rich'
import { plainText } from '../lib/cards'

/** Feste, aber gemischte Reihenfolge je Karte (gleiche Karte → gleiche Reihenfolge). */
export function matchOrder(n: number, seed: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  // Nie die Lösung in der Ausgangsreihenfolge anbieten
  if (n > 1 && order.every((x, i) => x === i)) order.push(order.shift()!)
  return order
}

/** Anzahl richtiger Zuordnungen; `value[i]` = gewählter rechter Eintrag zu links i (-1 = keiner). */
export const matchScore = (value: number[], n: number) => Array.from({ length: n }, (_, i) => value[i] === i).filter(Boolean).length

/** Zuordnen-Aufgabe: zu jedem linken Begriff den passenden rechten Eintrag wählen. */
export function MatchQuestion({ pairs, value, onChange, revealed, seed }: {
  pairs: [string, string][]
  value: number[]
  onChange: (v: number[]) => void
  revealed: boolean
  seed: string
}) {
  const order = useMemo(() => matchOrder(pairs.length, seed), [pairs.length, seed])
  return (
    <div className="match">
      {pairs.map(([left, right], i) => {
        const chosen = value[i] ?? -1
        const ok = chosen === i
        return (
          <div key={i} className={`match-row${revealed ? (ok ? ' correct' : ' wrong') : ''}`}>
            <div className="match-left"><Rich text={left} /></div>
            {revealed ? (
              <div className="match-answer">
                {!ok && chosen >= 0 && <s className="muted">{plainText(pairs[chosen][1])}</s>}
                <span className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                  <span className={ok ? 'badge-good' : 'badge-warn'}>{ok ? '✓' : 'richtig:'}</span>
                  <Rich text={right} />
                </span>
              </div>
            ) : (
              <select
                aria-label={`Zuordnung für ${plainText(left)}`}
                value={chosen}
                onChange={(e) => onChange(Object.assign(Array.from({ length: pairs.length }, (_, k) => value[k] ?? -1), { [i]: Number(e.target.value) }))}
              >
                <option value={-1}>Bitte wählen …</option>
                {order.map((k) => (
                  <option key={k} value={k}>{plainText(pairs[k][1])}</option>
                ))}
              </select>
            )}
          </div>
        )
      })}
    </div>
  )
}
