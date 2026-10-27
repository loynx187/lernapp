---
name: kartenpaket
description: Erstellt oder aktualisiert ein Lernapp-Kartenpaket (.lernpaket.json) aus hochgeladenen Vorlesungsunterlagen (PDF-Skripte, Übungsaufgaben, Altklausuren) und arbeitet Meldungen zu fehlerhaften Karten ein. Verwenden, wenn der Nutzer PDFs oder Meldungen hochlädt und Karten/Prüfungsfragen dazu möchte, oder /kartenpaket <Fach> aufruft.
---

# Kartenpaket erstellen

Ziel: gleichbleibend hohe Qualität für alle Fächer. Arbeite **jeden** Schritt ab, auch wenn die Unterlagen klein sind. Kommunikation mit dem Nutzer auf Deutsch.

## 0. Inhalte-Archiv

Unterlagen, Pakete, Fachprofile und Meldungen liegen im **privaten** Repository `loynx187/lernapp-inhalte` (Aufbau: `faecher/<fach-slug>/{profil.md, unterlagen/, pakete/, meldungen/}`).
- Ist es nicht in der Sitzung, hänge es mit `add_repo` an (Zugriff `push`) und klone es nach `/home/user/lernapp-inhalte`. Klappt das nicht, bitte den Nutzer, es freizugeben – ohne Archiv nur weitermachen, wenn er die Vorversion des Pakets selbst hochlädt.
- Unterlagen und Pakete **nur dort** ablegen, **nie** im öffentlichen Repository `lernapp`.

## 1. Auftrag klären

**Auftrag aus der App:** Meist fügt der Nutzer einen Block `lernapp-auftrag` ein (in der App: Prüfung → „Auftrag für Claude kopieren“ bzw. Prüfungen → „Auftrag für alle Prüfungen kopieren“). Er enthält je Prüfung `name`, `slug` (= Ordner im Archiv), `date`, `weight`, das **Fachprofil** (`profile`), welche Felder davon nur unbestätigte Vorschläge von dir sind (`unconfirmed`), die importierten `packages` mit Version und offene Meldungen (`reports`, Aufbau wie `lernapp-meldungen`). Dann gilt:
- Fach, Slug und Prüfungstermin aus dem Auftrag nehmen – nicht nachfragen.
- **Das Fachprofil der App ist maßgeblich.** Vom Nutzer bestätigte Felder (alle in `profile` außer `unconfirmed`) gehen vor Einträgen in `profil.md`; übertrage sie dorthin. Fehlt der Ordner im Archiv, lege ihn mit `profil.md` aus der Vorlage an.
- Paketversionen mit dem Archiv abgleichen. Ist die Version in der App älter als im Archiv, den Nutzer darauf hinweisen (er hat das letzte Update evtl. nicht importiert).
- `lecturesOngoing: true`: Die Vorlesung läuft noch, weitere Unterlagen folgen. Ein Paket pro Vorlesungsblock; den Nutzer nicht auf „fehlende“ Kapitel hinweisen, die erst noch kommen. Wenn der Nutzer ankündigt, dass alle Unterlagen da sind, an den Schalter „Vorlesung läuft noch“ (Prüfung → Bearbeiten) erinnern.
- **Altklausuren/Übungen kommen später** (oft wenige Wochen vor der Klausur): Bestehende Pakete als Update überarbeiten – `relevance` der abgefragten Themen auf 3, `task`-Karten nach dem Muster der Altklausur ergänzen, uids beibehalten – statt ein Doppelpaket anzulegen. Nur Klausurthemen ohne passendes Paket bekommen ein eigenes Paket (z. B. `<fach>-klausurtraining`). Erkenntnisse zu Aufbau und Dauer als `profile`-Vorschlag mitgeben.
- `reports` wie eine Meldungsdatei behandeln: als `meldungen/<Datum>_auftrag.json` ablegen und in Schritt 3 bearbeiten.
- `packages[].deleted`: uids, die der Nutzer in der App gelöscht hat. Diese Karten unverändert im Paket lassen (uid beibehalten; die App hält sie gelöscht) und **keine** inhaltsgleiche Karte mit neuer uid anlegen. Häufen sich Löschungen bei einem Thema, im Profil unter „Weniger wichtig / weglassen“ notieren.
- **Mehrere Prüfungen ohne Unterlagen** (Semesterstart): Für jedes Fach den Archiv-Ordner mit `profil.md` anlegen, gesammelt in **einer** Nachricht nur nach den Angaben fragen, die im Profil fehlen, und danach eine Datei `lernapp-fachprofile` zurückgeben (Format siehe `docs/KARTENPAKET-FORMAT.md`, Dateiname `Fachprofile_<Semester>.json`, per `SendUserFile`). Der Nutzer importiert sie unter „Karten importieren“.
- Mit Unterlagen für mehrere Fächer: Unterlagen den Fächern anhand von Dateinamen und Inhalt zuordnen, im Zweifel nachfragen, dann je Fach die Schritte 1–5.

