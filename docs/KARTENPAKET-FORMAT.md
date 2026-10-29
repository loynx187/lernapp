# Kartenpaket-Format (`.lernpaket.json`)

Ein Kartenpaket enthält die Karten zu einer Prüfung bzw. einem Skript. Es enthält **keinen** Lernfortschritt und kann deshalb mit Kommilitonen geteilt werden.

```json
{
  "format": "lernapp-paket",
  "formatVersion": 1,
  "id": "tm2-festigkeitslehre",
  "title": "Technische Mechanik II – Festigkeitslehre",
  "module": "Technische Mechanik II",
  "version": 1,
  "created": "2026-10-27",
  "sources": [{ "file": "TM2_Skript.pdf", "pages": 300 }],
  "chapters": [{ "id": "k1", "title": "Zug und Druck" }],
  "profile": { "slug": "technische-mechanik-ii", "form": "schriftlich", "duration": 120, "taskShare": "hoch" },
  "cards": [ ... ]
}
```

| Feld | Bedeutung |
|---|---|
| `id` | Stabile Paket-ID. Gleiche ID = Update desselben Pakets. |
| `version` | Bei jedem Update erhöhen. |
| `chapters` | Reihenfolge der Kapitel = Reihenfolge, in der neuer Stoff eingeführt wird. Mehrere Pakete einer Prüfung kommen nacheinander in der Reihenfolge ihres ersten Imports (auf der Prüfungsseite mit ↑/↓ änderbar); in den letzten 14 Tagen vor der Klausur werden sie gemischt. Zusammenhängende Themen deshalb im selben Kapitel bzw. in aufeinanderfolgenden Kapiteln anordnen. Mit `"later": true` ist ein Kapitel in der Vorlesung noch nicht dran: Die App pausiert es beim ersten Import (seine neuen Karten werden nicht eingeführt und zählen nicht zum Fortschritt), der Nutzer setzt es auf der Prüfungsseite fort. So kann ein ganzes Skript auf einmal importiert werden. |
| `pending` | Optional: noch fehlende Unterlagen, an die die App erinnern soll, z. B. `[{ "id": "altklausuren", "title": "Altklausuren", "note": "kommen im Laufe der Vorlesung", "from": "2026-12-01" }]`. `id` stabil halten – eine abgehakte Erinnerung legt ein Update nicht erneut an. `from` (optional): erst ab diesem Tag erinnern. `repeatDays` (optional): wiederkehrend, z. B. `7` für wöchentliche Übungsblätter – „Erledigt“ verschiebt die Erinnerung zum nächsten Termin im Takt ab `from`. |
| `profile` | Optional: Vorschläge für das Fachprofil der Prüfung (siehe unten). Die App übernimmt sie nur in leere oder noch unbestätigte Felder. |

## Karten

Gemeinsame Felder:

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `uid` | ja | **Stabil und eindeutig im Paket.** Über die uid bleibt der Lernfortschritt bei Updates erhalten. Nie wiederverwenden. |
| `type` | – | `basic` (Standard), `cloze`, `mc`, `match`, `task` |
| `chapter` | – | ID aus `chapters` |
| `front` | ja | Frage / Aufgabenstellung |
| `back` | – | Antwort bzw. Erklärung |
| `source` | – | `{ "file": "Skript.pdf", "slide": 42, "page": 40 }` – `slide` = gedruckte Foliennummer, `page` = Seite im PDF (für „Folie ansehen“; fehlt sie, wird `slide` verwendet) |
| `relevance` | – | 1–3, Klausurrelevanz (z. B. aus Altklausuren). Bei Zeitnot werden relevante Karten zuerst eingeführt. |
| `tags` | – | Liste von Schlagwörtern |
| `topics` | – | Themen-Schlagworte (z. B. `["Schwingungsisolierung"]`). Verknüpfen Rechenaufgaben mit Karten desselben Themas – auch über Paketgrenzen. Werden Karten eines Themas oft vergessen, empfiehlt die App die Aufgaben dazu. Ohne `topics` gilt das Kapitel im eigenen Paket als Thema. |
| `pastExam` | – | `true` bei Aufgaben aus Alt- oder Probeklausuren – sie werden am Schreibtisch zuerst empfohlen. |
| `image` | – | Bild als Daten-URL (`data:image/png;base64,…`), z. B. eine Skizze von der Folie |
| `mode` | – | `mobile` oder `desk`; Standard: `task` → `desk`, sonst `mobile` |
| `prompts` | – | **Sokratisches Lernen:** 2–4 Leitfragen, die vor dem Aufdecken einzeln als „Tipp“ erscheinen (nur wenn der Nutzer „Sokratisches Lernen (Test)“ eingeschaltet hat). Jede führt einen Denkschritt weiter, keine verrät die Antwort. |
| `keyPoints` | – | **Sokratisches Lernen:** 2–5 Kernpunkte der Antwort, die der Nutzer nach dem Aufdecken abhakt; die App schlägt daraus eine Bewertung vor. Jeder Kernpunkt muss sich in `back` wiederfinden. |

