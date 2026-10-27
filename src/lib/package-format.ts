// Kartenpaket-Format und Validierung. Bewusst ohne Laufzeit-Imports, damit
// scripts/validate-paket.ts die Prüfung auch außerhalb der App nutzen kann.
import type { CardContent, CardType, Mode } from './db'

export const PACKAGE_FORMAT = 'lernapp-paket'
export const BACKUP_FORMAT = 'lernapp-backup'

export interface CardPackage {
  format: typeof PACKAGE_FORMAT
  formatVersion: 1
  id: string
  title: string
  module?: string
  version: number
  created?: string
  sources?: { file: string; pages?: number }[]
  chapters?: { id: string; title: string }[]
  cards: CardContent[]
}

const TYPES: CardType[] = ['basic', 'cloze', 'mc', 'task']
const MODES: Mode[] = ['mobile', 'desk']

const isStr = (v: unknown): v is string => typeof v === 'string'
const strArray = (v: unknown): string[] | undefined => (Array.isArray(v) && v.every(isStr) ? v : undefined)

/** Prüft ein Kartenpaket und liefert eine bereinigte Fassung oder wirft eine verständliche Fehlermeldung. */
export function parsePackage(raw: unknown): CardPackage {
  if (!raw || typeof raw !== 'object') throw new Error('Die Datei enthält kein gültiges Kartenpaket.')
  const p = raw as Record<string, unknown>
  if (p.format !== PACKAGE_FORMAT) throw new Error('Unbekanntes Dateiformat – erwartet wird ein Lernapp-Kartenpaket.')
  if (p.formatVersion !== 1) throw new Error(`Paketformat-Version ${String(p.formatVersion)} wird nicht unterstützt. Bitte App aktualisieren.`)
  if (!isStr(p.id) || !p.id) throw new Error('Dem Paket fehlt eine ID.')
  if (!Array.isArray(p.cards)) throw new Error('Das Paket enthält keine Karten.')

  const seen = new Set<string>()
  const cards: CardContent[] = p.cards.map((c: Record<string, unknown>, i: number) => {
    const where = `Karte ${i + 1}`
    if (!c || typeof c !== 'object') throw new Error(`${where} ist ungültig.`)
    if (!isStr(c.uid) || !c.uid) throw new Error(`${where} hat keine uid.`)
    if (seen.has(c.uid)) throw new Error(`Die uid „${c.uid}“ kommt doppelt vor.`)
    seen.add(c.uid)
    const type = (c.type ?? 'basic') as CardType
    if (!TYPES.includes(type)) throw new Error(`${where}: unbekannter Typ „${String(c.type)}“.`)
    if (!isStr(c.front)) throw new Error(`${where}: Vorderseite fehlt.`)
    const card: CardContent = { uid: c.uid, type, front: c.front, back: isStr(c.back) ? c.back : '' }
    if (isStr(c.chapter)) card.chapter = c.chapter
    if (type === 'mc') {
      const options = strArray(c.options)
      const correct = Array.isArray(c.correct) ? c.correct.filter((n): n is number => Number.isInteger(n)) : []
      if (!options || options.length < 2) throw new Error(`${where}: Multiple Choice braucht mindestens zwei Optionen.`)
      if (!correct.length || correct.some((n) => n < 0 || n >= options.length)) throw new Error(`${where}: ungültige richtige Antwort(en).`)
      card.options = options
      card.correct = correct
    }
    const steps = strArray(c.steps)
    if (steps) card.steps = steps
    if (isStr(c.result)) card.result = c.result
    if (c.source && typeof c.source === 'object') {
      const s = c.source as Record<string, unknown>
      card.source = {
        file: isStr(s.file) ? s.file : undefined,
        slide: isStr(s.slide) || typeof s.slide === 'number' ? s.slide : undefined,
      }
    }
    if (isStr(c.image) && /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/.test(c.image)) card.image = c.image
    const tags = strArray(c.tags)
    if (tags) card.tags = tags
    if (typeof c.relevance === 'number') card.relevance = Math.min(3, Math.max(1, Math.round(c.relevance)))
    if (MODES.includes(c.mode as Mode)) card.mode = c.mode as Mode
    return card
  })

  const chapters = Array.isArray(p.chapters)
    ? p.chapters.filter((c): c is { id: string; title: string } => !!c && isStr(c.id) && isStr(c.title))
    : undefined
  return {
    format: PACKAGE_FORMAT,
    formatVersion: 1,
    id: p.id,
    title: isStr(p.title) && p.title ? p.title : p.id,
    module: isStr(p.module) ? p.module : undefined,
    version: typeof p.version === 'number' ? p.version : 1,
    created: isStr(p.created) ? p.created : undefined,
    chapters,
    cards,
  }
}