Ohne Auftrag (nur `/kartenpaket <Fach>`): wie unten; am Ende auf „Auftrag für Claude kopieren“ in der App hinweisen.

- **Fach** aus dem Argument oder der Nachricht; Slug: Kleinbuchstaben, Umlaute ausgeschrieben, Bindestriche (z. B. `technische-mechanik-2`). Lies `faecher/<slug>/profil.md` im Archiv.
  - **Kein Fachprofil vorhanden:** Lege es aus `fachprofil-vorlage.md` (neben diesem Skill) an. Frage den Nutzer gesammelt in einer Nachricht nur, was weder im Auftrag steht noch sich aus den Unterlagen ablesen lässt (Prüfungsform/Dauer, erlaubte Hilfsmittel, Formelsammlung, Hinweise des Dozenten).
- **Neu oder Update?** Prüfe `pakete/` und die Unterlagen-Tabelle im Profil. Gehören die Unterlagen zu einem bestehenden Paket (neue/geänderte Folien desselben Skripts), ist das ein Update: Die Vorversion liegt in `pakete/<paket-id>.lernpaket.json`. Sonst neues Paket – Richtwert: **ein Paket pro Vorlesungsblock bzw. Skriptteil**, nicht ein Riesenpaket pro Fach.
- **Meldungen:** Hat der Nutzer eine Meldungsdatei (`lernapp-meldungen`, aus der App exportiert) hochgeladen, lege sie unter `meldungen/` ab. Jede offene Meldung zu einem Paket dieses Fachs wird in Schritt 3 bearbeitet – auch wenn keine neuen Unterlagen dabei sind.
- Neue Unterlagen nach `faecher/<slug>/unterlagen/` kopieren (sprechende Dateinamen beibehalten).

## 2. Unterlagen erfassen

1. Für jedes PDF: `pdfinfo` (Seitenzahl), dann **alle Seiten ansehen** – mit dem Read-Tool in Blöcken von max. 20 Seiten (`pages`). Diagramme, Formeln, Skizzen und Tabellen stecken oft nur im Bild.
2. Ergänzend `pdftotext -layout` für exakte Zahlen und Formeln.
3. **Foliennummern:** Verwende die auf der Folie gedruckte Nummer, nicht die PDF-Seite. Fehlen Nummern in der Folge (z. B. 16 → 19), dem Nutzer am Ende melden.
4. Lege ein kurzes **Inventar** an (nur für dich): Kapitelstruktur, pro Folie: Inhaltstyp (Definition, Formel, Verfahren, Beispiel, Aufzählung, Merksatz, keine Lerninhalte wie Titel/Agenda/Gruppenarbeit).
5. **Übungsaufgaben und Altklausuren:** Notiere, welche Themen und Aufgabentypen vorkommen – das bestimmt `relevance` und die `task`-Karten.
6. Bei Updates: Vorversion lesen und Folien abgleichen – nur neue/geänderte Folien brauchen neue oder geänderte Karten.