Pakete mit `prompts`/`keyPoints` tragen auf oberster Ebene `"minApp": "1.19.0"`: Ältere Apps verwerfen die Felder sonst still, neuere warnen vor dem Import, wenn sie zu alt sind.

### Typen

- **`basic`** – Frage vorne, Antwort hinten.
- **`cloze`** – Lückentext in `front`: `Das Hookesche Gesetz lautet {{$\sigma = E\varepsilon$}}.` `back` ist optional (Zusatzerklärung).
- **`mc`** – Multiple Choice: `options` (Liste) und `correct` (Indizes ab 0, mehrere möglich). `back` = Erklärung.
- **`match`** – Zuordnen: `pairs` = Liste von Paaren `["links", "rechts"]` (mindestens 2, die rechten Einträge verschieden). Die App bietet zu jedem linken Begriff die rechten Einträge gemischt zur Auswahl an und zeigt nach „Prüfen“, wie viele stimmen. Rechte Einträge kurz halten (sie stehen in einer Auswahlliste, Formeln dort nur als Text). `back` = Erklärung. Beispiel: `{"uid": "k1-f011-1", "type": "match", "front": "Ordne jeder Norm ihre Aufgabe zu.", "pairs": [["ISO 9001", "Anforderungen an ein QMS"], ["ISO 19011", "Leitfaden für Audits"]], "back": ""}`
- **`task`** – Rechenaufgabe (Zusatz zu den Karten, wird am Schreibtisch nach Empfehlung geübt): `front` = Aufgabenstellung mit Zahlenwerten, `steps` = Lösungsschritte (Liste), `result` = Endergebnis, `back` = Hinweise/typische Fehler.
  Zusätzlich `answers` für die automatische Prüfung der Eingabe in der App:
  `[{ "label": "\\sigma", "value": 159.2, "unit": "MPa", "tolerance": 0.02 }]` – `label` (LaTeX, optional, bei mehreren gesuchten Größen), `value` (Zahl in der angegebenen Einheit), `unit` (optional), `tolerance` (relative Abweichung, Standard 0,02 = 2 %).
  Statt `value` geht auch `text` für Antworten, die keine Zahl sind: `{ "label": "Y", "text": ["01101001"] }` oder `{ "text": ["3E8", "16#3E8"] }` (Liste = alle akzeptierten Schreibweisen). Verglichen wird ohne Groß-/Kleinschreibung und Leerzeichen – nur für eindeutige Kurzantworten verwenden (Zahlencode, Wahrheitstabellen-Spalte, Schlüsselwort), nicht für Funktionsgleichungen, die mehrere richtige Formen haben.

### Textformat

Alle Textfelder unterstützen **Markdown** und Formeln in **LaTeX** (KaTeX). Programmcode (z. B. SCL) als Code-Block mit drei Backticks – er erscheint in fester Schrift, Einrückungen bleiben erhalten; Lücken `{{…}}` funktionieren auch im Code-Block.

