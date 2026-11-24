<!-- ythub-version: 3 -->
# YT Hub – Datenordner

Dieser Ordner gehört zur Desktop-App **YT Hub**. Die App legt hier Kanäle an, holt YouTube-Daten und schickt dir
**Aufträge**. Du arbeitest sie ab, indem du Dateien in diesem Ordner schreibst. Die App liest nur Dateien – es gibt
keine andere Verbindung zu ihr. Halte dich deshalb genau an die Formate unten.

## Ordner

```
channels/<kanal>/
  channel.json      Kanaldaten (von der App gepflegt – nur lesen)
  channel.md        Profil: Nische, Zielgruppe, Ton, Formate
  style-guide.md    nur eigene Kanäle: Stilregeln für Skripte
  competitors.json  nur eigene Kanäle: Slugs zugeordneter beobachteter Kanäle
  videos.json       letzte Uploads mit Aufrufen und Ausreißer-Wert (von der App gepflegt – nur lesen)
  analytics.json    nur verbundene eigene Kanäle: YouTube-Analytics-Zahlen (Bindung, Klickrate, Abos) – nur lesen
  ideas/            eine Markdown-Datei pro Idee (status: neu | favorit | in-arbeit | produziert | veroeffentlicht | verworfen)
  scripts/          nur eigene Kanäle: eine Markdown-Datei pro Skript (status: entwurf | ueberarbeitung | fertig);
                    <skript>.comments.json = Kommentare des Creators (nur lesen)
  research/         Recherche-Berichte
auftraege/<id>.md   Aufträge der App
```

`channel.json` → `type` ist `own` (eigener Kanal) oder `watch` (beobachtet). In `videos.json` hat jedes Video
`score` (Aufrufe ÷ Median des Kanals) und `outlier` (`yes` ab 2×, `strong` ab 5×).

## Regeln für jeden Auftrag

1. Lies zuerst die Auftrag-Datei, dann `channel.md` (und bei eigenen Kanälen `style-guide.md`) des Kanals.
2. Nutze den Skill, den der Auftrag nennt.
3. Schreibe nur in den Ordner des Kanals, den der Auftrag nennt, und in `auftraege/`. Ändere nie `channel.json` oder
   `videos.json`.
4. Dateinamen: `JJJJ-MM-TT-kurzer-titel.md`, nur Kleinbuchstaben, Ziffern und Bindestriche (ä→ae, ö→oe, ü→ue, ß→ss).
5. Sprache: die im Auftrag genannte Sprache.
6. **Zum Schluss immer** die Ergebnis-Datei schreiben (auch bei Fehlern), sonst weiß die App nicht, dass du fertig bist:

`auftraege/<id>.result.json`
```json
{
  "status": "fertig",
  "summary": "Ein bis drei Sätze, was du gemacht hast.",
  "outputs": ["channels/<kanal>/ideas/2026-11-24-beispiel.md"]
}
```
`status` ist `fertig` oder `fehler`. `outputs` sind Pfade relativ zu diesem Ordner, mit `/`.
