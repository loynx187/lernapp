import { db, type CardContent, type CardType, type Exam, type Mode, type PackageRecord, type StudyCard } from './db'
import { newMemoryState } from './scheduler'

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

export interface ImportResult {
  added: number
  updated: number
  unchanged: number
  archived: number
  restored: number
}

const contentKey = (c: CardContent) =>
  JSON.stringify([c.type, c.chapter, c.front, c.back, c.options, c.correct, c.steps, c.result, c.source, c.image, c.tags, c.relevance, c.mode])

/**
 * Importiert ein Paket in eine Prüfung. Bei einem Update desselben Pakets bleibt der
 * Lernfortschritt aller Karten mit gleicher uid erhalten; neue Karten kommen hinzu,
 * entfernte Karten werden archiviert (nicht gelöscht, Fortschritt bleibt).
 */
export async function importPackage(exam: Exam, pkg: CardPackage, now = Date.now()): Promise<ImportResult> {
  const chapterTitles = new Map((pkg.chapters ?? []).map((c) => [c.id, c.title]))
  const chapterOrder = new Map((pkg.chapters ?? []).map((c, i) => [c.id, i]))
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0, archived: 0, restored: 0 }

  await db.transaction('rw', db.cards, db.packages, async () => {
    const existing = new Map(
      (await db.cards.where('packageId').equals(pkg.id).filter((c) => c.examId === exam.id).toArray()).map((c) => [c.uid, c]),
    )
    const next: StudyCard[] = pkg.cards.map((content, i) => {
      // Reihenfolge: Kapitel laut Kapitelliste, innerhalb des Kapitels wie im Paket.
      const order = (chapterOrder.get(content.chapter ?? '') ?? chapterOrder.size) * 100_000 + i
      const chapterTitle = content.chapter ? chapterTitles.get(content.chapter) ?? content.chapter : undefined
      const old = existing.get(content.uid)
      if (old) {
        existing.delete(content.uid)
        if (old.archived) result.restored++
        else if (contentKey(old) !== contentKey(content)) result.updated++
        else result.unchanged++
        return { ...stripContent(old), ...content, chapterTitle, order, archived: 0 as const }
      }
      result.added++
      return {
        ...content,
        id: `${exam.id}:${pkg.id}:${content.uid}`,
        profileId: exam.profileId,
        examId: exam.id,
        packageId: pkg.id,
        chapterTitle,
        order,
        archived: 0 as const,
        addedAt: now,
        s: newMemoryState(now),
      }
    })
    for (const old of existing.values()) {
      if (!old.archived) {
        result.archived++
        next.push({ ...old, archived: 1 })
      }
    }
    await db.cards.bulkPut(next)
    const record: PackageRecord = {
      id: `${exam.id}:${pkg.id}`,
      profileId: exam.profileId,
      examId: exam.id,
      packageId: pkg.id,
      title: pkg.title,
      version: pkg.version,
      importedAt: now,
      cardCount: pkg.cards.length,
    }
    await db.packages.put(record)
  })
  return result
}

/** Entfernt optionale Inhaltsfelder, damit ein Update gelöschte Felder (z. B. ein Bild) nicht übernimmt. */
function stripContent(c: StudyCard): StudyCard {
  const { chapter: _1, options: _2, correct: _3, steps: _4, result: _5, source: _6, image: _7, tags: _8, relevance: _9, mode: _10, ...rest } = c
  return rest as StudyCard
}

/** Exportiert die Karten einer Prüfung als Paket zum Teilen (ohne Lernfortschritt). */
export async function exportPackage(exam: Exam, packageId: string): Promise<CardPackage> {
  const rec = await db.packages.get(`${exam.id}:${packageId}`)
  const cards = (await db.cards.where('packageId').equals(packageId).filter((c) => c.examId === exam.id && !c.archived).toArray()).sort(
    (a, b) => a.order - b.order,
  )
  const chapters = new Map<string, string>()
  for (const c of cards) if (c.chapter) chapters.set(c.chapter, c.chapterTitle ?? c.chapter)
  return {
    format: PACKAGE_FORMAT,
    formatVersion: 1,
    id: packageId,
    title: rec?.title ?? exam.name,
    module: exam.name,
    version: rec?.version ?? 1,
    created: new Date().toISOString().slice(0, 10),
    chapters: [...chapters].map(([id, title]) => ({ id, title })),
    cards: cards.map((c) => {
      const { id: _1, profileId: _2, examId: _3, packageId: _4, chapterTitle: _5, order: _6, archived: _7, addedAt: _8, s: _9, ...content } = c
      return content
    }),
  }
}

/**
 * Liest Frage/Antwort-Paare aus Text, z. B. aus NotebookLM oder Quizlet kopiert.
 * Je Zeile „Frage<TAB>Antwort“ oder „Frage ;; Antwort“, alternativ Blöcke mit
 * „F:“/„Frage:“ und „A:“/„Antwort:“, getrennt durch Leerzeilen.
 */
export function parseTextCards(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = []
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)
  for (const block of blocks) {
    const qa = block.match(/^\s*(?:F|Frage|Q)\s*[:.)]\s*([\s\S]*?)\n\s*(?:A|Antwort)\s*[:.)]\s*([\s\S]*)$/i)
    if (qa) {
      out.push({ front: qa[1].trim(), back: qa[2].trim() })
      continue
    }
    for (const line of block.split('\n')) {
      const parts = line.includes('\t') ? line.split('\t') : line.split(/\s;;\s/)
      if (parts.length >= 2 && parts[0].trim() && parts.slice(1).join(' ').trim()) {
        out.push({ front: parts[0].trim(), back: parts.slice(1).join(' ').trim() })
      }
    }
  }
  return out
}

export function textToPackage(title: string, pairs: { front: string; back: string }[]): CardPackage {
  const id = `text-${Date.now().toString(36)}`
  return {
    format: PACKAGE_FORMAT,
    formatVersion: 1,
    id,
    title,
    version: 1,
    cards: pairs.map((p, i) => ({ uid: `t${i + 1}`, type: 'basic', front: p.front, back: p.back })),
  }
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
}

/** Bietet eine Datei zum Speichern an – auf dem iPhone über das Teilen-Menü („In Dateien sichern“). */
export async function saveFile(name: string, content: string, type = 'application/json') {
  const file = new File([content], name, { type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const safeFileName = (s: string) => s.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 60)
