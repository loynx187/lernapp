# Lernapp – Hinweise für Claude

Lern-PWA für die Prüfungsvorbereitung (Maschinenbau, DHBW). Sprache der App und aller Inhalte: **Deutsch**.

## Architektur
- Vite + React + TypeScript, PWA via `vite-plugin-pwa`, gehostet auf GitHub Pages unter `/lernapp/` (`.github/workflows/deploy.yml`).
- **Local-first, kein eigener Server.** Daten in IndexedDB (Dexie, `src/lib/db.ts`).
- Sync über die Dropbox des Nutzers (OAuth PKCE, App-Ordner): `src/lib/dropbox.ts` (API), `src/lib/sync.ts` (Zusammenführen: neuerer Datensatz gewinnt per `updatedAt`, Bewertungen werden vereinigt, Löschungen über Tombstones), `src/lib/syncService.ts` (Ablauf, `Erinnerung.txt` für die Kurzbefehle-Erinnerung). App-Schlüssel per `VITE_DROPBOX_APP_KEY` (`.env`). `updatedAt` setzen Dexie-Hooks automatisch – nie von Hand pflegen.
- Wiederholungsalgorithmus: FSRS (`ts-fsrs`) in `src/lib/scheduler.ts`; Intervalle werden auf die Tage vor der Klausur begrenzt (`capToExam`).
- Tagesplan über alle Prüfungen: `src/lib/planner.ts` (reine Funktionen, getestet). Zwei Modi: `mobile` (Karten) und `desk` (Rechenaufgaben), je eigenes Zeitbudget.
- Datenmodell: Profil → Semester → Prüfung (max. 10/Semester) → Karten. Karten-ID: `${examId}:${packageId}:${uid}`.

## Versionen und Änderungen
- `main` ist geschützt und entspricht der veröffentlichten App. **Nie direkt auf `main` pushen.** Änderungen auf einem eigenen Branch entwickeln und als Pull Request einreichen. Eigene Pull Requests mergt Claude selbst, sobald der Workflow `Tests` grün ist und es keine Konflikte gibt (Merge-Commit, kein Squash/Rebase). Pull Requests von anderen (externe Änderungen) übernimmt nur der Nutzer. Der Merge auf `main` veröffentlicht die App automatisch.
- Jede Veröffentlichung bekommt eine neue Versionsnummer in `package.json` (`package-lock.json` mitziehen) und einen Eintrag unter „Versionen“ in `README.md`: Fehlerbehebung → 1.0.1, neue Funktion → 1.1.0, grundlegende Umbauten → 2.0.0. Der Workflow `Tests` prüft das (`scripts/check-version.mjs`): Ändert ein Pull Request die App (`src/`, `public/`, `index.html`, `vite.config.ts`, Abhängigkeiten), muss die Version steigen. Build-Nummer und Datum setzt die Veröffentlichung automatisch. Release/Tag `v<Version>` legt der Nutzer auf GitHub an.

## Befehle
- `npm test` – Unit-Tests (Vitest, `src/**/*.test.ts`)
- `npm run test:e2e` – Browser-Tests (Playwright, `e2e/`) gegen den Produktions-Build; laufen auch in GitHub Actions vor jeder Veröffentlichung. Dropbox wird darin simuliert (`e2e/helpers.ts`). Neue Funktionen bekommen einen Browser-Test. Testdateien nur unter Pfaden ohne Umlaute anlegen (Chromium wählt sie sonst nicht aus).
- `npm run build` – Typprüfung + Build
- `npm run dev` – Entwicklungsserver unter http://localhost:5173/lernapp/
- `npm run validate -- <paket.json> [--alt <alt.json>] [--folien 1-25]` – Kartenpaket prüfen

## FSRS-Parameter optimieren
Wenn der Nutzer eine Sicherung hochlädt und persönliche FSRS-Parameter möchte: `pip install "fsrs[optimizer]"` (in einer venv im Scratchpad), dann `python scripts/optimize-fsrs.py <sicherung.json>`. Die ausgegebene Zahlenreihe dem Nutzer schicken – er fügt sie in der App unter Einstellungen → Lernalgorithmus ein. Sicherungen enthalten Lerndaten: nicht committen.

## Kartenpakete aus Vorlesungsunterlagen erstellen
**Immer nach dem Skill `.claude/skills/kartenpaket/SKILL.md` vorgehen** (auch ohne `/kartenpaket`-Aufruf, sobald PDFs für Karten hochgeladen werden). Unterlagen, Pakete, Fachprofile und Meldungen liegen im privaten Repository `loynx187/lernapp-inhalte` (`faecher/<fach>/…`).
Meist schickt der Nutzer dazu einen **Auftrag aus der App** (`lernapp-auftrag`: Prüfungen, Fachprofil, Paketstände, offene Meldungen; erzeugt in `src/lib/profile.ts`). Das Fachprofil der App ist maßgeblich; Vorschläge gehen als `profile` im Paket oder als `lernapp-fachprofile`-Datei zurück.
Format: `docs/KARTENPAKET-FORMAT.md`. Beispiel: `public/beispiel-paket.json`.

- **Unterlagen (PDFs), Pakete und Fachprofile nie in dieses Repository committen** – es ist öffentlich und die Inhalte sind urheberrechtlich geschützt. Sie gehören ins private Archiv; Pakete zusätzlich als Datei an den Nutzer übergeben.
