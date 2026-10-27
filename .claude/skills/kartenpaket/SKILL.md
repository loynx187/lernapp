---
name: kartenpaket
description: Erstellt oder aktualisiert ein Lernapp-Kartenpaket (.lernpaket.json) aus hochgeladenen Vorlesungsunterlagen (PDF-Skripte, Übungsaufgaben, Altklausuren). Verwenden, wenn der Nutzer PDFs hochlädt und Karten/Prüfungsfragen dazu möchte, oder /kartenpaket <Fach> aufruft.
---

# Kartenpaket erstellen

Ziel: gleichbleibend hohe Qualität für alle Fächer. Arbeite **jeden** Schritt ab, auch wenn die Unterlagen klein sind. Kommunikation mit dem Nutzer auf Deutsch.

## 1. Auftrag klären

- **Fach** aus dem Argument oder der Nachricht. Lies `faecher/<fach-slug>.md` (Slug: Kleinbuchstaben, Umlaute ausgeschrieben, Bindestriche, z. B. `technische-mechanik-2`).
  - **Kein Fachprofil vorhanden:** Lege es aus `faecher/_vorlage.md` an. Frage den Nutzer gesammelt in einer Nachricht nur das, was sich nicht aus den Unterlagen ablesen lässt (Prüfungsform/Dauer, erlaubte Hilfsmittel, Formelsammlung, besondere Hinweise des Dozenten). Trage die Antworten ein und committe das Profil.
- **Neu oder Update?** Gibt es schon ein Paket für diese Unterlagen, brauchst du die **vorherige Paketdatei**, sonst gehen uids und damit der Lernfortschritt verloren. Bitte den Nutzer, sie hochzuladen (in der App: Prüfung → Kartenpakete → „Teilen“ → Datei sichern).
- Unterlagen und Pakete **nie committen** (öffentliches Repository, Urheberrecht). Arbeitsdateien nur im Scratchpad.

## 2. Unterlagen erfassen

1. Für jedes PDF: `pdfinfo` (Seitenzahl), dann **alle Seiten ansehen** – mit dem Read-Tool in Blöcken von max. 20 Seiten (`pages`). Diagramme, Formeln, Skizzen und Tabellen stecken oft nur im Bild.
2. Ergänzend `pdftotext -layout` für exakte Zahlen und Formeln.
3. **Foliennummern:** Verwende die auf der Folie gedruckte Nummer, nicht die PDF-Seite. Fehlen Nummern in der Folge (z. B. 16 → 19), dem Nutzer am Ende melden.
4. Lege ein kurzes **Inventar** an (nur für dich): Kapitelstruktur, pro Folie: Inhaltstyp (Definition, Formel, Verfahren, Beispiel, Aufzählung, Merksatz, keine Lerninhalte wie Titel/Agenda/Gruppenarbeit).
5. **Übungsaufgaben und Altklausuren:** Notiere, welche Themen und Aufgabentypen vorkommen – das bestimmt `relevance` und die `task`-Karten.

## 3. Karten schreiben

Allgemeine Regeln (gelten für jedes Fach):
- **Atomar:** eine Karte = ein abfragbarer Gedanke. Aufzählungen mit mehr als ~5 Punkten aufteilen oder zusätzlich als Lückentext/MC abfragen.
- **Aktiv abfragen:** Frage so formulieren, dass man die Antwort selbst produzieren muss. Die Antwort darf nicht in der Frage stecken.
- **Abdeckung:** jede Folie mit Lerninhalt hat mindestens eine Karte; jede Definition, jede Formel, jeder Merksatz und jedes Verfahren wird abgefragt. Richtwert: 1–3 Karten pro Inhaltsfolie.
- **Typenmix:** `basic` für Verständnis/Erklärungen, `cloze` für Definitionen, Formeln und Merksätze im Wortlaut, `mc` für Abgrenzungen und typische Verwechslungen (plausible Distraktoren aus demselben Stoff), `task` für jedes Rechenverfahren.
- **Rechenaufgaben (`task`):** konkrete Zahlenwerte mit Einheiten, `steps` als nachvollziehbarer Lösungsweg (je Schritt eine Formel + Einsetzen), `result` mit Einheit, in `back` typische Fehler. **Jedes Ergebnis mit Python nachrechnen.** Aufgaben aus Übungsblättern/Altklausuren mit leicht geänderten Zahlen übernehmen.
- **Formeln** in LaTeX (`$…$`, `$$…$$`), Einheiten mit `\mathrm{}`; in JSON Backslashes verdoppeln.
- **Bilder** nur wenn nötig (Diagramme, Schaubilder): Ausschnitt mit `pdftoppm` + PIL, JPEG ≤ 60 KB, als Markdown-Bild in `back` (nicht in `front`, wenn es die Antwort verrät).
- **Quelle** bei jeder Karte: `{"file": "<Dateiname>", "slide": <gedruckte Foliennummer>}`.
- **Relevanz:** 3 = kommt in Altklausuren/Übungen vor oder ist als Kernaussage/Take-away markiert; 2 = normaler Stoff; 1 = Ausblick, Randinfo, Anekdoten.
- **uids:** `k<Kapitel>-f<Folie dreistellig>-<n>`, z. B. `k3-f087-1`. Bei Updates bestehende uids unverändert lassen, nur neue vergeben.
- Fachliche Aussagen müssen durch die Unterlagen gedeckt sein. Wo du ergänzt (z. B. Erklärung, Beispielrechnung), muss es fachlich korrekt und klar als Erklärung erkennbar sein.

Dann die **Schwerpunkte aus dem Fachprofil** anwenden (Anteil Rechenaufgaben, Fokus-Themen, Notation, was weggelassen wird).

Paket-Metadaten: `id` stabil und sprechend (`<fach>-<thema>`), `title` „<Fach> – <Unterlage>“, `module` = Prüfungsname, `version` (neu: 1; Update: Vorversion + 1), `chapters` in Skriptreihenfolge.

## 4. Prüfen

1. `npm run validate -- <paket.json> --folien <erste>-<letzte>` (bei Updates zusätzlich `--alt <vorherige.json>`). Alle FEHLER beheben, WARNUNGEN prüfen und begründet beheben oder bewusst stehen lassen.
2. **Selbstkontrolle** – gehe die Karten einmal vollständig durch:
   - Stimmt jede Antwort mit der Folie überein? Keine erfundenen Zahlen, Normen oder Namen.
   - Ist jede Frage ohne die Folie eindeutig beantwortbar?
   - MC: genau die richtigen Optionen markiert, Distraktoren eindeutig falsch?
   - Rechenaufgaben nachgerechnet, Einheiten konsistent?
   - Fachprofil-Schwerpunkte umgesetzt?
3. Optional bei größeren Paketen: in der App importieren und ein paar Karten im Browser ansehen (Formeln, Bilder).

## 5. Übergeben

- Datei im Scratchpad als `<Fach>_<Thema>.lernpaket.json` speichern und mit `SendUserFile` schicken.
- Kurze Zusammenfassung: Anzahl Karten je Typ und Kapitel, gesetzte Schwerpunkte, fehlende Folien oder unklare Stellen, bei Updates was neu/geändert/entfernt ist.
- Import-Hinweis: App → Prüfung → „Paket importieren oder aktualisieren“.
- Neue Erkenntnisse zum Fach (z. B. Klausurschwerpunkte aus Altklausuren) ins Fachprofil übernehmen und committen.
