---
name: ythub-ideen
description: Videoideen für einen YouTube-Kanal im YT-Hub-Datenordner recherchieren oder aus einem erfolgreichen Vorbild-Video ableiten und als Ideen-Karten speichern. Nutzen bei Aufträgen vom Typ "Ideen recherchieren" oder "Idee aus Video".
ythub-version: 3
---

# Videoideen recherchieren

## 1. Kanal verstehen
- `channels/<kanal>/channel.md` und `style-guide.md` lesen: Nische, Zielgruppe, Ton, Formate.
- `channels/<kanal>/videos.json`: Was läuft beim eigenen Kanal gut (hoher `score`), was nicht? Shorts und lange Videos getrennt betrachten.
- Falls vorhanden `channels/<kanal>/analytics.json` und der Abschnitt `## Learnings` in `channel.md`: Ideen bevorzugen, die zu dem passen, was nachweislich hält (`avgViewPercent`) und Abos bringt.
- Vorhandene Ideen in `ideas/` überfliegen, um **keine Dubletten** zu erzeugen.

## 2. Quellen
- **Beobachtete Kanäle:** Slugs aus `competitors.json`; falls leer, alle Kanäle mit `"type": "watch"` in `channels/*/channel.json`, die thematisch passen. In deren `videos.json` nach `outlier` suchen – das sind bewiesene Themen.
- **Websuche:** aktuelle Themen, Neuigkeiten, Fragen der Zielgruppe (Foren, Reddit, Q&A), Suchtrends der Nische.
- Nichts erfinden: Zahlen und Fakten nur mit Quelle. Was unsicher ist, als Annahme kennzeichnen.

## 3. Ideen bewerten (je 1–5)
- **Nachfrage** – suchen/schauen Leute danach? (Ausreißer bei Vorbildern, Suchinteresse, Diskussionen)
- **Konkurrenz** – 5 = kaum gute Videos dazu, 1 = übersättigt
- **Passung** – passt zu Nische, Ton und Können des Kanals
- **Aufwand** – 5 = schnell umsetzbar, 1 = sehr aufwendig
- **Gesamt** = Durchschnitt, eine Nachkommastelle

Nur Ideen mit Gesamt ≥ 3,0 speichern. Lieber 5 starke als 15 mittelmäßige.

## 4. Speichern
Pro Idee eine Datei `channels/<kanal>/ideas/JJJJ-MM-TT-kurzer-titel.md` nach `ideen-vorlage.md` in diesem Skill-Ordner.
Status immer `neu`. `auftrag:` = ID des Auftrags.

Bei Aufträgen **„Idee aus Video“**: genau eine bis drei Ideen, die den Kern des Vorbild-Videos (Thema, Hook, Versprechen) auf den eigenen Kanal übertragen – **nicht kopieren**, sondern eigener Blickwinkel. Vorbild-Video unter „Quellen“ nennen.

## 5. Bericht (nur bei „Ideen recherchieren“)
`channels/<kanal>/research/JJJJ-MM-TT-recherche.md`: kurze Zusammenfassung – was läuft in der Nische gerade, welche Muster
haben die Ausreißer, Liste der gespeicherten Ideen mit Gesamtwert, wichtigste Quellen.

## 6. Ergebnis-Datei
`auftraege/<id>.result.json` mit allen geschriebenen Dateien in `outputs` (siehe `CLAUDE.md`).
