// Prüft in Pull Requests: Ändert sich die App selbst, muss die Versionsnummer in package.json steigen.
// Aufruf: node scripts/check-version.mjs <Basis-Ref>, z. B. origin/main
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const base = process.argv[2] ?? 'origin/main'
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

// Was die ausgelieferte App verändert. Doku, Tests, Skripte und Claude-Hinweise brauchen keine neue Version.
const APP_FILES = /^(src\/(?!.*\.test\.ts$)|public\/|index\.html$|vite\.config\.ts$|package\.json$|package-lock\.json$)/

const changed = sh(`git diff --name-only ${base}...HEAD`).split('\n').filter(Boolean)
const appChanges = changed.filter((f) => APP_FILES.test(f))
const current = JSON.parse(readFileSync('package.json', 'utf8')).version
const previous = JSON.parse(sh(`git show ${base}:package.json`)).version

const parse = (v) => v.split('.').map(Number)
const newer = (a, b) => {
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

if (!appChanges.length) {
  console.log(`Keine Änderung an der App – Version bleibt ${current}.`)
} else if (newer(current, previous)) {
  console.log(`App geändert, Version ${previous} → ${current}.`)
} else {
  console.error(`App geändert (${appChanges.join(', ')}), aber die Version ist noch ${current}.`)
  console.error('Bitte in package.json erhöhen: Fehlerbehebung → x.y.(z+1), neue Funktion → x.(y+1).0, Umbau → (x+1).0.0 – und in README.md unter „Versionen“ eintragen.')
  process.exit(1)
}
