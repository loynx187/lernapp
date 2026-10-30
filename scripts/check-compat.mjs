// Prüft in Pull Requests, ob sich die Änderung mit anderen Entwicklungen (Forks) und vorhandenen Lerndaten verträgt:
// Neue Datenbank-Versionen (db.version) oder geänderte Dateiformate (formatVersion) nur nach Absprache.
// Aufruf: node scripts/check-compat.mjs <Basis-Ref>, z. B. origin/main
// Gewollte Änderung: In einer Commit-Nachricht „Schemaänderung abgestimmt“ vermerken.
import { execSync } from 'node:child_process'

const base = process.argv[2] ?? 'origin/main'
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

const diff = sh(`git diff -U0 ${base}...HEAD -- src ":(exclude)src/**/*.test.ts"`)
const hits = diff.split('\n').filter((l) => /^[+-](?![+-])/.test(l) && /db\.version\(|formatVersion/.test(l))
const agreed = /Schemaänderung abgestimmt/i.test(sh(`git log --format=%B ${base}..HEAD`))

if (!hits.length) {
  console.log('Datenbankschema und Dateiformate unverändert.')
} else if (agreed) {
  console.log('Schema-/Formatänderung als abgestimmt markiert:')
  for (const l of hits) console.log(`  ${l}`)
} else {
  console.error('Datenbankschema oder Dateiformat geändert:')
  for (const l of hits) console.error(`  ${l}`)
  console.error('Das kann Lerndaten gefährden und Änderungen aus anderen Forks unvereinbar machen.')
  console.error('Neue Daten möglichst als optionale Felder ablegen. Ist die Änderung abgesprochen, in einer Commit-Nachricht „Schemaänderung abgestimmt“ vermerken (siehe CONTRIBUTING.md).')
  process.exit(1)
}
