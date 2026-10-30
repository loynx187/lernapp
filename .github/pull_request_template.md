## Was ändert sich?

<!-- Kurz: welche Funktion oder welcher Fehler, und wie sieht man es in der App? -->

## Checkliste

- [ ] Basiert auf dem aktuellen `main` des Originals (Fork vorher synchronisiert)
- [ ] Eine Funktion pro Pull Request, funktioniert ohne andere, noch nicht übernommene Änderungen
- [ ] Kein neues Datenbankschema (`db.version`) und kein geändertes Dateiformat – neue Daten nur als optionale Felder
- [ ] Neue Lernfunktion hinter einem Schalter (Standard aus) – ohne ihn verhält sich die App unverändert
- [ ] Vorhandene Tests unverändert, neue Tests hinzugefügt (Unit und Browser-Test in `e2e/`)
- [ ] Version in `package.json` erhöht und in `README.md` unter „Versionen“ eingetragen
- [ ] Keine Unterlagen, Kartenpakete oder Lerndaten im Commit

Details: [CONTRIBUTING.md](../CONTRIBUTING.md)
