# Ideen für Version 2.0.0

Gesammelt während der Testphase, umgesetzt grundsätzlich danach. Ausnahme auf Wunsch des Nutzers: „Sokratisch lernen“ wird schon vorher in Stufen umgesetzt (Stufe 1 in 1.19.0, hinter dem Schalter „Sokratisches Lernen (Test)“). In der App unter Einstellungen → „Ideen für Version 2“ (Inhalt aus `src/lib/ideas.ts` – beim Ergänzen beide Stellen pflegen); dort kann der Nutzer eigene Notizen festhalten, sie werden mit dem Profil abgeglichen.

## Sokratisch lernen

Statt die Antwort nur aufzudecken, führen Fragen schrittweise selbst zur Antwort – das passt zu Klausuren, in denen Antworten in Sätzen logisch erklärt werden sollen.

- **Leitfragen vor dem Aufdecken** _(Stufe 1 · in 1.19.0)_: Karten bekommen optional 2–4 Leitfragen („Was passiert mit der Energie?“, „Was folgt daraus für die Amplitude?“). „Tipp“ zeigt die nächste Leitfrage statt gleich der Lösung; wer ohne Tipp auskommt, bewertet besser.
- **„Warum?“-Nachfrage nach dem Aufdecken** _(Stufe 2)_: Nach einer richtigen Antwort fragt die Karte gelegentlich „Warum ist das so?“ oder „Was wäre, wenn …?“ (z. B. D > 1 statt D < 1). Kurze Begründung im Kopf oder als Text, dann Vergleich mit der Musterbegründung.
- **Erst erklären, dann vergleichen** _(Stufe 1 · in 1.19.0)_: Antwort im Kopf (oder schriftlich) in Sätzen formulieren, nach dem Aufdecken die Kernpunkte der Musterantwort abhaken. Die App schlägt daraus eine Bewertung vor (mit Tipps höchstens „Schwer“), bewertet wird weiter von Hand. Ein Textfeld zum Schreiben folgt ggf. in Stufe 2.
- **Hinweisleiter bei Rechenaufgaben** _(Stufe 1 · in 1.19.0)_: Lösungsschritte werden schon einzeln aufgedeckt; neu sind Leitfragen als „Tipp“ vor dem ersten Schritt („Welche Randbedingung gilt an der Einspannung?“). Die Schritte selbst als Fragen zu formulieren ist Sache der Kartenpakete.
- **Fehler finden** _(Stufe 3)_: Neuer Kartentyp: eine fast richtige Aussage oder Rechnung mit einem eingebauten Fehler – „Was ist hier falsch und warum?“. Trainiert genaues Begründen.
- **Zusammenhänge erfragen** _(Stufe 3)_: Über die Themen-Schlagworte (topics) verknüpfte Fragen: „Wie hängt das Lehr’sche Dämpfungsmaß mit dem Phasenportrait zusammen?“ – Karten, die zwei Kapitel verbinden, kommen erst, wenn beide begonnen sind.
- **Sicherheit vor dem Aufdecken** _(Stufe 2)_: Vor dem Aufdecken kurz angeben, wie sicher man ist. Die App zeigt später, wo man sich überschätzt (sicher, aber falsch) – diese Karten kommen häufiger.
- **Sokratischer Dialog mit Claude** _(Stufe 2)_: Knopf „Mit Claude durchsprechen“ bei schwachen Kapiteln: kopiert Karten, eigene Fehlversuche und das Fachprofil als Auftrag. Claude fragt dann sokratisch nach, statt zu erklären; Ergebnis kann als neue Leitfragen ins Paket zurückfließen.
- **Feynman-Runde je Kapitel** _(Stufe 3)_: Am Ende eines Kapitels: das Kapitel in eigenen Worten erklären (Text oder Sprachnotiz). Lücken markieren, die zugehörigen Karten kommen früher wieder.

## Weitere Ideen

- **Skizzenfeld für Rechenaufgaben**: Am iPad mit dem Apple Pencil direkt neben der Aufgabe rechnen, einen FUP zeichnen oder SCL skizzieren und danach mit der Lösung vergleichen – statt auf einem Zettel.
- **Spickzettel-Entwurf**: Für Prüfungen mit eigenem Formelblatt (z. B. Regelungstechnik, zwei A4-Seiten): Formeln und oft vergessene Karten als Vorlage zum Abschreiben zusammenstellen.
- **Schwachstellen im Auftrag für Claude**: Der Auftrag schickt mit, welche Themen oft vergessen werden; Claude ergänzt gezielt Erklärkarten und passende Übungsaufgaben.
- **Bildkarten mit Abdeckung**: Teile eines Diagramms (Bode-Diagramm, Regelkreis, Ablaufkette) werden verdeckt und müssen benannt werden – für Technikfächer oft besser als Text.
- **Klausurergebnis eintragen**: Nach der Klausur die Note eintragen; die App vergleicht sie mit ihrer Prognose und lernt, ob Vorhersage und Budget realistisch waren.
- **Widget-Schlüssel per QR-Code**: Schlüssel nicht über die Zwischenablage, sondern als QR-Code zum Scannen in Scriptable übertragen.
- **Musterlösungen abgleichen**: Sobald Musterlösungen zu Probeklausuren kommen: eigene Lösungen in den Karten automatisch als „mit Musterlösung geprüft“ kennzeichnen lassen.

