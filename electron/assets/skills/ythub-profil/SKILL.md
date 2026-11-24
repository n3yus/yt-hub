---
name: ythub-profil
description: Kanal-Profil (channel.md) und bei eigenen Kanälen den Style-Guide (style-guide.md) für einen Kanal im YT-Hub-Datenordner aus seinen Videos ableiten. Nutzen bei Aufträgen vom Typ "Kanal-Profil entwerfen".
ythub-version: 3
---

# Kanal-Profil entwerfen

## 1. Material
- `channel.json` (Name, Beschreibung, Abos), `videos.json` (Titel, Längen, Aufrufe, Ausreißer).
- Die vorhandene `channel.md`: Was der Benutzer selbst eingetragen hat (z. B. Nische), **bleibt erhalten** und wird nur ergänzt.
- Websuche/WebFetch zur Kanalseite und zu 2–3 Top-Videos (Titel, Beschreibung), wenn verfügbar.

## 2. channel.md
Abschnitte (bestehende Überschriften beibehalten):
- **Nische** – ein Satz, so konkret wie möglich
- **Zielgruppe** – wer, Vorwissen, was sie wollen
- **Ton & Stil** – Ansprache, Tempo, Humor, Bildsprache
- **Formate** – lang/Shorts, typische Längen, wiederkehrende Serien, Upload-Rhythmus
- eigene Kanäle: **Do's & Don'ts**; beobachtete Kanäle: **Was macht diesen Kanal erfolgreich?** (Muster der Ausreißer: Themen, Titel-Formeln, Hooks)

## 3. style-guide.md (nur eigene Kanäle)
- Hook-Muster mit 2–3 Beispielen aus erfolgreichen Titeln
- Sprache: du/ihr/Sie, Satzlänge, Lieblingswendungen, Tabu-Wörter
- Struktur eines typischen Videos
- Titel- und Thumbnail-Regeln

Unsichere Punkte mit „(Annahme)“ kennzeichnen, damit der Benutzer sie prüft.

## 4. Ergebnis-Datei
`auftraege/<id>.result.json` mit den geänderten Dateien in `outputs` (siehe `CLAUDE.md`).
