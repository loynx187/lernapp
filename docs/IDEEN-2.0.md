# Ideen für Version 2.0.0

Gesammelt während der Testphase, umgesetzt wird erst danach (Wunsch des Nutzers). In der App unter Einstellungen → „Ideen für Version 2“ (Inhalt aus `src/lib/ideas.ts` – beim Ergänzen beide Stellen pflegen); dort kann der Nutzer eigene Notizen festhalten, sie werden mit dem Profil abgeglichen.

## Sokratisch lernen

Statt die Antwort nur aufzudecken, führen Fragen schrittweise selbst zur Antwort – das passt zu Klausuren, in denen Antworten in Sätzen logisch erklärt werden sollen.

- **Leitfragen vor dem Aufdecken:** Karten bekommen optional 2–4 Leitfragen („Was passiert mit der Energie?“, „Was folgt daraus für die Amplitude?“). „Tipp“ zeigt die nächste Leitfrage statt gleich der Lösung; wer ohne Tipp auskommt, bewertet besser.
- **„Warum?“-Nachfrage nach dem Aufdecken:** Nach einer richtigen Antwort fragt die Karte gelegentlich „Warum ist das so?“ oder „Was wäre, wenn …?“ (z. B. D > 1 statt D < 1). Kurze Begründung im Kopf oder als Text, dann Vergleich mit der Musterbegründung.
- **Erst erklären, dann vergleichen:** Erklärfragen (Fragenkataloge) mit Textfeld: eigene Antwort in Sätzen schreiben, danach Musterantwort daneben. Selbstbewertung nach Kernpunkten (Checkliste aus der Antwort), nicht nur nach Gefühl.
- **Hinweisleiter bei Rechenaufgaben:** Statt aller Lösungsschritte auf einmal: Schritt für Schritt als Frage („Welche Randbedingung gilt an der Einspannung?“), der nächste Schritt erst nach eigenem Versuch.
- **Fehler finden:** Neuer Kartentyp: eine fast richtige Aussage oder Rechnung mit einem eingebauten Fehler – „Was ist hier falsch und warum?“. Trainiert genaues Begründen.
- **Zusammenhänge erfragen:** Über die Themen-Schlagworte (topics) verknüpfte Fragen: „Wie hängt das Lehr’sche Dämpfungsmaß mit dem Phasenportrait zusammen?“ – Karten, die zwei Kapitel verbinden, kommen erst, wenn beide begonnen sind.
- **Sicherheit vor dem Aufdecken:** Vor dem Aufdecken kurz angeben, wie sicher man ist. Die App zeigt später, wo man sich überschätzt (sicher, aber falsch) – diese Karten kommen häufiger.
- **Sokratischer Dialog mit Claude:** Knopf „Mit Claude durchsprechen“ bei schwachen Kapiteln: kopiert Karten, eigene Fehlversuche und das Fachprofil als Auftrag. Claude fragt dann sokratisch nach, statt zu erklären; Ergebnis kann als neue Leitfragen ins Paket zurückfließen.
- **Feynman-Runde je Kapitel:** Am Ende eines Kapitels: das Kapitel in eigenen Worten erklären (Text oder Sprachnotiz). Lücken markieren, die zugehörigen Karten kommen früher wieder.

## Weitere Ideen

- **Widget-Schlüssel per QR-Code:** Schlüssel nicht über die Zwischenablage, sondern als QR-Code zum Scannen in Scriptable übertragen.
- **Musterlösungen abgleichen:** Sobald Musterlösungen zu Probeklausuren kommen: eigene Lösungen in den Karten automatisch als „mit Musterlösung geprüft“ kennzeichnen lassen.