## 3. Karten schreiben

Allgemeine Regeln (gelten für jedes Fach):
- **Atomar:** eine Karte = ein abfragbarer Gedanke. Aufzählungen mit mehr als ~5 Punkten aufteilen oder zusätzlich als Lückentext/MC abfragen.
- **Aktiv abfragen:** Frage so formulieren, dass man die Antwort selbst produzieren muss. Die Antwort darf nicht in der Frage stecken.
- **Abdeckung mit Augenmaß:** jede Folie mit Lerninhalt hat mindestens eine Karte; jede Definition, jede Formel, jeder Merksatz und jedes Verfahren wird abgefragt. Richtwert **1–2 Karten pro Inhaltsfolie** – lieber weniger, dafür prüfungsnahe Karten. Die Lernzeit des Nutzers ist knapp (mehrere Fächer parallel).
- **Typenmix:** `basic` für Verständnis/Erklärungen, `cloze` für Definitionen, Formeln und Merksätze im Wortlaut, `mc` für Abgrenzungen und typische Verwechslungen (plausible Distraktoren aus demselben Stoff), `task` für jedes Rechenverfahren.
- **Rechenaufgaben (`task`):** konkrete Zahlenwerte mit Einheiten, `steps` als nachvollziehbarer Lösungsweg (je Schritt eine Formel + Einsetzen), `result` mit Einheit, in `back` typische Fehler. Für jedes gesuchte Zahlenergebnis einen Eintrag in `answers` (`label`, `value`, `unit`; `tolerance` nur, wenn Rundung/Ablesen mehr als 2 % Abweichung erlaubt). **Jedes Ergebnis mit Python nachrechnen** – `answers.value` ist der ungerundete Wert. Aufgaben aus Übungsblättern/Altklausuren mit leicht geänderten Zahlen übernehmen.
- **Formeln** in LaTeX (`$…$`, `$$…$$`), Einheiten mit `\mathrm{}`; in JSON Backslashes verdoppeln.
- **Bilder** nur wenn nötig (Diagramme, Schaubilder): Ausschnitt mit `pdftoppm` + PIL, JPEG ≤ 60 KB, als Markdown-Bild in `back` (nicht in `front`, wenn es die Antwort verrät).
- **Quelle** bei jeder Karte: `{"file": "<Dateiname>", "slide": <gedruckte Foliennummer>, "page": <Seite im PDF, ab 1>}`. `page` ist wichtig, weil Foliennummer und PDF-Seite oft abweichen (fehlende/zusätzliche Folien); die App öffnet damit die Folie.
- **Relevanz:** 3 = kommt in Altklausuren/Übungen vor oder ist als Kernaussage/Take-away markiert; 2 = normaler Stoff; 1 = Ausblick, Randinfo, Anekdoten.
- **uids:** `k<Kapitel>-f<Folie dreistellig>-<n>`, z. B. `k3-f087-1`. Bei Updates bestehende uids unverändert lassen, nur neue vergeben. Eine fehlerhafte Karte wird **korrigiert, nicht ersetzt** (gleiche uid), damit der Lernfortschritt bleibt; nur wenn sie inhaltlich etwas völlig anderes abfragen soll, neue uid.
- **Aufbauende Reihenfolge:** Karten in Skriptreihenfolge; bei ungeordneten Unterlagen (ganzes Skript, Sammlung) so ordnen, dass Grundlagen vor darauf aufbauenden Themen kommen, und zusammenhängende Themen als eigenes Kapitel bündeln.
- Fachliche Aussagen müssen durch die Unterlagen gedeckt sein. Wo du ergänzt (z. B. Erklärung, Beispielrechnung), muss es fachlich korrekt und klar als Erklärung erkennbar sein.

