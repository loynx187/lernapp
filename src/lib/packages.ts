import { db, type CardContent, type Exam, type PackageRecord, type ProfileField, type StudyCard } from './db'
import { mergeProfile } from './profile'
import { newMemoryState } from './scheduler'
import { PACKAGE_FORMAT, type CardPackage } from './package-format'

export { BACKUP_FORMAT, PACKAGE_FORMAT, parsePackage, type CardPackage } from './package-format'

export interface ImportResult {
  added: number
  updated: number
  unchanged: number
  archived: number
  restored: number
  /** Vom Nutzer gelöschte Karten, die das Paket weiterhin enthält – sie bleiben gelöscht. */
  deleted: number
  resolvedReports: number
  /** Vom Paket vorgeschlagene und ins Fachprofil übernommene Felder. */
  profileFields: ProfileField[]
}

const contentKey = (c: CardContent) =>
  JSON.stringify([c.type, c.chapter, c.front, c.back, c.options, c.correct, c.steps, c.result, c.source, c.image, c.tags, c.relevance, c.mode])

/**
 * Importiert ein Paket in eine Prüfung. Bei einem Update desselben Pakets bleibt der
 * Lernfortschritt aller Karten mit gleicher uid erhalten; neue Karten kommen hinzu,
 * entfernte Karten werden archiviert (nicht gelöscht, Fortschritt bleibt). Vom Nutzer gelöschte
 * Karten bleiben gelöscht, erhalten aber den neuen Inhalt (für eine spätere Wiederherstellung).
 */
export async function importPackage(exam: Exam, pkg: CardPackage, now = Date.now()): Promise<ImportResult> {
  const chapterTitles = new Map((pkg.chapters ?? []).map((c) => [c.id, c.title]))
  const chapterOrder = new Map((pkg.chapters ?? []).map((c, i) => [c.id, i]))
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0, archived: 0, restored: 0, deleted: 0, resolvedReports: 0, profileFields: [] }

  await db.transaction('rw', db.cards, db.packages, db.reports, db.exams, async () => {
    const changed: string[] = []
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
        if (old.deletedAt) {
          result.deleted++
          return { ...stripContent(old), ...content, chapterTitle, order, archived: 1 as const }
        }
        if (old.archived) result.restored++
        else if (contentKey(old) !== contentKey(content)) {
          result.updated++
          changed.push(old.id)
        } else result.unchanged++
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
    // Meldungen zu Karten, die das Update geändert hat, gelten als bearbeitet.
    const open = (await db.reports.where('cardId').anyOf(changed).toArray()).filter((r) => !r.resolvedAt)
    for (const r of open) await db.reports.update(r.id, { resolvedAt: now })
    result.resolvedReports = open.length
    const previous = await db.packages.get(`${exam.id}:${pkg.id}`)
    const record: PackageRecord = {
      id: `${exam.id}:${pkg.id}`,
      profileId: exam.profileId,
      examId: exam.id,
      packageId: pkg.id,
      title: pkg.title,
      version: pkg.version,
      importedAt: now,
      firstImportedAt: previous?.firstImportedAt ?? previous?.importedAt ?? now,
      cardCount: pkg.cards.length,
    }
    await db.packages.put(record)
    const current = await db.exams.get(exam.id)
    if (pkg.profile && current) {
      const { profile, changed } = mergeProfile(current.profile, pkg.profile, false)
      if (changed.length || profile.slug !== current.profile?.slug) await db.exams.update(exam.id, { profile })
      result.profileFields = changed
    }
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

/** Bietet eine Datei zum Speichern an – auf dem iPhone über das Teilen-Menü („In Dateien sichern“). Liefert false bei Abbruch. */
export async function saveFile(name: string, content: string, type = 'application/json'): Promise<boolean> {
  const file = new File([content], name, { type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: name })
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export const safeFileName = (s: string) => s.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 60)
