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

- **1.4.0** – Lernen nach Fach: Die Startseite zeigt das heutige Pensum je Prüfung mit eigenem Start für Unterwegs und Schreibtisch; das Fach mit Rückstand bzw. dem meisten offenen Pensum ist als „Empfohlen“ markiert. Nach einer Fach-Sitzung wird das nächste Fach angeboten. „Alle Fächer“ bleibt möglich.
- **1.3.1** – Gemeldete Karten lassen sich in der Lernsitzung ohne Bewertung überspringen und sind pausiert, bis die Meldung erledigt ist (Paket-Update oder abgehakt). Eine fehlerhafte Karte verfälscht so nicht mehr den Lernplan.
- **1.3.0** – Aufgaben können statt Zahlen auch Textantworten prüfen (z. B. Hexadezimalzahl, Ausgangsspalte einer Wahrheitstabelle, SCL-Schlüsselwort; Groß-/Kleinschreibung und Leerzeichen zählen nicht). Code-Blöcke (z. B. SCL) erscheinen in fester Schrift mit Einrückung; Lückentexte funktionieren auch im Code.
- **1.2.0** – Neue Seite „Karten und Meldungen“ je Prüfung: alle Karten in Lernreihenfolge nachlesen, durchsuchen, melden, löschen und wiederherstellen; offene Meldungen dort abhaken und exportieren. Reihenfolge der Kartenpakete auf der Prüfungsseite mit ↑/↓ änderbar. Neue Karten bleiben auch bei Rückstand chronologisch (nur Zusatzstoff kommt nach hinten); erst in den letzten 14 Tagen wird gemischt. Karten aus anderen Tools importieren (ChatGPT, NotebookLM, Anki, Quizlet, CSV, Markdown-Tabellen, JSON) samt Vorlage für andere KI-Tools; `## Überschriften` werden Kapitel, ein erneuter Import mit gleichem Titel aktualisiert das Paket.
- **1.1.1** – Neue Karten kommen Paket für Paket (in der Reihenfolge des ersten Imports, also Vorlesungsblock für Vorlesungsblock); in den letzten 14 Tagen vor der Klausur werden die Pakete gemischt und klausurrelevante Karten vorgezogen. Wiederholungen bleiben wie bisher gemischt. Behoben: Die Kapitelübersicht fasste gleich benannte Kapitel verschiedener Pakete zusammen.
- **1.1.0** – Einzelne Karten in der Lernsitzung löschen (Papierkorb); gelöschte Karten bleiben auch nach Paket-Updates gelöscht, lassen sich auf der Prüfungsseite mit Lernfortschritt wiederherstellen und stehen im Auftrag für Claude. Behoben: eine verirrte „0“ auf der Prüfungsseite.
- **1.0.1** – Einstellungen zeigen neben der Version die Build-Nummer und das Datum der Veröffentlichung; Pull Requests prüfen automatisch, ob die Versionsnummer erhöht wurde.
- **1.0.0** – erster finaler Stand: Lernplan mit FSRS, Semesterarten und laufender Vorlesung, Dropbox-Sync mit Wochensicherungen, Probeklausur (übersteht App-Wechsel), Fachprofile und Aufträge für Claude, Widget, Lerntag ab 4:00 Uhr, Updates nie während einer Sitzung, Fehlerseite mit Sicherung.
