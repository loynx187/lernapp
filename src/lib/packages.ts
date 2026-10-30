import { db, type CardContent, type Exam, type PackageRecord, type ProfileField, type StudyCard } from './db'
import { mergeProfile } from './profile'
import { sortPackages } from './stats'
import { newMemoryState } from './scheduler'
import { chapterKey, mergePending } from './pending'
import { PACKAGE_FORMAT, requiredApp, type CardPackage } from './package-format'

export { BACKUP_FORMAT, PACKAGE_FORMAT, parsePackage, type CardPackage } from './package-format'
export { parseTextCards, textToPackage, type TextCard } from './textCards'

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
  /** Kapitel, die laut Paket noch nicht dran sind und deshalb pausiert wurden. */
  pausedChapters: number
  /** Neu angelegte Erinnerungen an fehlende Unterlagen. */
  pendingAdded: number
}

const contentKey = (c: CardContent) =>
  JSON.stringify([c.type, c.chapter, c.front, c.back, c.options, c.correct, c.pairs, c.steps, c.result, c.answers, c.source, c.image, c.tags, c.relevance, c.mode, c.topics, c.pastExam, c.prompts, c.keyPoints])

/**
 * Importiert ein Paket in eine Prüfung. Bei einem Update desselben Pakets bleibt der
 * Lernfortschritt aller Karten mit gleicher uid erhalten; neue Karten kommen hinzu,
 * entfernte Karten werden archiviert (nicht gelöscht, Fortschritt bleibt). Vom Nutzer gelöschte
 * Karten bleiben gelöscht, erhalten aber den neuen Inhalt (für eine spätere Wiederherstellung).
 */
/** `keepMissing`: Karten, die im Paket fehlen, nicht archivieren (Vorlagen enthalten keine vom Absender gelöschten Karten). */
export async function importPackage(exam: Exam, pkg: CardPackage, now = Date.now(), { keepMissing = false } = {}): Promise<ImportResult> {
  const chapterTitles = new Map((pkg.chapters ?? []).map((c) => [c.id, c.title]))
  const chapterOrder = new Map((pkg.chapters ?? []).map((c, i) => [c.id, i]))
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0, archived: 0, restored: 0, deleted: 0, resolvedReports: 0, profileFields: [], pausedChapters: 0, pendingAdded: 0 }

  await db.transaction('rw', db.cards, db.packages, db.reports, db.exams, async () => {
    const changed: string[] = []
    const existing = new Map(
      (await db.cards.where('packageId').equals(pkg.id).filter((c) => c.examId === exam.id).toArray()).map((c) => [c.uid, c]),
    )
    const knownChapters = new Set([...existing.values()].map((c) => c.chapter ?? ''))
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
          // Nur Leitfragen/Kernpunkte ergänzt: Eine Meldung zum Inhalt ist damit nicht bearbeitet.
          if (contentKey({ ...old, prompts: undefined, keyPoints: undefined }) !== contentKey({ ...content, prompts: undefined, keyPoints: undefined })) changed.push(old.id)
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
    for (const old of keepMissing ? [] : existing.values()) {
      // Nicht mehr im Paket: Die Meldung dazu ist mit dem Update ebenfalls erledigt.
      changed.push(old.id)
      if (!old.archived) {
        result.archived++
        next.push({ ...old, archived: 1 })
      }
    }
    // Vom Nutzer entferntes Paket: Ein Update aktualisiert die Inhalte, das Paket bleibt aber entfernt
    // (auch neue Karten), bis er es wiederherstellt.
    const removedAt = (await db.packages.get(`${exam.id}:${pkg.id}`))?.removedAt
    if (removedAt) for (const [i, c] of next.entries()) if (!c.archived) next[i] = { ...c, archived: 1, deletedAt: removedAt }
    await db.cards.bulkPut(next)
    // Meldungen zu Karten, die das Update geändert oder entfernt hat, gelten als bearbeitet.
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
      // Hat der Nutzer die Reihenfolge festgelegt, kommt ein neues Paket ans Ende.
      position: previous ? previous.position : await nextPosition(exam.id),
      cardCount: pkg.cards.length,
      removedAt: previous?.removedAt,
    }
    await db.packages.put(record)
    const current = await db.exams.get(exam.id)
    if (pkg.profile && current) {
      const { profile, changed } = mergeProfile(current.profile, pkg.profile, false)
      if (changed.length || profile.slug !== current.profile?.slug) await db.exams.update(exam.id, { profile })
      result.profileFields = changed
    }
    if (current) {
      const updates: Partial<Exam> = {}
      const pending = mergePending(current.pendingDocs, pkg.pending)
      if (pending) {
        updates.pendingDocs = pending
        result.pendingAdded = pending.length - (current.pendingDocs?.length ?? 0)
      }
      // Kapitel, die in der Vorlesung noch nicht dran sind, beim ersten Import pausieren – danach entscheidet der Nutzer.
      const later = (pkg.chapters ?? []).filter((c) => c.later && !knownChapters.has(c.id)).map((c) => chapterKey({ packageId: pkg.id, chapter: c.id }))
      const paused = new Set(current.pausedChapters ?? [])
      const newlyPaused = later.filter((k) => !paused.has(k))
      if (newlyPaused.length) {
        updates.pausedChapters = [...paused, ...newlyPaused]
        result.pausedChapters = newlyPaused.length
      }
      if (Object.keys(updates).length) await db.exams.update(exam.id, updates)
    }
  })
  return result
}

async function nextPosition(examId: string): Promise<number | undefined> {
  const positions = (await db.packages.where('examId').equals(examId).toArray()).map((p) => p.position).filter((p) => p !== undefined)
  return positions.length ? Math.max(...positions) + 1 : undefined
}

/** Verschiebt ein Paket in der Lernreihenfolge seiner Prüfung um eine Stelle (-1 = früher, +1 = später). */
export async function movePackage(examId: string, packageId: string, step: -1 | 1) {
  await db.transaction('rw', db.packages, async () => {
    // Entfernte Pakete stehen nicht in der Liste und zählen nicht mit.
    const order = sortPackages((await db.packages.where('examId').equals(examId).toArray()).filter((p) => !p.removedAt))
    const i = order.findIndex((p) => p.packageId === packageId)
    const j = i + step
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    for (const [position, p] of order.entries()) if (p.position !== position) await db.packages.update(p.id, { position })
  })
}

/** Entfernt optionale Inhaltsfelder, damit ein Update gelöschte Felder (z. B. ein Bild) nicht übernimmt. */
function stripContent(c: StudyCard): StudyCard {
  const { chapter: _1, options: _2, correct: _3, pairs: _13, steps: _4, result: _5, answers: _16, source: _6, image: _7, tags: _8, relevance: _9, mode: _10, topics: _11, pastExam: _12, prompts: _14, keyPoints: _15, ...rest } = c
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
    minApp: requiredApp(cards),
    cards: cards.map((c) => {
      const { id: _1, profileId: _2, examId: _3, packageId: _4, chapterTitle: _5, order: _6, archived: _7, addedAt: _8, s: _9, ...content } = c
      return content
    }),
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
