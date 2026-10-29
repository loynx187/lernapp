// Kartenpaket-Format und Validierung. Bewusst ohne Laufzeit-Imports, damit
// scripts/validate-paket.ts die Prüfung auch außerhalb der App nutzen kann.
import type { CardContent, CardType, ExamProfile, Mode, NumericAnswer, PendingDoc, TaskShare } from './db'

export const PACKAGE_FORMAT = 'lernapp-paket'
export const BACKUP_FORMAT = 'lernapp-backup'

/** Erinnerung an fehlende Unterlagen, wie sie in Paketen und Fachprofil-Dateien steht. */
export type PendingInput = Pick<PendingDoc, 'id' | 'title' | 'note' | 'from' | 'repeatDays'>

/** Liest Erinnerungen an fehlende Unterlagen; ungültige Einträge entfallen. */
export function parsePending(raw: unknown): PendingInput[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const list = raw
    .filter((d): d is Record<string, unknown> & { id: string; title: string } => !!d && isStr(d.id) && isStr(d.title) && !!d.title.trim())
    .map((d) => ({
      id: d.id,
      title: d.title.trim(),
      note: isStr(d.note) && d.note.trim() ? d.note.trim() : undefined,
      from: isStr(d.from) && /^\d{4}-\d{2}-\d{2}$/.test(d.from) ? d.from : undefined,
      repeatDays: typeof d.repeatDays === 'number' && d.repeatDays >= 1 ? Math.round(d.repeatDays) : undefined,
    }))
  return list.length ? list : undefined
}

export interface CardPackage {
  format: typeof PACKAGE_FORMAT
  formatVersion: 1
  id: string
  title: string
  module?: string
  version: number
  created?: string
  sources?: { file: string; pages?: number }[]
  /** `later`: Kapitel ist in der Vorlesung noch nicht dran – wird beim ersten Import pausiert. */
  chapters?: { id: string; title: string; later?: boolean }[]
  /** Vorschläge für das Fachprofil der Prüfung; die App übernimmt sie nur in leere Felder. */
  profile?: ExamProfile
  /** Noch fehlende Unterlagen, an die die App erinnern soll (z. B. Altklausuren). */
  pending?: PendingInput[]
  /** Mindestens nötige App-Version (z. B. „1.19.0“), wenn das Paket neue Felder nutzt. */
  minApp?: string
  cards: CardContent[]
}

