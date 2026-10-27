import { db, tombstone, uid, type CardReport, type Exam, type ReportCategory, type StudyCard } from './db'

export const REPORTS_FORMAT = 'lernapp-meldungen'

export const REPORT_CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'fehler', label: 'Fachlich falsch' },
  { value: 'unklar', label: 'Unklar formuliert' },
  { value: 'aufteilen', label: 'Zu lang / aufteilen' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

export async function reportCard(card: StudyCard, category: ReportCategory, note: string, now = Date.now()) {
  const report: CardReport = {
    id: uid(),
    profileId: card.profileId,
    examId: card.examId,
    cardId: card.id,
    packageId: card.packageId,
    uid: card.uid,
    category,
    note: note.trim(),
    createdAt: now,
  }
  await db.reports.add(report)
  return report
}

export async function setResolved(r: CardReport, resolved: boolean) {
  await db.reports.update(r.id, { resolvedAt: resolved ? Date.now() : undefined })
}

export async function deleteReport(r: CardReport) {
  await db.transaction('rw', db.reports, db.tombstones, async () => {
    await db.reports.delete(r.id)
    await db.tombstones.put(tombstone('reports', r.id, r.profileId))
  })
}

/** Datei für die nächste Paketerstellung: offene Meldungen mit Karteninhalt, damit Claude sie zuordnen kann. */
export async function exportReports(exam: Exam) {
  const reports = (await db.reports.where('examId').equals(exam.id).toArray()).filter((r) => !r.resolvedAt)
  const cards = new Map((await db.cards.bulkGet(reports.map((r) => r.cardId))).filter(Boolean).map((c) => [c!.id, c!]))
  const packages = await db.packages.where('examId').equals(exam.id).toArray()
  return {
    format: REPORTS_FORMAT,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    exam: exam.name,
    packages: packages.map((p) => ({ id: p.packageId, title: p.title, version: p.version })),
    reports: reports
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => {
        const c = cards.get(r.cardId)
        return {
          packageId: r.packageId,
          uid: r.uid,
          category: r.category,
          note: r.note,
          reportedAt: new Date(r.createdAt).toISOString(),
          front: c?.front,
          back: c?.back,
          source: c?.source,
        }
      }),
  }
}