## Weitere Lernmethoden und Lernalgorithmus (22.11.2026)

- **Lösungsbeispiele schrittweise ausblenden**: Bei Rechenaufgaben zuerst der ganze Lösungsweg, bei jeder Wiederholung fehlt ein Schritt mehr (von hinten), bis die Aufgabe allein gelöst wird. Nutzt die vorhandenen Lösungsschritte (steps) der Pakete – für Rechenfächer eine der wirksamsten Methoden. Priorität 1.
- **Fehlerbuch**: Bei einer falsch gelösten Aufgabe kurz die Fehlerart wählen (Vorzeichen, Einheit, falscher Ansatz, Freischnitt vergessen …). Die App zeigt die häufigsten Fehlerarten und empfiehlt passende Aufgaben; die Muster gehen auch in den Auftrag für Claude. Priorität 2.
- **Gemischtes Üben**: Aufgaben verschiedener Themen gezielt durchmischen, damit der richtige Ansatz selbst erkannt werden muss – bisher wird erst in den letzten 14 Tagen gemischt. Z. B. als Schalter oder eigener Übungsmodus am Schreibtisch.
- **Vorab-Fragen vor der Vorlesung**: Ein paar Fragen zum kommenden Vorlesungsblock, bevor er gehört wird (Pakete mit „later“). Auch falsche Vermutungen machen den Stoff danach einprägsamer; die Fragen zählen nicht in die Bewertung.
- **Formelblatt mit der App erstellen**: Ergänzung zum Spickzettel-Entwurf: Die App baut das erlaubte Formelblatt schrittweise aus den Karten mit dem Nutzer auf – das Erstellen ist selbst eine Wiederholung.
- **Zielsicherheit passend zum Klausurtermin**: Weit vor der Klausur etwa 85 % (weniger Wiederholungen, mehr Zeit für neuen Stoff), in den letzten zwei bis drei Wochen automatisch 93–95 %. Als Schalter unter Lernalgorithmus.
- **Lernschritte wählbar**: Statt fester Lernschritte (1 bzw. 10 Minuten) kürzere wählbar, z. B. 1 und 5 Minuten – passt besser zu kurzen Lernphasen unterwegs, ist aber etwas weniger wirksam.

## Einschätzung und Umsetzung (29.10.2026)

Gut umsetzbar in Stufen. Der größte Aufwand und das größte Fehlerrisiko liegen in den Inhalten (gute Leitfragen), nicht im App-Code.

- **Reihenfolge**: Stufe 1: Test-Schalter, Leitfragen und Kernpunkte, Bewertungsvorschlag; Pilot mit dem Fragenkatalog Maschinendynamik. Stufe 2: „Warum?“-Nachfrage, Sicherheit vor dem Aufdecken, Dialog mit Claude, ggf. Textfeld. Stufe 3 (eher 2.0): Zusammenhänge im Lernplan, Fehler finden, Feynman-Runde.
- **Schutz vor ungewollten Änderungen**: Alles hinter dem Schalter „Sokratisches Lernen (Test)“ (Standard aus – dann läuft die Sitzung wie bisher). Nur optionale Felder, keine Datenbank-Umbauten. Vorhandene Tests bleiben unverändert, es kommen nur neue dazu. Lernplan und Lernalgorithmus bleiben in Stufe 1 unangetastet. Vor dem Einschalten eine Sicherung exportieren. Jede Stufe als eigene Version, jederzeit rücknehmbar.
- **Inhalte**: Leitfragen lohnen sich vor allem für Erklärfragen (Fragenkataloge, Verständniskarten), nicht für Fakten, Lückentexte oder Zuordnen. Typische Fehler: Leitfrage verrät die Antwort, Kernpunkt steht nicht in der Antwort, zu viele Tipps. Das Prüfskript warnt davor; Fehler wie gewohnt über „Melden“.
- **Stolperfalle Import**: Ältere App-Versionen verwerfen Leitfragen still. Pakete mit Leitfragen tragen deshalb „minApp“ – ab 1.19.0 warnt die App, wenn sie zu alt ist. Immer erst die App auf allen Geräten aktualisieren, dann das Paket importieren.
- **Nebenwirkung**: Karten mit Tipps und Kernpunkten dauern länger. Die gemessene Lernzeit passt das Tagespensum automatisch an.
