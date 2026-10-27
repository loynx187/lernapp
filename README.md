# Lernapp

Lern-App für die Prüfungsvorbereitung im Studium – für unterwegs und am Schreibtisch.

- **Lernplan rückwärts vom Klausurtermin:** Neuer Stoff wird automatisch auf die Tage bis zur Klausur verteilt, mehrere Prüfungen parallel.
- **Wissenschaftlich fundiert:** Abrufübung, verteilte Wiederholung mit FSRS, gemischtes Üben.
- **Karteikarten, Lückentexte, Multiple Choice und Rechenaufgaben** mit schrittweisem Lösungsweg und Formeln.
- **Fortschritt pro Prüfung:** begonnen, sicher bis zur Klausur, Schwachstellen pro Kapitel, Verlauf.
- **Profile und Semester** (dual oder regulär), Kartenpakete teilen und aktualisieren, ohne den Fortschritt zu verlieren.
- **Laufende Vorlesung:** Neuer Stoff wird zeitnah nach dem Import begonnen, solange weitere Unterlagen folgen.
- **Probeklausur** mit Zeitlimit und automatischer Auswertung, **Zahlenergebnisse** werden geprüft, **„Folie ansehen“** öffnet die passende Skriptseite.
- **Karten mit Claude erstellen:** Fachprofil je Prüfung, „Auftrag für Claude kopieren“ liefert alles für ein neues oder aktualisiertes Kartenpaket.
- **Deine Daten bleiben bei dir.** Kein Konto, kein Server – optional Abgleich über deine eigene Dropbox, Erinnerung per Kurzbefehl und Homescreen-Widget (Scriptable).

## Nutzung

App öffnen: **https://loynx187.github.io/lernapp/**

- iPhone/iPad: in Safari öffnen → Teilen → „Zum Home-Bildschirm“
- Android: in Chrome öffnen → Menü → „App installieren“

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:5173/lernapp/
npm test          # Unit-Tests
npm run test:e2e  # Browser-Tests (Playwright)
npm run build
```

Kartenformat: [docs/KARTENPAKET-FORMAT.md](docs/KARTENPAKET-FORMAT.md)

## Versionen

- **1.0.1** – Einstellungen zeigen neben der Version die Build-Nummer und das Datum der Veröffentlichung; Pull Requests prüfen automatisch, ob die Versionsnummer erhöht wurde.
- **1.0.0** – erster finaler Stand: Lernplan mit FSRS, Semesterarten und laufender Vorlesung, Dropbox-Sync mit Wochensicherungen, Probeklausur (übersteht App-Wechsel), Fachprofile und Aufträge für Claude, Widget, Lerntag ab 4:00 Uhr, Updates nie während einer Sitzung, Fehlerseite mit Sicherung.
