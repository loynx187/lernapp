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

## Kartenpakete aus Vorlesungsunterlagen erstellen
Format: `docs/KARTENPAKET-FORMAT.md`. Beispiel: `public/beispiel-paket.json`.

- **Unterlagen (PDFs) und daraus erzeugte Pakete nie committen** – das Repository ist öffentlich und die Inhalte sind urheberrechtlich geschützt. Pakete als Datei an den Nutzer übergeben.
- Folien sowohl als Text als auch als Bild auswerten (Diagramme, Formeln, Skizzen).
- Etwa 60 % der Fächer sind rechenlastig: zu jedem Rechenverfahren `task`-Karten mit Zahlenwerten, Lösungsschritten und Ergebnis anlegen; Formeln/Definitionen als `basic`/`cloze`.
- Übungsaufgaben und Altklausuren nutzen: daraus `task`-Karten ableiten und `relevance` (1–3) der zugehörigen Themen setzen.
- Jede Karte mit `source` (Datei + Foliennummer) versehen.
- `uid`s stabil halten (Schema z. B. `k3-f087-1` = Kapitel 3, Folie 87, Karte 1). Bei Updates bestehende uids beibehalten, nur neue hinzufügen, `version` erhöhen.
- Karten atomar halten (eine Frage, eine Antwort), Formeln in LaTeX.