**Meldungen bearbeiten:** Für jede Meldung die Karte (über `packageId` + `uid`) gegen die Folie prüfen und korrigieren, aufteilen oder – falls unbegründet – unverändert lassen. Jede Meldung bekommt in der Zusammenfassung eine Zeile „geändert / aufgeteilt / unverändert, weil …“.

Dann die **Schwerpunkte aus dem Fachprofil** anwenden (Anteil Rechenaufgaben, Fokus-Themen, Notation, was weggelassen wird).

**Fachprofil-Vorschläge im Paket:** Was du über die Prüfung herausgefunden hast (aus Unterlagen, Altklausuren oder Antworten des Nutzers) und was im Fachprofil der App leer oder `unconfirmed` ist, gehört als `profile` ins Paket (Felder: `form`, `duration` in Minuten, `aids`, `taskShare` = `keine`/`wenig`/`mittel`/`hoch`, `focus`, `omit`, `notation`, `notes`, dazu immer `slug`). Kurz und konkret formulieren – es erscheint so in der App. Die App übernimmt es nur in leere bzw. unbestätigte Felder und markiert es als Vorschlag; bestätigte Angaben des Nutzers überschreibt es nie. Keine Vorlesungsinhalte ins Profil.

Paket-Metadaten: `id` stabil und sprechend (`<fach>-<thema>`), `title` „<Fach> – <Unterlage>“, `module` = Prüfungsname, `version` (neu: 1; Update: Vorversion + 1), `chapters` in Skriptreihenfolge.

## 4. Prüfen

1. `npm run validate -- <paket.json> --folien <erste>-<letzte>` (bei Updates zusätzlich `--alt <vorherige.json>`). Alle FEHLER beheben, WARNUNGEN prüfen und begründet beheben oder bewusst stehen lassen.
2. **Selbstkontrolle** – gehe die Karten einmal vollständig durch:
   - Stimmt jede Antwort mit der Folie überein? Keine erfundenen Zahlen, Normen oder Namen.
   - Ist jede Frage ohne die Folie eindeutig beantwortbar?
   - MC: genau die richtigen Optionen markiert, Distraktoren eindeutig falsch?
   - Rechenaufgaben nachgerechnet, Einheiten konsistent?
   - Fachprofil-Schwerpunkte umgesetzt, alle Meldungen bearbeitet?
3. Optional bei größeren Paketen: in der App importieren und ein paar Karten im Browser ansehen (Formeln, Bilder).

## 5. Ablegen und übergeben

- Paket nach `faecher/<slug>/pakete/<paket-id>.lernpaket.json` schreiben (überschreibt die Vorversion – die bleibt in der Git-Historie).
- `profil.md` aktualisieren: Angaben aus dem Fachprofil der App, Unterlagen-Tabelle (Datei, Inhalt, Paket-ID, Version) und neue Erkenntnisse (z. B. Klausurschwerpunkte aus Altklausuren, Rückmeldungen).
- Im Archiv committen und pushen (Unterlagen, Paket, Profil, Meldungen).
- Datei zusätzlich mit `SendUserFile` schicken (Dateiname `<Fach>_<Thema>.lernpaket.json`).
- Kurze Zusammenfassung: vorgeschlagene Fachprofil-Angaben (der Nutzer bestätigt sie in der App), Anzahl Karten je Typ und Kapitel, gesetzte Schwerpunkte, fehlende Folien oder unklare Stellen, bei Updates was neu/geändert/entfernt ist, Ergebnis jeder Meldung.
- Import-Hinweis: App → Prüfung → „Paket importieren oder aktualisieren“. Bei mehreren neuen Paketen die Import-Reihenfolge nennen (Vorlesungsreihenfolge): Die App führt neue Karten Paket für Paket in der Reihenfolge des ersten Imports ein (änderbar auf der Prüfungsseite mit ↑/↓), innerhalb eines Pakets in `order`-Reihenfolge – auch bei Rückstand; gemischt wird erst in den letzten 14 Tagen. Gemeldete Karten, die geändert wurden, gelten danach in der App automatisch als erledigt.
