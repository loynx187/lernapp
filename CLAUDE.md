# Lernapp – Hinweise für Claude

Lern-PWA für die Prüfungsvorbereitung (Maschinenbau, DHBW). Sprache der App und aller Inhalte: **Deutsch**.

## Architektur
- Vite + React + TypeScript, PWA via `vite-plugin-pwa`, gehostet auf GitHub Pages unter `/lernapp/` (`.github/workflows/deploy.yml`).
- **Local-first, kein eigener Server.** Daten in IndexedDB (Dexie, `src/lib/db.ts`). Sync (Dropbox) ist für Phase 2 geplant.
- Wiederholungsalgorithmus: FSRS (`ts-fsrs`) in `src/lib/scheduler.ts`; Intervalle werden auf die Tage vor der Klausur begrenzt (`capToExam`).
- Tagesplan über alle Prüfungen: `src/lib/planner.ts` (reine Funktionen, getestet). Zwei Modi: `mobile` (Karten) und `desk` (Rechenaufgaben), je eigenes Zeitbudget.
- Datenmodell: Profil → Semester → Prüfung (max. 10/Semester) → Karten. Karten-ID: `${examId}:${packageId}:${uid}`.

## Befehle
- `npm test` – Unit-Tests (Vitest)
- `npm run build` – Typprüfung + Build
- `npm run dev` – Entwicklungsserver unter http://localhost:5173/lernapp/

- `npm run validate -- <paket.json> [--alt <alt.json>] [--folien 1-25]` – Kartenpaket prüfen

## Kartenpakete aus Vorlesungsunterlagen erstellen
**Immer nach dem Skill `.claude/skills/kartenpaket/SKILL.md` vorgehen** (auch ohne `/kartenpaket`-Aufruf, sobald PDFs für Karten hochgeladen werden). Fachspezifische Schwerpunkte stehen in `faecher/<fach>.md`.
Format: `docs/KARTENPAKET-FORMAT.md`. Beispiel: `public/beispiel-paket.json`.

- **Unterlagen (PDFs) und daraus erzeugte Pakete nie committen** – das Repository ist öffentlich und die Inhalte sind urheberrechtlich geschützt. Pakete als Datei an den Nutzer übergeben.
