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
  "cards": [ ... ]
}
```

| Feld | Bedeutung |
|---|---|
| `id` | Stabile Paket-ID. Gleiche ID = Update desselben Pakets. |
| `version` | Bei jedem Update erhöhen. |
| `chapters` | Reihenfolge der Kapitel = Reihenfolge, in der neuer Stoff eingeführt wird. |

## Karten

Gemeinsame Felder:

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `uid` | ja | **Stabil und eindeutig im Paket.** Über die uid bleibt der Lernfortschritt bei Updates erhalten. Nie wiederverwenden. |
| `type` | – | `basic` (Standard), `cloze`, `mc`, `task` |
| `chapter` | – | ID aus `chapters` |
| `front` | ja | Frage / Aufgabenstellung |
| `back` | – | Antwort bzw. Erklärung |
| `source` | – | `{ "file": "Skript.pdf", "slide": 42 }` |
| `relevance` | – | 1–3, Klausurrelevanz (z. B. aus Altklausuren). Bei Zeitnot werden relevante Karten zuerst eingeführt. |
| `tags` | – | Liste von Schlagwörtern |
| `image` | – | Bild als Daten-URL (`data:image/png;base64,…`), z. B. eine Skizze von der Folie |
| `mode` | – | `mobile` oder `desk`; Standard: `task` → `desk`, sonst `mobile` |

### Typen

- **`basic`** – Frage vorne, Antwort hinten.
- **`cloze`** – Lückentext in `front`: `Das Hookesche Gesetz lautet {{$\sigma = E\varepsilon$}}.` `back` ist optional (Zusatzerklärung).
- **`mc`** – Multiple Choice: `options` (Liste) und `correct` (Indizes ab 0, mehrere möglich). `back` = Erklärung.
- **`task`** – Rechenaufgabe: `front` = Aufgabenstellung mit Zahlenwerten, `steps` = Lösungsschritte (Liste), `result` = Endergebnis, `back` = Hinweise/typische Fehler.

### Textformat

Alle Textfelder unterstützen **Markdown** und Formeln in **LaTeX** (KaTeX):
`$…$` bzw. `\(…\)` im Fließtext, `$$…$$` bzw. `\[…\]` abgesetzt. In JSON müssen Backslashes verdoppelt werden (`"$\\sigma$"`).

## Update-Verhalten

Wird ein Paket mit gleicher `id` erneut importiert:

- Karten mit bekannter `uid` werden inhaltlich aktualisiert, **der Lernfortschritt bleibt**.
- Neue `uid`s kommen als neue Karten dazu und werden in den Lernplan eingeplant.
- Fehlende `uid`s werden archiviert (nicht gelöscht) und tauchen wieder auf, falls sie zurückkommen.