`$…$` bzw. `\(…\)` im Fließtext, `$$…$$` bzw. `\[…\]` abgesetzt. In JSON müssen Backslashes verdoppelt werden (`"$\\sigma$"`).

## Update-Verhalten

Wird ein Paket mit gleicher `id` erneut importiert:

- Karten mit bekannter `uid` werden inhaltlich aktualisiert, **der Lernfortschritt bleibt**.
- Neue `uid`s kommen als neue Karten dazu und werden in den Lernplan eingeplant.
- Fehlende `uid`s werden archiviert (nicht gelöscht) und tauchen wieder auf, falls sie zurückkommen.
- Vom Nutzer gelöschte Karten (Lernsitzung → Papierkorb) bleiben gelöscht, auch wenn das Paket ihre `uid` weiter enthält. Ihr Inhalt wird trotzdem aktualisiert, damit eine Wiederherstellung (Prüfungsseite → Karten → Gelöscht) den neuen Stand zeigt.

## Meldungen (`Meldungen_<Prüfung>_<Datum>.json`)

In der App können fehlerhafte oder unklare Karten gemeldet werden (Lernsitzung → Fähnchen). Unter Prüfung → Karten → Gemeldet lassen sich Meldungen abhaken und alle offenen Meldungen exportieren:

```json
{
  "format": "lernapp-meldungen",
  "formatVersion": 1,
  "exportedAt": "2026-11-03T18:12:00.000Z",
  "exam": "Qualitätsmanagement",
  "packages": [{ "id": "qm-grundlagen", "title": "…", "version": 1 }],
  "reports": [
    {
      "packageId": "qm-grundlagen",
      "uid": "k1-f006-3",
      "category": "unklar",
      "note": "Beispiel fehlt",
      "reportedAt": "2026-11-02T07:40:00.000Z",
      "front": "…", "back": "…", "source": { "file": "…", "slide": 6 }
    }
  ]
}
```

`category`: `fehler` (fachlich falsch), `unklar`, `aufteilen` (zu lang), `sonstiges`. Über `packageId` + `uid` ist die Karte im Paket eindeutig. Gemeldete Karten sind pausiert (werden nicht abgefragt), bis die Meldung erledigt ist. Ändert ein Paket-Update eine gemeldete Karte, gilt die Meldung in der App automatisch als erledigt.

## Fachprofil

Jede Prüfung hat in der App ein Fachprofil (Prüfung → Karten mit Claude erstellen → Fachprofil). Felder, alle optional:

| Feld | Inhalt |
|---|---|
| `slug` | Ordner des Fachs im Inhalte-Archiv (`faecher/<slug>`), bleibt beim Umbenennen der Prüfung gleich |
| `form` | Prüfungsform, z. B. „schriftliche Klausur“ |
| `duration` | Dauer in Minuten |
| `aids` | erlaubte Hilfsmittel |
| `taskShare` | Anteil Rechenaufgaben: `keine`, `wenig`, `mittel`, `hoch` |
| `focus` | Schwerpunkte, Hinweise des Dozenten |
| `omit` | was weggelassen oder nur als Zusatzstoff abgefragt wird |
| `notation` | Formelzeichen, Einheiten |
| `notes` | Sonstiges |

Von Claude übernommene Felder gelten als Vorschlag, bis der Nutzer das Fachprofil speichert.

## Auftrag (`lernapp-auftrag`)

Text, den die App für Claude erzeugt („Auftrag für Claude kopieren“): eine Zeile `/kartenpaket <Prüfungen>` und ein JSON-Block:

```json
{
  "format": "lernapp-auftrag",
  "formatVersion": 1,
  "created": "2026-10-27",
  "semester": { "name": "5. Semester", "kind": "dual" },
  "exams": [
    {
      "name": "Technische Mechanik II",
      "slug": "technische-mechanik-ii",
      "date": "2027-02-01",
      "weight": 2,
      "lecturesOngoing": true,
      "profile": { "form": "schriftlich", "aids": "Taschenrechner" },
      "unconfirmed": ["aids"],
      "packages": [{ "id": "tm2-festigkeitslehre", "title": "…", "version": 2, "cards": 140, "deleted": ["k2-f031-1"] }],
      "reports": [ { "packageId": "…", "uid": "…", "category": "fehler", "note": "…", "front": "…", "back": "…" } ]
    }
  ]
}
```

