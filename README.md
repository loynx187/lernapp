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

- **1.15.0** – Neuer Kartentyp „Zuordnen“ (`match`): zu jedem Begriff den passenden Eintrag aus einer gemischten Liste wählen, z. B. Norm → Aufgabe oder Abkürzung → Bedeutung; automatische Auswertung in Lernsitzung und Probeklausur.
- **1.14.0** – Prüfungsseite übersichtlicher: Bei vielen Kapiteln zeigt die Liste nur Schwachstellen und die nächsten offenen Kapitel („Alle Kapitel anzeigen“ klappt den Rest auf); Erklärungen zur Prognose, das Eintragen fehlender Unterlagen und die Claude-Anleitung sind einklappbar. Auf dem iPad zweispaltig: Lernen links, Karten, Hausaufgaben, Unterlagen und Pakete rechts. Kennzahlen klarer: Die Prognose nennt die Zielsicherheit („Ziel 90 %“), „aktuell abrufbar“ erscheint erst ab 10 begonnenen Karten.
- **1.13.1** – Feinschliff nach Layout-Prüfung: Formeln in der Kartenliste lesbar (z. B. x², cos φ, a/b statt verstümmelter Zeichen); Zähler „3/7“ in der Lernsitzung; Eingabefeld für fehlende Unterlagen wie alle anderen Felder gestaltet, „jede Woche“ statt „alle Woche“, fällige Erinnerungen als „jetzt fällig“ statt rotem Fließtext; größere Tippflächen für Pause/Play bei den Kapiteln und für Häkchen; Hausaufgaben-Widget „bis Mi.“ statt abgeschnittenem Text; Semesterart in den Einstellungen nicht mehr abgeschnitten; Übungsknöpfe auf der Prüfungsseite gleich hoch.
- **1.13.0** – Korrekturen von Kommilitonen übernehmen: Beim Import einer Vorlage in ein bestehendes Profil zeigt die Vorschau, welche Pakete neuer, gleich oder älter sind. Neuere Pakete korrigieren geänderte Karten (Lernfortschritt bleibt), ältere werden nicht übernommen, und Karten, die beim Absender fehlen, bleiben erhalten. Prüfungen werden über den Namen (oder Fach-Slug) gefunden, auch wenn das Semester anders heißt.
- **1.12.0** – Vorlage: offene Meldungen zu Karten werden mit exportiert und beim Übernehmen angelegt (die gemeldeten Karten bleiben auch bei Kommilitonen pausiert, bis ein Paket-Update sie korrigiert).
- **1.11.0** – Vorlage ohne Lernfortschritt: Einstellungen → „Vorlage exportieren“ speichert alle Semester, Prüfungen (Termin, Fachprofil, offene Erinnerungen, pausierte Kapitel) und Kartenpakete in einer Datei (`lernapp-vorlage`) – ohne Lernstand, Bewertungen, Hausaufgaben und Einstellungen. Kommilitonen übernehmen sie in einem Schritt beim ersten Start („Vorlage von Kommilitonen übernehmen“) – Profil, Semester, Prüfungen und Karten sind dann eingerichtet; in einem bestehenden Profil unter „Karten importieren“ (gleichnamige Prüfungen werden ergänzt).
- **1.10.2** – Kapitel pausieren und fortsetzen: Pause- und Play-Schaltfläche sind schlichte Symbole statt Emojis.
- **1.10.1** – Startseite: Widgets schneiden ihren Inhalt nicht mehr ab (z. B. „Budget zu knapp“ oder den Hinweis unter „Unterlagen fehlen“ auf dem iPad). Sie bleiben mindestens quadratisch und wachsen bei Bedarf mit; Wiederholungen und neue Karten stehen kompakt in einer Zeile.
- **1.10.0** – Wiederkehrende Erinnerungen an Unterlagen (z. B. wöchentliches Übungsblatt): „Diesmal erledigt“ springt zum nächsten Termin. Erinnerungen für mehrere Fächer lassen sich mit einer Fachprofil-Datei von Claude anlegen (Feld `pending` je Prüfung, auch ohne Profilangaben).
- **1.9.0** – Erinnerungen an fehlende Unterlagen (z. B. Altklausuren): auf der Prüfungsseite eintragen oder von Claude über das Kartenpaket anlegen lassen; die Startseite und die Dropbox-Erinnerung erinnern, bis abgehakt („Später“ = eine Woche). Kapitel pausieren: Ein ganzes Skript lässt sich auf einmal importieren, Kapitel, die in der Vorlesung noch nicht dran waren, werden pausiert (neue Karten kommen erst nach dem Fortsetzen, zählen nicht zum Fortschritt). Neue Paketfelder `pending` und `chapters[].later`.
- **1.8.0** – Karteikarten sind Pflicht, Schreibtischaufgaben Zusatz: Fortschritt, Prognose und Rückstand zählen nur Karten; Aufgaben müssen nicht alle bis zur Klausur geschafft sein. Am Schreibtisch empfiehlt die App Aufgaben – aus Probe-/Altklausuren zuerst, dann zu Themen, deren Karten du oft vergisst (Begründung über der Aufgabe); neue Paketfelder `topics` und `pastExam`. Empfohlenes Fach ist das, in dem pro Tag am meisten neuer Stoff nötig ist, statt das mit den meisten Wiederholungen. Das Tagesbudget passt sich an die gemessene Lernzeit an (abschaltbar); Hausaufgaben behalten ihre feste Zeit bis zur Abgabe.
- **1.7.0** – Neues Fortschritts-Widget auf der Startseite: Statt eines Rings zeigt es für jede Prüfung den begonnenen Anteil (Balken) und die Prognose für den Klausurtag (grüne Marke), dazu Countdown und Rückstand; bei bis zu drei Prüfungen auch begonnene und sichere Karten. Ersetzt die bisherigen Kacheln „Fortschritt“ und „Prüfungen“. Behoben: ein Browser-Test verhinderte die Veröffentlichung von 1.6.0.
- **1.6.0** – Hausaufgaben direkt auf der Startseite eintragen (Widget „Hausaufgaben“ → „Eintragen“, auch wenn noch keine offen ist). Einstellungen und Hilfe sind keine Kacheln mehr, sondern dezente Symbole oben rechts.
- **1.5.1** – Übersichtlichere Startseite: Statt einer Kachel pro Fach führt das Widget „Unterwegs“ bzw. „Schreibtisch“ bei mehreren Fächern zu einer Auswahl mit „Alle Fächer“ und den einzelnen Fächern; die Empfehlung steht schon im Widget. Behoben: Ein fehlerhafter Test verhinderte die Veröffentlichung von 1.5.0.
- **1.5.0** – Hausaufgaben: mit Abgabetermin, Dauer und Foto des Aufgabenblatts anlegen (Prüfungsseite → „Hausaufgabe hinzufügen“). Ihr Zeitbedarf wird bis zur Abgabe auf die Tage verteilt und geht vom Schreibtisch-Budget ab; ab drei Tagen vor der Abgabe erscheinen sie in der Schreibtisch-Sitzung vor den Karten. Noch nicht fällige lassen sich jederzeit vorziehen. Beim Abhaken optional Lösung notieren/fotografieren und die Hausaufgabe als Übungsaufgabe in die Wiederholung übernehmen. Synchronisiert über Dropbox und in Sicherungen enthalten.
- **1.4.0** – Lernen nach Fach: Die Startseite zeigt das heutige Pensum je Prüfung mit eigenem Start für Unterwegs und Schreibtisch; das Fach mit Rückstand bzw. dem meisten offenen Pensum ist als „Empfohlen“ markiert. Nach einer Fach-Sitzung wird das nächste Fach angeboten. „Alle Fächer“ bleibt möglich.
- **1.3.1** – Gemeldete Karten lassen sich in der Lernsitzung ohne Bewertung überspringen und sind pausiert, bis die Meldung erledigt ist (Paket-Update oder abgehakt). Eine fehlerhafte Karte verfälscht so nicht mehr den Lernplan.
- **1.3.0** – Aufgaben können statt Zahlen auch Textantworten prüfen (z. B. Hexadezimalzahl, Ausgangsspalte einer Wahrheitstabelle, SCL-Schlüsselwort; Groß-/Kleinschreibung und Leerzeichen zählen nicht). Code-Blöcke (z. B. SCL) erscheinen in fester Schrift mit Einrückung; Lückentexte funktionieren auch im Code.
- **1.2.0** – Neue Seite „Karten und Meldungen“ je Prüfung: alle Karten in Lernreihenfolge nachlesen, durchsuchen, melden, löschen und wiederherstellen; offene Meldungen dort abhaken und exportieren. Reihenfolge der Kartenpakete auf der Prüfungsseite mit ↑/↓ änderbar. Neue Karten bleiben auch bei Rückstand chronologisch (nur Zusatzstoff kommt nach hinten); erst in den letzten 14 Tagen wird gemischt. Karten aus anderen Tools importieren (ChatGPT, NotebookLM, Anki, Quizlet, CSV, Markdown-Tabellen, JSON) samt Vorlage für andere KI-Tools; `## Überschriften` werden Kapitel, ein erneuter Import mit gleichem Titel aktualisiert das Paket.
- **1.1.1** – Neue Karten kommen Paket für Paket (in der Reihenfolge des ersten Imports, also Vorlesungsblock für Vorlesungsblock); in den letzten 14 Tagen vor der Klausur werden die Pakete gemischt und klausurrelevante Karten vorgezogen. Wiederholungen bleiben wie bisher gemischt. Behoben: Die Kapitelübersicht fasste gleich benannte Kapitel verschiedener Pakete zusammen.
- **1.1.0** – Einzelne Karten in der Lernsitzung löschen (Papierkorb); gelöschte Karten bleiben auch nach Paket-Updates gelöscht, lassen sich auf der Prüfungsseite mit Lernfortschritt wiederherstellen und stehen im Auftrag für Claude. Behoben: eine verirrte „0“ auf der Prüfungsseite.
- **1.0.1** – Einstellungen zeigen neben der Version die Build-Nummer und das Datum der Veröffentlichung; Pull Requests prüfen automatisch, ob die Versionsnummer erhöht wurde.
- **1.0.0** – erster finaler Stand: Lernplan mit FSRS, Semesterarten und laufender Vorlesung, Dropbox-Sync mit Wochensicherungen, Probeklausur (übersteht App-Wechsel), Fachprofile und Aufträge für Claude, Widget, Lerntag ab 4:00 Uhr, Updates nie während einer Sitzung, Fehlerseite mit Sicherung.