const TYPES: CardType[] = ['basic', 'cloze', 'mc', 'match', 'task']
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
    if (type === 'match') {
      const pairs = Array.isArray(c.pairs) ? c.pairs.filter((p): p is [string, string] => Array.isArray(p) && p.length === 2 && isStr(p[0]) && isStr(p[1])) : []
      if (pairs.length < 2) throw new Error(`${where}: Zuordnen braucht mindestens zwei Paare [links, rechts].`)
      if (new Set(pairs.map((p) => p[1].trim())).size !== pairs.length) throw new Error(`${where}: Zuordnen – die rechten Einträge müssen verschieden sein.`)
      card.pairs = pairs.map(([l, r]) => [l, r])
    }
    const steps = strArray(c.steps)
    if (steps) card.steps = steps
    if (isStr(c.result)) card.result = c.result
    if (Array.isArray(c.answers)) {
      card.answers = c.answers.map((a: Record<string, unknown>, j: number): NumericAnswer => {
        const text = isStr(a?.text) ? [a.text] : strArray(a?.text)
        const label = isStr(a?.label) ? a.label : undefined
        const unit = isStr(a?.unit) ? a.unit : undefined
        if (text?.length) return { text, label, unit }
        if (!a || typeof a.value !== 'number' || !Number.isFinite(a.value)) throw new Error(`${where}: Ergebnis ${j + 1} braucht einen Zahlenwert (value) oder einen Text (text).`)
        const tol = typeof a.tolerance === 'number' && a.tolerance > 0 && a.tolerance < 1 ? a.tolerance : undefined
        return { value: a.value, label, unit, tolerance: tol }
      })
    }
    if (c.source && typeof c.source === 'object') {
      const s = c.source as Record<string, unknown>
      card.source = {
        file: isStr(s.file) ? s.file : undefined,
        slide: isStr(s.slide) || typeof s.slide === 'number' ? s.slide : undefined,
        page: typeof s.page === 'number' && Number.isInteger(s.page) && s.page > 0 ? s.page : undefined,
      }
    }
    if (isStr(c.image) && /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/.test(c.image)) card.image = c.image
    const tags = strArray(c.tags)
    if (tags) card.tags = tags
    if (typeof c.relevance === 'number') card.relevance = Math.min(3, Math.max(1, Math.round(c.relevance)))
    const topics = strArray(c.topics)
    if (topics?.length) card.topics = topics
    if (c.pastExam === true) card.pastExam = true
    if (MODES.includes(c.mode as Mode)) card.mode = c.mode as Mode
    const prompts = strArray(c.prompts)?.map((x) => x.trim()).filter(Boolean)
    if (prompts?.length) card.prompts = prompts
    const keyPoints = strArray(c.keyPoints)?.map((x) => x.trim()).filter(Boolean)
    if (keyPoints?.length) card.keyPoints = keyPoints
    return card
  })

  const chapters = Array.isArray(p.chapters)
    ? p.chapters
        .filter((c): c is { id: string; title: string; later?: unknown } => !!c && isStr(c.id) && isStr(c.title))
        .map((c) => (c.later === true ? { id: c.id, title: c.title, later: true } : { id: c.id, title: c.title }))
    : undefined
  const pending = parsePending(p.pending)
  return {
    format: PACKAGE_FORMAT,
    formatVersion: 1,
    id: p.id,
    title: isStr(p.title) && p.title ? p.title : p.id,
    module: isStr(p.module) ? p.module : undefined,
    version: typeof p.version === 'number' ? p.version : 1,
    created: isStr(p.created) ? p.created : undefined,
    chapters,
    profile: parseProfile(p.profile),
    pending,
    minApp: isStr(p.minApp) && /^\d+\.\d+\.\d+$/.test(p.minApp) ? p.minApp : undefined,
    cards,
  }
}

/** Vergleicht Versionsnummern „x.y.z“; negativ, wenn a älter ist. */
export function compareVersions(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/** Fehlermeldung, wenn ein Paket eine neuere App braucht – sonst gingen neue Felder beim Import still verloren. */
export function appTooOld(pkg: Pick<CardPackage, 'minApp' | 'title'>, appVersion: string): string | undefined {
  if (pkg.minApp && compareVersions(appVersion, pkg.minApp) < 0)
    return `„${pkg.title}“ braucht App-Version ${pkg.minApp} (installiert: ${appVersion}). Bitte zuerst die App aktualisieren (neu laden), dann erneut importieren.`
}

const TASK_SHARES: TaskShare[] = ['keine', 'wenig', 'mittel', 'hoch']
const TEXT_FIELDS = ['slug', 'form', 'aids', 'focus', 'omit', 'notation', 'notes'] as const

/** Liest ein Fachprofil (aus Paket oder Profildatei); unbekannte oder leere Felder entfallen. */
export function parseProfile(raw: unknown): ExamProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: ExamProfile = {}
  for (const k of TEXT_FIELDS) if (isStr(r[k]) && r[k].trim()) out[k] = r[k].trim()
  if (out.slug) out.slug = slugify(out.slug)
  if (typeof r.duration === 'number' && r.duration > 0) out.duration = Math.round(r.duration)
  if (TASK_SHARES.includes(r.taskShare as TaskShare)) out.taskShare = r.taskShare as TaskShare
  return Object.keys(out).length ? out : undefined
}

/** Ordnername eines Fachs: Kleinbuchstaben, Umlaute ausgeschrieben, Bindestriche. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
