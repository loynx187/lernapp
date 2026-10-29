// Sokratisches Lernen (Stufe 1): Leitfragen vor dem Aufdecken, Kernpunkte zum Abhaken danach.
// Die App schlägt eine Bewertung nur vor – bewertet wird weiterhin von Hand, der Lernalgorithmus bleibt unverändert.
import { Rating, type Grade } from './scheduler'

/** Bewertungsvorschlag aus abgehakten Kernpunkten und genutzten Tipps; undefined = kein Vorschlag. */
export function suggestRating({ checked, total, hints }: { checked: number; total: number; hints: number }): Grade | undefined {
  if (total === 0) return hints > 0 ? Rating.Hard : undefined
  const share = checked / total
  if (share < 0.5) return Rating.Again
  if (share < 0.8) return Rating.Hard
  // Alles Wesentliche gewusst – mit Tipps aber nur mit Hilfe.
  return hints > 0 ? Rating.Hard : Rating.Good
}
