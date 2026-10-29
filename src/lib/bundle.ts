// Paket-Sammlung: mehrere Kartenpakete für verschiedene Prüfungen in einer Datei – z. B. alle
// Updates von Claude auf einmal. Jedes Paket wird wie ein einzelner Import übernommen (Lernfortschritt
// bleibt, entfernte Karten werden archiviert, Meldungen zu geänderten Karten erledigt).
import { db, type Exam } from './db'
import { importPackage, type ImportResult } from './packages'
import { parsePackage, slugify, type CardPackage } from './package-format'
import { matchExam } from './profile'
import type { PackageStatus } from './template'

export const BUNDLE_FORMAT = 'lernapp-sammlung'

export interface BundleExam {
  /** Name der Prüfung (Zuordnung, falls der Slug nicht passt) */
  name?: string
  /** Archiv-Ordner des Fachs – wie im Auftrag */
  slug?: string
  packages: CardPackage[]
}

export interface PackageBundle {
  format: typeof BUNDLE_FORMAT
  formatVersion: 1
  created?: string
  exams: BundleExam[]
}

export function parseBundle(raw: unknown): PackageBundle {
  const b = raw as Partial<PackageBundle> | null
  if (!b || b.format !== BUNDLE_FORMAT) throw new Error('Die Datei ist keine Paket-Sammlung.')
  if (b.formatVersion !== 1) throw new Error('Diese Paket-Sammlung stammt aus einer neueren App-Version. Bitte App aktualisieren.')
  if (!Array.isArray(b.exams) || !b.exams.length) throw new Error('Die Paket-Sammlung enthält keine Prüfungen.')
  const exams = b.exams.map((e): BundleExam => {
    if (!e || !Array.isArray(e.packages)) throw new Error('Die Paket-Sammlung enthält eine ungültige Prüfung.')
    const name = typeof e.name === 'string' && e.name.trim() ? e.name.trim() : undefined
    const slug = typeof e.slug === 'string' && e.slug.trim() ? slugify(e.slug) : undefined
    if (!name && !slug) throw new Error('In der Paket-Sammlung fehlt bei einer Prüfung Name oder Slug.')
    return {
      name,
      slug,
      packages: e.packages.map((p) => {
        try {
          return parsePackage(p)
        } catch (err) {
          throw new Error(`${name ?? slug}: ${(err as Error).message}`)
        }
      }),
    }
  })
  return { format: BUNDLE_FORMAT, formatVersion: 1, created: typeof b.created === 'string' ? b.created : undefined, exams }
}

export interface BundlePlanEntry {
  entry: BundleExam
  exam?: Exam
  packages: { pkg: CardPackage; status: PackageStatus; installed?: number }[]
}

/**
 * Ordnet die Sammlung den Prüfungen zu – über Slug oder Namen, sonst über ein schon importiertes
 * Paket mit gleicher ID. `exams` in Vorzugsreihenfolge (aktives Semester zuerst).
 */
export async function bundlePlan(exams: Exam[], bundle: PackageBundle): Promise<BundlePlanEntry[]> {
  const records = await db.packages.where('examId').anyOf(exams.map((e) => e.id)).toArray()
  return bundle.exams.map((entry) => {
    const ids = new Set(entry.packages.map((p) => p.id))
    const exam = matchExam(exams, entry) ?? exams.find((e) => records.some((r) => r.examId === e.id && ids.has(r.packageId)))
    return {
      entry,
      exam,
      packages: entry.packages.map((pkg) => {
        const rec = exam && records.find((r) => r.examId === exam.id && r.packageId === pkg.id)
        const status: PackageStatus = !rec ? 'neu' : pkg.version > rec.version ? 'neuer' : pkg.version === rec.version ? 'gleich' : 'aelter'
        return { pkg, status, installed: rec?.version }
      }),
    }
  })
}

export interface BundleResult {
  /** Aktualisierte bzw. neu importierte Pakete */
  imported: { exam: string; title: string; status: 'neu' | 'neuer'; result: ImportResult }[]
  /** Pakete, die schon in dieser Version vorhanden sind */
  same: string[]
  /** Pakete, von denen du schon eine neuere Version hast – nicht überschrieben */
  older: string[]
  /** Prüfungen aus der Sammlung ohne passende Prüfung im Profil */
  unmatched: string[]
}

/** Übernimmt alle neuen und neueren Pakete der Sammlung; gleiche und ältere Versionen bleiben unangetastet. */
export async function importBundle(plan: BundlePlanEntry[], now = Date.now()): Promise<BundleResult> {
  const out: BundleResult = { imported: [], same: [], older: [], unmatched: [] }
  let stamp = 0
  for (const { entry, exam, packages } of plan) {
    if (!exam) {
      out.unmatched.push(entry.name ?? entry.slug ?? '')
      continue
    }
    for (const { pkg, status } of packages) {
      if (status === 'gleich') out.same.push(pkg.title)
      else if (status === 'aelter') out.older.push(pkg.title)
      else {
        const current = (await db.exams.get(exam.id)) ?? exam
        // Je Paket ein eigener Zeitstempel, damit die Reihenfolge der Pakete erhalten bleibt.
        const result = await importPackage(current, pkg, now + stamp++)
        out.imported.push({ exam: exam.name, title: pkg.title, status, result })
      }
    }
  }
  return out
}

/** Summen über alle übernommenen Pakete – für die Erfolgsmeldung. */
export function bundleTotals(r: BundleResult) {
  const sum = (k: 'added' | 'updated' | 'archived' | 'resolvedReports' | 'pausedChapters') => r.imported.reduce((n, i) => n + i.result[k], 0)
  return { added: sum('added'), updated: sum('updated'), archived: sum('archived'), resolvedReports: sum('resolvedReports'), pausedChapters: sum('pausedChapters') }
}
