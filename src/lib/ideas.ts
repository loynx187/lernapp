// Gesammelte Ideen für Version 2.0.0 – grundsätzlich nach der Testphase; „Sokratisch lernen“
// wird auf Wunsch des Nutzers in Stufen schon vorher umgesetzt (hinter einem Test-Schalter).
// Gleicher Inhalt wie docs/IDEEN-2.0.md (beim Ergänzen beide pflegen).

export interface IdeaGroup {
  title: string
  intro?: string
  ideas: { title: string; text: string; status?: string }[]
}

export const IDEAS_V2: IdeaGroup[] = [
  {
    title: 'Sokratisch lernen',
    intro: 'Statt die Antwort nur aufzudecken, führen Fragen schrittweise selbst zur Antwort – das passt zu Klausuren, in denen Antworten in Sätzen logisch erklärt werden sollen.',
    ideas: [
      { title: 'Leitfragen vor dem Aufdecken', status: 'Stufe 1 · in 1.19.0', text: 'Karten bekommen optional 2–4 Leitfragen („Was passiert mit der Energie?“, „Was folgt daraus für die Amplitude?“). „Tipp“ zeigt die nächste Leitfrage statt gleich der Lösung; wer ohne Tipp auskommt, bewertet besser.' },
      { title: '„Warum?“-Nachfrage nach dem Aufdecken', status: 'Stufe 2', text: 'Nach einer richtigen Antwort fragt die Karte gelegentlich „Warum ist das so?“ oder „Was wäre, wenn …?“ (z. B. D > 1 statt D < 1). Kurze Begründung im Kopf oder als Text, dann Vergleich mit der Musterbegründung.' },
      { title: 'Erst erklären, dann vergleichen', status: 'Stufe 1 · in 1.19.0', text: 'Antwort im Kopf (oder schriftlich) in Sätzen formulieren, nach dem Aufdecken die Kernpunkte der Musterantwort abhaken. Die App schlägt daraus eine Bewertung vor (mit Tipps höchstens „Schwer“), bewertet wird weiter von Hand. Ein Textfeld zum Schreiben folgt ggf. in Stufe 2.' },
      { title: 'Hinweisleiter bei Rechenaufgaben', status: 'Stufe 1 · in 1.19.0', text: 'Lösungsschritte werden schon einzeln aufgedeckt; neu sind Leitfragen als „Tipp“ vor dem ersten Schritt („Welche Randbedingung gilt an der Einspannung?“). Die Schritte selbst als Fragen zu formulieren ist Sache der Kartenpakete.' },
      { title: 'Fehler finden', status: 'Stufe 3', text: 'Neuer Kartentyp: eine fast richtige Aussage oder Rechnung mit einem eingebauten Fehler – „Was ist hier falsch und warum?“. Trainiert genaues Begründen.' },
      { title: 'Zusammenhänge erfragen', status: 'Stufe 3', text: 'Über die Themen-Schlagworte (topics) verknüpfte Fragen: „Wie hängt das Lehr’sche Dämpfungsmaß mit dem Phasenportrait zusammen?“ – Karten, die zwei Kapitel verbinden, kommen erst, wenn beide begonnen sind.' },
      { title: 'Sicherheit vor dem Aufdecken', status: 'Stufe 2', text: 'Vor dem Aufdecken kurz angeben, wie sicher man ist. Die App zeigt später, wo man sich überschätzt (sicher, aber falsch) – diese Karten kommen häufiger.' },
      { title: 'Sokratischer Dialog mit Claude', status: 'Stufe 2', text: 'Knopf „Mit Claude durchsprechen“ bei schwachen Kapiteln: kopiert Karten, eigene Fehlversuche und das Fachprofil als Auftrag. Claude fragt dann sokratisch nach, statt zu erklären; Ergebnis kann als neue Leitfragen ins Paket zurückfließen.' },
      { title: 'Feynman-Runde je Kapitel', status: 'Stufe 3', text: 'Am Ende eines Kapitels: das Kapitel in eigenen Worten erklären (Text oder Sprachnotiz). Lücken markieren, die zugehörigen Karten kommen früher wieder.' },
    ],
  },
  {
    title: 'Weitere Ideen',
    ideas: [
      { title: 'Widget-Schlüssel per QR-Code', text: 'Schlüssel nicht über die Zwischenablage, sondern als QR-Code zum Scannen in Scriptable übertragen.' },
      { title: 'Musterlösungen abgleichen', text: 'Sobald Musterlösungen zu Probeklausuren kommen: eigene Lösungen in den Karten automatisch als „mit Musterlösung geprüft“ kennzeichnen lassen.' },
    ],
  },
  {
    title: 'Einschätzung und Umsetzung (29.10.2026)',
    intro: 'Gut umsetzbar in Stufen. Der größte Aufwand und das größte Fehlerrisiko liegen in den Inhalten (gute Leitfragen), nicht im App-Code.',
    ideas: [
      { title: 'Reihenfolge', text: 'Stufe 1: Test-Schalter, Leitfragen und Kernpunkte, Bewertungsvorschlag; Pilot mit dem Fragenkatalog Maschinendynamik. Stufe 2: „Warum?“-Nachfrage, Sicherheit vor dem Aufdecken, Dialog mit Claude, ggf. Textfeld. Stufe 3 (eher 2.0): Zusammenhänge im Lernplan, Fehler finden, Feynman-Runde.' },
      { title: 'Schutz vor ungewollten Änderungen', text: 'Alles hinter dem Schalter „Sokratisches Lernen (Test)“ (Standard aus – dann läuft die Sitzung wie bisher). Nur optionale Felder, keine Datenbank-Umbauten. Vorhandene Tests bleiben unverändert, es kommen nur neue dazu. Lernplan und Lernalgorithmus bleiben in Stufe 1 unangetastet. Vor dem Einschalten eine Sicherung exportieren. Jede Stufe als eigene Version, jederzeit rücknehmbar.' },
      { title: 'Inhalte', text: 'Leitfragen lohnen sich vor allem für Erklärfragen (Fragenkataloge, Verständniskarten), nicht für Fakten, Lückentexte oder Zuordnen. Typische Fehler: Leitfrage verrät die Antwort, Kernpunkt steht nicht in der Antwort, zu viele Tipps. Das Prüfskript warnt davor; Fehler wie gewohnt über „Melden“.' },
      { title: 'Stolperfalle Import', text: 'Ältere App-Versionen verwerfen Leitfragen still. Pakete mit Leitfragen tragen deshalb „minApp“ – ab 1.19.0 warnt die App, wenn sie zu alt ist. Immer erst die App auf allen Geräten aktualisieren, dann das Paket importieren.' },
      { title: 'Nebenwirkung', text: 'Karten mit Tipps und Kernpunkten dauern länger. Die gemessene Lernzeit passt das Tagespensum automatisch an.' },
    ],
  },
]
