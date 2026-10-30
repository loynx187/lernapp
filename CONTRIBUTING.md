# Mitentwickeln

Die Lernapp wird von **loynx187** gepflegt. Eigene Weiterentwicklungen sind willkommen – in einem **Fork**, aus dem gute Funktionen einzeln übernommen werden. Diese Anleitung sorgt dafür, dass sich Änderungen aus einem Fork später sauber übernehmen lassen.

## Einrichten

1. Auf GitHub `loynx187/lernapp` **forken**. Der Fork ist deine eigene Kopie; deine Claude-Sitzungen arbeiten nur dort.
2. **Eigene Veröffentlichung:** Im Fork unter *Settings → Pages* „GitHub Actions“ als Quelle wählen. Die App läuft dann unter `https://<dein-name>.github.io/lernapp/`. Eure Lerndaten bleiben getrennt (sie liegen lokal im Browser je Adresse und in der jeweils eigenen Dropbox).
3. **Eigene Dropbox-App:** Unter [dropbox.com/developers](https://www.dropbox.com/developers/apps) eine App anlegen (Zugriff: *App folder*), als Redirect-URI deine App-Adresse eintragen und den App-Schlüssel in `.env` (`VITE_DROPBOX_APP_KEY`) ersetzen. Der Schlüssel des Originals funktioniert nur unter dessen Adresse.
4. **Eigenes Inhalte-Archiv:** Kartenpakete, Unterlagen und Fachprofile gehören in ein **privates** Repository (Unterlagen sind urheberrechtlich geschützt). Lege eins an und trage es in `CLAUDE.md` unter „Projektangaben“ ein – das Archiv des Originals ist nicht freigegeben.

## Auf dem aktuellen Stand bleiben

- Vor jeder neuen Funktion im Fork **„Sync fork“** drücken (oder `git pull upstream main`). So baut deine Änderung auf dem auf, was das Original schon hat.
- Je eine Funktion **in einem eigenen Branch**, der vom aktuellen `main` abzweigt – nicht mehrere Funktionen in einem Branch.

## Damit eine Funktion übernommen werden kann

Eine Funktion muss **für sich allein** funktionieren – auf dem aktuellen Stand des Originals, ohne andere, noch nicht übernommene Änderungen aus dem Fork. Baut sie auf einer früheren eigenen Änderung auf, gehört diese mit in denselben Pull Request (oder wird vorher übernommen).

**Regeln, die das sicherstellen:**

| Regel | Warum |
|---|---|
| **Keine Änderung am Datenbankschema** (`db.version(…)` in `src/lib/db.ts`) und an Dateiformaten (`formatVersion`) ohne Absprache. Neue Daten nur als **optionale Felder**. | Zwei Forks, die beide „Version 8“ der Datenbank anlegen, sind nicht mehr zusammenführbar – und bestehende Lerndaten wären gefährdet. Der Workflow `Tests` prüft das automatisch. |
| **Neue Lernfunktionen hinter einem Schalter** (Standard aus), wie `profile.socratic`. | Ohne den Schalter verhält sich die App unverändert – eine übernommene Funktion stört niemanden, der sie nicht will. |
| **Vorhandene Tests nicht ändern**, nur neue hinzufügen. Jede neue Funktion bekommt einen Browser-Test (`e2e/`). | Grüne vorhandene Tests zeigen, dass nichts Bestehendes kaputtgeht. |
| Neue Felder in Kartenpaketen: in `parsePackage`, `contentKey`/`stripContent` aufnehmen, Pakete damit bekommen `minApp`. | Ältere Apps warnen dann, statt Felder still zu verwerfen. |
| **Versionsnummer** in `package.json` erhöhen (Fehlerbehebung → x.y.(z+1), neue Funktion → x.(y+1).0) und in `README.md` unter „Versionen“ eintragen. | Pflicht für jede Änderung an der App; der Workflow `Tests` prüft das. Hat das Original inzwischen eine höhere Version veröffentlicht: Fork synchronisieren und die Nummer darüber setzen. |
| `planner.ts` (Lernplan) und `scheduler.ts` (Lernalgorithmus) nur nach Absprache ändern. | Sie bestimmen, was und wann gelernt wird – Änderungen wirken auf alle Fächer. |
| Keine Unterlagen, Kartenpakete oder Lerndaten committen. | Das Repository ist öffentlich. |

## Übernehmen lassen

Zwei Wege – der Betreuer des Originals entscheidet:

1. **Pull Request** von deinem Fork an `loynx187/lernapp` (je Funktion einer, Checkliste ausfüllen). GitHub prüft dabei automatisch, ob sich die Änderung mit dem aktuellen `main` zusammenführen lässt, und lässt alle Tests **auf dem zusammengeführten Stand** laufen – fehlt eine Grundlage, schlagen Build oder Tests fehl. Gemergt wird nur vom Betreuer selbst.
2. **Nur die Idee:** Ein Issue mit Beschreibung und Link auf deinen Branch genügt. Claude baut die Funktion dann im Original nach und passt sie an.

Ideen ohne Code gern als Issue – gute landen auf der Seite „Ideen für Version 2“.
