// Fasst mehrere Kartenpakete zu einer Paket-Sammlung zusammen (ein Import in der App).
// Aufruf: node scripts/build-sammlung.ts --out <datei.lernsammlung.json> <paket.json> [<slug>=<paket.json> …]
// Ohne `<slug>=` wird der Slug aus dem Archivpfad faecher/<slug>/pakete/… gelesen.
import { readFileSync, writeFileSync } from 'node:fs'
import { parsePackage, slugify, type CardPackage } from '../src/lib/package-format.ts'

const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const out = outIndex >= 0 ? args[outIndex + 1] : undefined
const inputs = args.filter((_, i) => i !== outIndex && i !== outIndex + 1)
if (!out || !inputs.length) {
  console.error('Aufruf: node scripts/build-sammlung.ts --out <datei.lernsammlung.json> <paket.json> [<slug>=<paket.json> …]')
  process.exit(2)
}

const exams = new Map<string, CardPackage[]>()
for (const input of inputs) {
  const [given, file] = input.includes('=') ? input.split('=', 2) : [undefined, input]
  const slug = given ?? file.match(/faecher\/([^/]+)\/pakete\//)?.[1]
  if (!slug) {
    console.error(`FEHLER: Slug für ${file} unbekannt – als <slug>=${file} angeben.`)
    process.exit(1)
  }
  let pkg: CardPackage
  try {
    pkg = parsePackage(JSON.parse(readFileSync(file, 'utf8')))
  } catch (e) {
    console.error(`FEHLER in ${file}: ${(e as Error).message}`)
    process.exit(1)
  }
  const list = exams.get(slugify(slug)) ?? []
  if (list.some((p) => p.id === pkg.id)) {
    console.error(`FEHLER: Paket ${pkg.id} doppelt.`)
    process.exit(1)
  }
  exams.set(slugify(slug), [...list, pkg])
}

const bundle = {
  format: 'lernapp-sammlung',
  formatVersion: 1,
  created: new Date().toISOString().slice(0, 10),
  exams: [...exams].map(([slug, packages]) => ({ slug, packages })),
}
writeFileSync(out, JSON.stringify(bundle, null, 1))
for (const [slug, packages] of exams) for (const p of packages) console.log(`${slug}: ${p.title} (${p.id}, Version ${p.version}, ${p.cards.length} Karten)`)
console.log(`\n${out}: ${exams.size} Prüfungen, ${[...exams.values()].flat().length} Pakete`)
