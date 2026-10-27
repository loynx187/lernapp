// Prüft ein Kartenpaket vor der Übergabe an den Nutzer.
// Aufruf: node scripts/validate-paket.ts <paket.json> [--alt <vorherige-version.json>] [--folien 1-25]
import { readFileSync } from 'node:fs'
import { parsePackage, type CardPackage } from '../src/lib/package-format.ts'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!file) {
  console.error('Aufruf: node scripts/validate-paket.ts <paket.json> [--alt <alt.json>] [--folien 1-25]')
  process.exit(2)
}

const load = (f: string): CardPackage => parsePackage(JSON.parse(readFileSync(f, 'utf8')))
const errors: string[] = []
const warnings: string[] = []

let pkg: CardPackage
try {
  pkg = load(file)
} catch (e) {
  console.error(`FEHLER: ${(e as Error).message}`)
  process.exit(1)
}

const count = <T extends string | number>(xs: T[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<T, number>())
const chapters = new Map((pkg.chapters ?? []).map((c) => [c.id, c.title]))
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const fronts = new Map<string, string>()
for (const c of pkg.cards) {
  const where = `Karte ${c.uid}`
  if (!c.source?.file || c.source.slide === undefined) warnings.push(`${where}: keine vollständige Quelle (Datei + Folie).`)
  if (c.chapter && !chapters.has(c.chapter)) errors.push(`${where}: unbekanntes Kapitel „${c.chapter}“.`)
  if (!c.chapter && chapters.size) warnings.push(`${where}: keinem Kapitel zugeordnet.`)
  if (c.type === 'cloze' && !/\{\{[\s\S]+?\}\}/.test(c.front)) errors.push(`${where}: Lückentext ohne {{…}}.`)
  if (c.type === 'task' && (!c.steps?.length || !c.result)) errors.push(`${where}: Rechenaufgabe ohne Lösungsschritte oder Ergebnis.`)
  if (c.type === 'task' && !c.answers?.length) warnings.push(`${where}: Rechenaufgabe ohne answers – keine automatische Ergebnisprüfung.`)
  if (c.type === 'basic' && !c.back.trim()) errors.push(`${where}: Antwort fehlt.`)
  const answer = c.back.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  if (answer.length > 700) warnings.push(`${where}: Antwort sehr lang (${answer.length} Zeichen) – aufteilen?`)
  if (c.front.length > 400 && c.type !== 'task') warnings.push(`${where}: Frage sehr lang – Karte atomarer formulieren?`)
  const images = [c.image, ...(c.back.match(/data:image\/[^)"]+/g) ?? [])].filter(Boolean) as string[]
  for (const img of images) if (img.length > 200_000) warnings.push(`${where}: Bild größer als ca. 150 KB – verkleinern.`)
  const key = norm(c.front)
  if (fronts.has(key)) warnings.push(`${where}: gleiche Frage wie ${fronts.get(key)}.`)
  else fronts.set(key, c.uid)
  if (!/^k\d+-f\d{3}-\d+$/.test(c.uid)) warnings.push(`${where}: uid folgt nicht dem Schema k<Kapitel>-f<Folie>-<n>.`)
}
const noPage = pkg.cards.filter((c) => c.source && c.source.page === undefined).length
if (noPage) warnings.push(`${noPage} Karten ohne source.page – „Folie ansehen“ nutzt dann die Foliennummer als PDF-Seite.`)
const used = count(pkg.cards.map((c) => c.chapter ?? ''))
for (const [id, title] of chapters) if (!used.has(id)) warnings.push(`Kapitel „${title}“ hat keine Karten.`)

const range = opt('--folien')
if (range) {
  const [from, to] = range.split('-').map(Number)
  const covered = new Set(pkg.cards.map((c) => Number(c.source?.slide)))
  const missing = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((n) => !covered.has(n))
  if (missing.length) warnings.push(`Folien ohne Karte: ${missing.join(', ')} (Titel-/Agenda-/Gruppenarbeitsfolien sind ok).`)
}

const altFile = opt('--alt')
if (altFile) {
  const alt = load(altFile)
  if (alt.id !== pkg.id) errors.push(`Paket-ID „${pkg.id}“ weicht von der Vorversion „${alt.id}“ ab – Fortschritt ginge verloren.`)
  if (pkg.version <= alt.version) errors.push(`Version ${pkg.version} muss größer sein als ${alt.version}.`)
  const now = new Set(pkg.cards.map((c) => c.uid))
  const before = new Set(alt.cards.map((c) => c.uid))
  const removed = [...before].filter((u) => !now.has(u))
  const added = [...now].filter((u) => !before.has(u))
  console.log(`Update: ${added.length} neu, ${removed.length} entfernt, ${pkg.cards.length - added.length} beibehalten.`)
  if (removed.length) warnings.push(`Entfernte uids (werden archiviert): ${removed.join(', ')}`)
}

console.log(`\n${pkg.title} (id ${pkg.id}, Version ${pkg.version})`)
console.log(`${pkg.cards.length} Karten · ${chapters.size} Kapitel`)
console.log('Typen:', Object.fromEntries(count(pkg.cards.map((c) => c.type))))
console.log('Relevanz:', Object.fromEntries(count(pkg.cards.map((c) => c.relevance ?? 2))))
for (const [id, title] of chapters) console.log(`  ${title}: ${used.get(id) ?? 0}`)
for (const w of warnings) console.log(`WARNUNG: ${w}`)
for (const e of errors) console.log(`FEHLER: ${e}`)
console.log(errors.length ? '\n✗ Paket fehlerhaft' : '\n✓ Paket gültig')
process.exit(errors.length ? 1 : 0)
