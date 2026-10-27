"""Berechnet persönliche FSRS-Parameter aus einer Lernapp-Sicherung.

Aufruf:  python scripts/optimize-fsrs.py <lernapp-sicherung.json>
Benötigt: pip install "fsrs[optimizer]"

Gibt die Parameter als kommagetrennte Zahlenreihe aus – diese in der App unter
Einstellungen → Lernalgorithmus einfügen.
"""
import json
import sys
from datetime import datetime, timezone

from fsrs import Optimizer, Rating, ReviewLog


def main(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        backup = json.load(f)
    if backup.get("format") not in ("lernapp-backup", "lernapp-sync"):
        sys.exit("Die Datei ist keine Lernapp-Sicherung.")
    reviews = backup.get("reviews") or backup.get("logs") or []
    card_ids: dict[str, int] = {}
    logs = []
    for r in sorted(reviews, key=lambda r: r["reviewedAt"]):
        cid = card_ids.setdefault(r["cardId"], len(card_ids) + 1)
        logs.append(
            ReviewLog(
                card_id=cid,
                rating=Rating(int(r["rating"])),
                review_datetime=datetime.fromtimestamp(r["reviewedAt"] / 1000, tz=timezone.utc),
                review_duration=int(r.get("durationMs") or 0),
            )
        )
    print(f"{len(logs)} Bewertungen zu {len(card_ids)} Karten", file=sys.stderr)
    if len(logs) < 500:
        print("Hinweis: Unter ca. 1000 Bewertungen sind die Standardparameter meist genauer.", file=sys.stderr)
    params = Optimizer(logs).compute_optimal_parameters()
    print(", ".join(f"{p:.4f}" for p in params))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
