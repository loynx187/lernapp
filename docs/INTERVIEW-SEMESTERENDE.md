# Interview zum Semesterende

Gemeinsame Bewertung der App nach dem ersten vollen Semester (Testphase) und Diskussion der Funktionen für die nächste Version. Claude führt das Interview Block für Block: eine Frage oder ein kleiner Fragenblock nach dem anderen, Nachfragen erlaubt, Antworten werden am Ende zusammengefasst.

Dauer: etwa 45–60 Minuten, gern in zwei Teilen (Teil 1: Blöcke 1–4, Teil 2: Blöcke 5–7).

## Vorbereitung (Nutzer)

- **Sicherung** aus der App exportieren (Einstellungen → „Sicherung exportieren“). Sie enthält Lerndaten und wird nicht committet, nur im Scratchpad ausgewertet.
- **Auftrag für Claude** kopieren (Prüfungen → „Auftrag für Claude kopieren“) – für Pakete, Meldungen, Bearbeitungen und pausierte Prüfungen.
- **Klausurergebnisse** je Fach bereithalten (Note oder Punkte, soweit schon bekannt) und kurz notieren, wie die Klausur aufgebaut war.

## Vorbereitung (Claude)

Vor dem Gespräch die Sicherung auswerten und die Zahlen mitbringen:

- Lernzeit je Tag und Woche, Anteil der Tage mit erfülltem Tagesplan, längste Lernserie
- Bewertungen: Anteil Nochmal/Schwer/Gut/Einfach, tatsächliche Behaltensquote gegenüber der Zielsicherheit
- Zeit pro Karte je Kartentyp (Erklärkarte, Lückentext, MC, Zuordnen, Aufgabe), mit und ohne sokratisches Lernen
- Je Prüfung: Prognose am Klausurtag gegenüber dem Ergebnis, Rückstand im Verlauf, Zeitpunkt der Pause (falls pausiert)
- Pakete mit den meisten Meldungen, Löschungen, Bearbeitungen und übersprungenen Karten
- Ab etwa 1000 Bewertungen: persönliche FSRS-Parameter berechnen (`scripts/optimize-fsrs.py`) und vorschlagen

## 1. Gesamteindruck

1. Wie zufrieden bist du insgesamt mit der App (1–10)? Was müsste passieren, damit es eine 10 wird?
2. Hast du die App wirklich täglich genutzt? Wann und wo (unterwegs, am Schreibtisch, iPad/Handy/Laptop)?
3. Was hat dich am meisten motiviert, was am meisten genervt?
4. Hättest du ohne die App anders gelernt – mehr, weniger, besser, schlechter?

## 2. Lernergebnis je Prüfung

Für jedes Fach einzeln:

1. Wie gut fühltest du dich vorbereitet? Passt das zur Prognose der App und zum Ergebnis?
2. Welche Klausuraufgaben hätten die Karten oder Aufgaben besser abdecken müssen?
3. Hat sich das Lernen mit Karten für dieses Fach gelohnt? (Bei pausierten Prüfungen: Warum pausiert, und was hätte geholfen?)
4. Waren es zu viele, zu wenige oder die richtigen Karten? (Qualitätsmanagement: Hat sich die Reduktion auf Wiederholungsfragen und Zusammenfassungen bewährt?)

## 3. Lernplanung

1. **Tagesplan und Zeitbudget:** Waren die Minuten realistisch? Hat die automatische Anpassung an die gemessene Lernzeit gepasst?
2. **Wochenplan und freie Tage:** genutzt? Hilfreich?
3. **Rückstand:** Ist die Anzeige in Karten (Abstand zum heutigen Soll) verständlich? Wurde „Rückstand aufholen“ genutzt?
4. **Reihenfolge neuer Karten:** Paket für Paket und erst in den letzten 14 Tagen gemischt – passend?
5. **Endspurt** in den letzten drei Tagen: gemerkt? Sinnvoll?
6. **Prüfung pausieren:** Wie oft und warum?

## 4. Lernalgorithmus und Lernsitzung

1. Fühlten sich die Abstände richtig an – kamen Karten zu früh, zu spät, zu oft?
2. **Bewertung:** Fiel dir die Wahl zwischen Schwer/Gut/Einfach leicht? Wurde ehrlich bewertet?
3. **Lernschritte** (1/10 min) und „Kurze Pause“: störend oder hilfreich? Lernschritte wählbar machen?
4. **Zielsicherheit:** Bei Standard (90 %) geblieben? Interesse an „Zielsicherheit passend zum Klausurtermin“?
5. **Kartentypen:** Welche funktionieren am besten (Erklärkarte, Lückentext, MC mit gemischten Antworten, Zuordnen, Rechenaufgabe)?
6. **Überspringen, Melden, Bearbeiten, Löschen, Folie ansehen:** Was wurde genutzt, was fehlte?
7. **Sokratisches Lernen:** Tipps und Kernpunkte – genutzt? Bewertungsvorschlag passend? Soll es Standard werden, Test-Schalter bleiben oder entfallen?

## 5. Inhalte und Zusammenarbeit mit Claude

1. **Kartenpakete:** Qualität, Umfang, Formulierungen, Fehlerquote. Was soll künftig anders sein (je Fach)?
2. **Auftrag aus der App:** Ist der Ablauf (Unterlagen hochladen → Auftrag → Sammlung importieren) bequem genug? Wo hakt es?
3. **Fachprofile:** Haben die Schwerpunkte gepasst? Was davon gilt fürs nächste Semester weiter?
4. **Schreibtisch-Aufgaben, Hausaufgaben, Probeklausur:** genutzt? Hilfreich für den Rechenteil?
5. **Erinnerungen und fehlende Unterlagen (pending):** hilfreich oder störend?

## 6. Technik und Darstellung

1. **Sync über Dropbox** und mehrere Geräte: Probleme, Konflikte, verlorene Daten?
2. **Widget und Kurzbefehle-Erinnerung:** genutzt?
3. **Design:** Papier/Graphit/Bagel, Farben, Kritzeleien, Hell/Dunkel – zufrieden? Lesbarkeit unterwegs?
4. Geschwindigkeit, Abstürze, Darstellungsfehler (z. B. lange Antworten, Formeln, Bilder)?

## 7. Ausblick: Version 2.0 und nächstes Semester

1. Testphase beenden? Was muss vorher noch behoben werden?
2. **Ideen priorisieren** (Seite „Ideen für Version 2“ bzw. `docs/IDEEN-2.0.md`): je Idee „unbedingt / gern / nicht nötig“, dann die Top 3 festlegen. Besonders: Lösungsbeispiele ausblenden, Fehlerbuch, gemischtes Üben, Klausurergebnis eintragen, Skizzenfeld, sokratische Stufen 2–3.
3. Was fehlt komplett, das in keiner Liste steht?
4. Nächstes Semester: Welche Fächer, welche Unterlagen kommen wann, was soll Claude von Anfang an anders machen?

## Abschluss (Claude)

- Zusammenfassung der Antworten und Entscheidungen zurückmelden und bestätigen lassen
- `docs/IDEEN-2.0.md` und `src/lib/ideas.ts` aktualisieren (Prioritäten, Entscheidungen, verworfene Ideen) – eigener Pull Request mit Version
- Fachspezifische Erkenntnisse in die `profil.md` der Fächer im Inhalte-Archiv übernehmen
- Bei genug Bewertungen: persönliche FSRS-Parameter übergeben
