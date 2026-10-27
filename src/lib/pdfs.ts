import { db } from './db'
import { download, getTokens } from './dropbox'

/** Ordner in der Dropbox der App, aus dem Unterlagen bei Bedarf geladen werden. */
export const PDF_FOLDER = '/Unterlagen'

/**
 * Sucht eine Unterlage: zuerst auf dem Gerät, dann (falls verbunden) in Dropbox unter
 * Apps/<App>/Unterlagen/<Dateiname>. Gefundene Dateien werden auf dem Gerät gespeichert.
 */
export async function findPdf(name: string, profileId: string): Promise<Blob | null> {
  const local = await db.pdfs.get(name)
  if (local) return local.blob
  if (!(await getTokens(profileId))) return null
  const remote = await download(profileId, `${PDF_FOLDER}/${name}`)
  if (!remote) return null
  const blob = new Blob([remote.data], { type: 'application/pdf' })
  await storePdf(name, blob)
  return blob
}

export async function storePdf(name: string, blob: Blob) {
  await db.pdfs.put({ name, blob, size: blob.size, addedAt: Date.now() })
}

export async function removePdf(name: string) {
  await db.pdfs.delete(name)
}

/** Lädt pdf.js erst bei Bedarf (ca. 1 MB). */
export async function loadPdf(blob: Blob) {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
}