`lecturesOngoing`: Die Vorlesung läuft noch, weitere Unterlagen folgen. `unconfirmed`: Felder, die Claude vorgeschlagen und der Nutzer noch nicht bestätigt hat. `reports`: offene Meldungen wie in der Meldungsdatei. `deleted`: uids der Karten, die der Nutzer gelöscht hat – nicht durch inhaltsgleiche Karten mit neuer uid ersetzen.

## Fachprofile (`Fachprofile_<Semester>.json`)

Antwort von Claude, wenn mehrere Fächer ohne Kartenpaket eingerichtet werden. Import in der App unter „Karten importieren“; Zuordnung über `slug`, sonst über den Namen. Die Angaben ersetzen die bisherigen Felder und werden als Vorschlag markiert.

```json
{
  "format": "lernapp-fachprofile",
  "formatVersion": 1,
  "exams": [
    { "name": "Technische Mechanik II", "slug": "technische-mechanik-ii", "profile": { "form": "schriftlich", "duration": 120, "taskShare": "hoch" } },
    { "name": "Regelungstechnik", "slug": "regelungstechnik", "pending": [{ "id": "uebungsblatt", "title": "Neues Übungsblatt", "from": "2026-11-04", "repeatDays": 7 }] }
  ]
}
```

Je Prüfung `profile` und/oder `pending` (Erinnerungen an fehlende Unterlagen, Aufbau wie im Kartenpaket) – so lassen sich Erinnerungen für mehrere Fächer mit einer Datei anlegen, ohne Pakete zu aktualisieren.

## Vorlage ohne Lernfortschritt (`lernapp-vorlage`)

Export aus der App unter Einstellungen → „Vorlage exportieren“: alle Semester mit ihren Prüfungen und Kartenpaketen, ohne Lernstand, Bewertungen, Hausaufgaben und persönliche Einstellungen. Import in einem Schritt beim ersten Start („Vorlage von Kommilitonen übernehmen“) oder unter „Karten importieren“.

```json
{
  "format": "lernapp-vorlage",
  "formatVersion": 1,
  "exportedAt": "2026-10-28T13:00:00.000Z",
  "semesters": [
    { "name": "5. Semester", "kind": "dual", "active": true, "exams": [
      { "name": "Regelungstechnik", "date": "2027-02-01", "weight": 2, "color": "#ff9500",
        "profile": { "form": "schriftlich", "duration": 120 },
        "pending": [{ "id": "rt-altklausuren", "title": "Altklausuren" }],
        "reports": [{ "packageId": "…", "uid": "k3-f012-1", "category": "fehler", "note": "Vorzeichen falsch", "reportedAt": "2026-10-28T12:00:00.000Z" }],
        "packages": [ { "format": "lernapp-paket", "formatVersion": 1, "id": "…", "chapters": [{ "id": "k18", "title": "…", "later": true }], "cards": [] } ] }
    ] }
  ]
}
```

Pausierte Kapitel stehen als `later` im Paket. `reports`: offene Meldungen zu Karten – sie gelten für alle, die Karten bleiben auch beim Empfänger pausiert, bis ein Update sie ändert. Prüfungen werden beim Import über den Namen (oder `profile.slug`) zugeordnet, bevorzugt im gleichnamigen, sonst im aktiven Semester: vorhandene werden ergänzt (Fachprofil nur in leere Felder), fehlende neu angelegt. Pakete: neuere oder gleiche Version → Update (Lernfortschritt bleibt; im Paket fehlende Karten werden nicht archiviert), ältere Version → übersprungen samt ihrer Meldungen.

