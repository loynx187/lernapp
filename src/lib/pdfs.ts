import { db } from './db'
import { download, getTokens, listFolder, upload } from './dropbox'

/**
 * Vorlesungsunterlagen für „Folie ansehen“.
 *
 * Eine Web-App kann auf iOS keinen Dateipfad und keinen iCloud-Ordner dauerhaft verknüpfen –
 * eine ausgewählte Datei ist immer eine Kopie. Deshalb werden Unterlagen auf dem Gerät
 * gespeichert und, wenn Dropbox verbunden ist, zusätzlich unter Apps/<App>/Unterlagen
 * abgelegt. Andere Geräte laden sie von dort bei Bedarf automatisch.
 */
export const PDF_FOLDER = '/Unterlagen'

const syncKey = (profileId: string) => `pdfsync:${profileId}`

/** Unterlagen über Dropbox auf alle Geräte verteilen (Standard: ja). */
export async function getPdfSync(profileId: string): Promise<boolean> {
  return ((await db.meta.get(syncKey(profileId)))?.value as boolean | undefined) ?? true
}

export async function setPdfSync(profileId: string, on: boolean) {
  await db.meta.put({ key: syncKey(profileId), value: on })
}

async function dropboxEnabled(profileId: string) {
  return !!(await getTokens(profileId)) && (await getPdfSync(profileId))
}

/**
 * Sucht eine Unterlage: zuerst auf dem Gerät, dann (falls verbunden) in Dropbox.
 * Aus Dropbox geladene Dateien werden auf dem Gerät gespeichert.
 */
export async function findPdf(name: string, profileId: string): Promise<Blob | null> {
  const local = await db.pdfs.get(name)
  if (local) return local.blob
  if (!(await getTokens(profileId))) return null
  const remote = await download(profileId, `${PDF_FOLDER}/${name}`)
  if (!remote) return null
  const blob = new Blob([remote.data], { type: 'application/pdf' })
  await db.pdfs.put({ name, blob, size: blob.size, addedAt: Date.now() })
  return blob
}

/** Speichert eine Unterlage auf dem Gerät und – falls aktiviert – in Dropbox für die anderen Geräte. */
export async function storePdf(name: string, blob: Blob, profileId?: string) {
  await db.pdfs.put({ name, blob, size: blob.size, addedAt: Date.now() })
  if (profileId && (await dropboxEnabled(profileId))) {
    await upload(profileId, `${PDF_FOLDER}/${name}`, new Uint8Array(await blob.arrayBuffer()))
  }
}

export async function removePdf(name: string) {
  await db.pdfs.delete(name)
}

/** Unterlagen, auf die die Karten der Prüfungen verweisen, mit Anzahl der Karten. */
export async function requiredDocuments(examIds: string[]): Promise<{ name: string; examIds: string[]; cards: number }[]> {
  const docs = new Map<string, { name: string; examIds: Set<string>; cards: number }>()
  for (const examId of examIds) {
    const cards = await db.cards.where('[examId+archived]').equals([examId, 0]).toArray()
    for (const c of cards) {
      const name = c.source?.file
      if (!name) continue
      const d = docs.get(name) ?? { name, examIds: new Set<string>(), cards: 0 }
      d.examIds.add(examId)
      d.cards++
      docs.set(name, d)
    }
  }
  return [...docs.values()].map((d) => ({ ...d, examIds: [...d.examIds] })).sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/** Dateinamen vergleichbar machen: Groß/Klein, Leer- und Sonderzeichen, Endung egal. */
export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.pdf$/, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')

/**
 * Ordnet ausgewählte Dateien den benötigten Unterlagen zu – exakt nach Namen oder,
 * falls nötig, unabhängig von Schreibweise und Sonderzeichen.
 */
export function matchFiles<F extends { name: string }>(files: F[], required: string[]): { matched: Map<string, F>; unmatched: F[] } {
  const matched = new Map<string, F>()
  const byNorm = new Map(required.map((r) => [normalizeName(r), r]))
  const unmatched: F[] = []
  for (const f of files) {
    const target = required.includes(f.name) ? f.name : byNorm.get(normalizeName(f.name))
    if (target && !matched.has(target)) matched.set(target, f)
    else unmatched.push(f)
  }
  return { matched, unmatched }
}

/** Namen der Unterlagen, die bereits in Dropbox liegen (kleingeschrieben, wie Dropbox Pfade liefert). */
export async function dropboxDocuments(profileId: string): Promise<Set<string>> {
  if (!(await getTokens(profileId))) return new Set()
  return new Set((await listFolder(profileId, PDF_FOLDER)).map((f) => f.name.toLowerCase()))
}

/** Lädt pdf.js erst bei Bedarf (ca. 1 MB). */
export async function loadPdf(blob: Blob) {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
}
