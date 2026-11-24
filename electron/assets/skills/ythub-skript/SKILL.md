---
name: ythub-skript
description: Ein YouTube-Skript für einen eigenen Kanal im YT-Hub-Datenordner schreiben oder überarbeiten – aus einer Ideen-Datei, im Stil des Kanals. Nutzen bei Aufträgen vom Typ "Skript schreiben" oder "Skript überarbeiten".
ythub-version: 3
---

# Skript schreiben

## 1. Grundlage
- Ideen-Datei aus dem Auftrag lesen (Hook, Inhalt, Quellen).
- `channel.md` und `style-guide.md` des Kanals: Ton, Ansprache (du/ihr/Sie), typische Länge, Do's & Don'ts.
- Falls vorhanden: Abschnitt `## Learnings` in `channel.md` beachten (z. B. welche Hooks und Längen die Leute halten).
- Wenn der Style-Guide noch leer ist: neutral-locker schreiben und am Ende unter „Hinweise“ vermerken.
- Fakten bei Bedarf per Websuche prüfen. Nichts erfinden.

## 2. Aufbau
1. **Hook (0–15 s):** Versprechen oder Spannung, kein „Hallo und willkommen“.
2. **Kontext:** warum das wichtig ist, für wen.
3. **Hauptteil:** in Kapiteln, jedes mit klarer Kernaussage; alle 60–90 s ein neuer Anreiz (Frage, Wendung, Beispiel).
4. **Schluss:** Zusammenfassung in einem Satz, Handlungsaufforderung passend zum Kanal.

Schreibe **gesprochene Sprache**: kurze Sätze, direkte Ansprache. Regie-Hinweise in eckigen Klammern, z. B. `[B-Roll: …]`, `[Grafik: …]`, `[Schnitt]`.
Shorts: max. ~150 Wörter, Hook im ersten Satz, kein Intro.

## 3. Länge
Sprechtempo ~150 Wörter pro Minute. Ziel-Länge aus dem Auftrag oder `channel.md`. Wortzahl (nur Sprechtext, ohne Regie-Hinweise) und geschätzte Minuten ins Frontmatter.

## 4. Speichern
- **Neues Skript:** `channels/<kanal>/scripts/JJJJ-MM-TT-kurzer-titel.md` nach `skript-vorlage.md`.
- **Überarbeitung:** dieselbe Datei aktualisieren, `version` um 1 erhöhen, vorher die alte Fassung als `…-v<alte-version>.md` daneben sichern. Kommentare/Wünsche aus dem Auftrag gezielt umsetzen, Rest unverändert lassen.
- Im Skript nach dem Schreiben bzw. Überarbeiten immer `status: entwurf` setzen – der Creator gibt es selbst frei.
- In der Ideen-Datei `status: in-arbeit` setzen und im Frontmatter `skript: scripts/<datei>.md` ergänzen.
- `<skript>.comments.json` nie ändern; die Kommentare stehen im Auftrag.

## 5. Ergebnis-Datei
`auftraege/<id>.result.json` mit dem Skript (und ggf. der gesicherten Version) in `outputs` (siehe `CLAUDE.md`).
