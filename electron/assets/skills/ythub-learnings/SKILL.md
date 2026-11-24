---
name: ythub-learnings
description: Aus den YouTube-Zahlen eines eigenen Kanals im YT-Hub-Datenordner (analytics.json, videos.json) ableiten, was funktioniert, und die Erkenntnisse ins Kanal-Profil und den Style-Guide schreiben. Nutzen bei Aufträgen vom Typ "Learnings ableiten".
ythub-version: 3
---

# Learnings ableiten

## 1. Zahlen lesen
- `analytics.json` (nur wenn der Kanal mit YouTube Analytics verbunden ist):
  - `last28` / `prev28`: Aufrufe, Wiedergabezeit, Abos gewonnen/verloren – Trend?
  - `videos[]` (letzte 90 Tage): `views`, `avgViewPercent` (durchschnittlich angesehener Anteil), `avgViewDurationSec`, `subscribersGained`, ggf. `impressions` und `ctr` (Klickrate der Thumbnails in %).
- `videos.json`: Titel, Länge, Format (`isShort`), öffentliche Aufrufe, `score` (Aufrufe ÷ Median des Kanals).
- Ohne `analytics.json`: nur mit `videos.json` arbeiten und das im Ergebnis sagen.

## 2. Muster finden
Vergleiche die besten mit den schwächsten Videos – getrennt nach Shorts und langen Videos:
- **Klick (CTR / score):** Welche Titel-Formeln, Themen, Versprechen ziehen?
- **Bindung (avgViewPercent):** Welche Längen, Hooks, Strukturen halten die Leute?
- **Wachstum (subscribersGained pro 1.000 Aufrufe):** Welche Videos bringen Abos?
Nur Muster aufschreiben, die mindestens 2–3 Videos stützen. Konkrete Videos als Beleg nennen (Titel + Zahl).

## 3. Schreiben
In `channel.md` den Abschnitt `## Learnings` anlegen oder ersetzen:

```
## Learnings
_Stand: JJJJ-MM-TT, Grundlage: letzte 90 Tage_

- **Was zieht:** … (Beleg: „Titel“ 3,1× Median, CTR 7,8 %)
- **Was hält:** …
- **Was Abos bringt:** …
- **Was nicht funktioniert:** …
- **Nächste Experimente:** 2–3 konkrete Vorschläge
```

Andere Abschnitte von `channel.md` nicht verändern. In `style-guide.md` nur Regeln ergänzen oder schärfen, die die Zahlen klar belegen; kennzeichne neue Regeln mit „(aus Learnings JJJJ-MM-TT)“.

## 4. Ergebnis-Datei
`auftraege/<id>.result.json` mit den geänderten Dateien in `outputs` (siehe `CLAUDE.md`). In `summary` die wichtigste Erkenntnis in einem Satz.