## Paket-Sammlung (`<Datum>_Updates.lernsammlung.json`)

Mehrere Kartenpakete für verschiedene Prüfungen in einer Datei – z. B. alle Updates eines Auftrags. Der Nutzer importiert sie unter „Karten importieren“ in einem Schritt; die Vorschau zeigt je Paket „Update 3 → 4“, „neu“, „schon aktuell“ oder „deine Version ist neuer“.

```json
{
  "format": "lernapp-sammlung",
  "formatVersion": 1,
  "created": "2026-10-29",
  "exams": [
    { "slug": "qualitaetsmanagement", "name": "Qualitätsmanagement", "packages": [ { "format": "lernapp-paket", "…": "…" } ] },
    { "slug": "maschinendynamik", "packages": [ "…" ] }
  ]
}
```

Zuordnung wie bei Fachprofilen: über `slug` (Archiv-Ordner, wie im Auftrag), sonst über `name`, sonst über die Prüfung, in der ein Paket mit gleicher ID schon importiert ist; Prüfungen des aktiven Semesters haben Vorrang. Jedes neue oder neuere Paket wird wie ein einzelner Import übernommen (Lernfortschritt bleibt, im Paket fehlende Karten werden archiviert, Meldungen zu geänderten oder entfernten Karten gelten als erledigt, `later`/`pending`/`profile` wirken wie gewohnt). Gleiche und ältere Versionen bleiben unverändert. Erzeugen: `npm run sammlung -- --out <datei> <archiv>/faecher/<slug>/pakete/<paket>.lernpaket.json …` (Slug aus dem Archivpfad oder als `<slug>=<datei>`).

## Erinnerungen (`Erinnerungen_<Datum>.json`)

Freie Erinnerungen, die Claude dem Nutzer mitgeben kann (z. B. „Feedback zum Pilot geben“, „Altklausuren anfragen“). Import unter „Karten importieren“; sie erscheinen ab `date` auf der Startseite und in `Erinnerung.txt`.

```json
{
  "format": "lernapp-erinnerungen",
  "formatVersion": 1,
  "reminders": [
    { "id": "md-pilot-feedback", "title": "Feedback zum Pilot geben", "note": "Tipps zu leicht oder zu schwer?", "date": "2026-11-05", "exam": "maschinendynamik" }
  ]
}
```

`id` ist stabil: Dieselbe Erinnerung wird nie doppelt angelegt, auch nicht, wenn der Nutzer sie gelöscht hat. `exam` (optional) ordnet sie einer Prüfung zu – über den Archiv-Ordner (`slug`) oder den Namen. Für fehlende Unterlagen (Skripte, Altklausuren) weiter `pending` im Paket bzw. in der Fachprofil-Datei verwenden.

## Karten aus anderen Tools (Text-Import)

Wer kein Claude nutzt, importiert Karten unter „Karten importieren“ → „Karten aus anderen Tools“ (Datei oder eingefügter Text). Erkannt werden:

- Blöcke mit `F:`/`A:` (auch `Frage:`/`Antwort:`, `Q:`/`A:`, fett oder nummeriert; Antworten dürfen mehrzeilig sein)
- je Zeile Frage und Antwort, getrennt durch Tab, `;`, ` ;; ` oder als CSV (Exporte aus Anki, Quizlet, Excel)
- Markdown-Tabellen mit zwei Spalten und JSON-Listen (`question`/`answer`, `front`/`back`, `frage`/`antwort`, …)

Überschriften (`## Thema` oder `Kapitel: …`) werden zu Kapiteln in Reihenfolge des Auftretens. Daraus entsteht ein Paket mit der ID `text-<titel>`; die uids leiten sich aus dem Fragetext ab. Ein erneuter Import mit gleichem Titel ist deshalb ein Update: unveränderte Karten behalten ihren Fortschritt, neue kommen dazu, Karten mit geänderter Frage gelten als neu. Die Schaltfläche „Vorlage für ChatGPT & Co. kopieren“ liefert eine Anweisung, die genau dieses Format erzeugt.
