// Gesammelte Ideen für Version 2.0.0 – umgesetzt wird erst nach der Testphase.
// Gleicher Inhalt wie docs/IDEEN-2.0.md (beim Ergänzen beide pflegen).

export interface IdeaGroup {
  title: string
  intro?: string
  ideas: { title: string; text: string }[]
}

export const IDEAS_V2: IdeaGroup[] = [
  {
    title: 'Sokratisch lernen',
    intro: 'Statt die Antwort nur aufzudecken, führen Fragen schrittweise selbst zur Antwort – das passt zu Klausuren, in denen Antworten in Sätzen logisch erklärt werden sollen.',
    ideas: [
      { title: 'Leitfragen vor dem Aufdecken', text: 'Karten bekommen optional 2–4 Leitfragen („Was passiert mit der Energie?“, „Was folgt daraus für die Amplitude?“). „Tipp“ zeigt die nächste Leitfrage statt gleich der Lösung; wer ohne Tipp auskommt, bewertet besser.' },
      { title: '„Warum?“-Nachfrage nach dem Aufdecken', text: 'Nach einer richtigen Antwort fragt die Karte gelegentlich „Warum ist das so?“ oder „Was wäre, wenn …?“ (z. B. D > 1 statt D < 1). Kurze Begründung im Kopf oder als Text, dann Vergleich mit der Musterbegründung.' },
      { title: 'Erst erklären, dann vergleichen', text: 'Erklärfragen (Fragenkataloge) mit Textfeld: eigene Antwort in Sätzen schreiben, danach Musterantwort daneben. Selbstbewertung nach Kernpunkten (Checkliste aus der Antwort), nicht nur nach Gefühl.' },
      { title: 'Hinweisleiter bei Rechenaufgaben', text: 'Statt aller Lösungsschritte auf einmal: Schritt für Schritt als Frage („Welche Randbedingung gilt an der Einspannung?“), der nächste Schritt erst nach eigenem Versuch.' },
      { title: 'Fehler finden', text: 'Neuer Kartentyp: eine fast richtige Aussage oder Rechnung mit einem eingebauten Fehler – „Was ist hier falsch und warum?“. Trainiert genaues Begründen.' },
      { title: 'Zusammenhänge erfragen', text: 'Über die Themen-Schlagworte (topics) verknüpfte Fragen: „Wie hängt das Lehr’sche Dämpfungsmaß mit dem Phasenportrait zusammen?“ – Karten, die zwei Kapitel verbinden, kommen erst, wenn beide begonnen sind.' },
      { title: 'Sicherheit vor dem Aufdecken', text: 'Vor dem Aufdecken kurz angeben, wie sicher man ist. Die App zeigt später, wo man sich überschätzt (sicher, aber falsch) – diese Karten kommen häufiger.' },
      { title: 'Sokratischer Dialog mit Claude', text: 'Knopf „Mit Claude durchsprechen“ bei schwachen Kapiteln: kopiert Karten, eigene Fehlversuche und das Fachprofil als Auftrag. Claude fragt dann sokratisch nach, statt zu erklären; Ergebnis kann als neue Leitfragen ins Paket zurückfließen.' },
      { title: 'Feynman-Runde je Kapitel', text: 'Am Ende eines Kapitels: das Kapitel in eigenen Worten erklären (Text oder Sprachnotiz). Lücken markieren, die zugehörigen Karten kommen früher wieder.' },
    ],
  },
  {
    title: 'Weitere Ideen',
    ideas: [
      { title: 'Widget-Schlüssel per QR-Code', text: 'Schlüssel nicht über die Zwischenablage, sondern als QR-Code zum Scannen in Scriptable übertragen.' },
      { title: 'Musterlösungen abgleichen', text: 'Sobald Musterlösungen zu Probeklausuren kommen: eigene Lösungen in den Karten automatisch als „mit Musterlösung geprüft“ kennzeichnen lassen.' },
    ],
  },
]
