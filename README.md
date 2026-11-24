# YT Hub

Desktop-App für YouTube-Kanäle: eigene und beobachtete Kanäle verwalten, Ideen recherchieren und Skripte schreiben – mit Aufträgen an Claude Code. Konzept: [KONZEPT.md](KONZEPT.md).

**Stand: 0.6.0** – Cloud-Sync des Datenordners mit Google Drive (Zwei-Wege, Konfliktkopien, abschaltbar); dazu YouTube Analytics für eigene Kanäle (Google-Anmeldung mit eigenem OAuth-Client, Statistik-Tab mit Kennzahlen, Verlauf und Video-Tabelle), Auftrag „Learnings ableiten“, geplante Aufträge mit Desktop-Benachrichtigung, Autostart; dazu Kanal-Seite mit Ideen-Board (Drag & Drop, eigene Ideen, Details), Skript-Ansicht (Sprechdauer, Kommentare an Absätzen, Überarbeiten-Auftrag, Versionen, Bearbeiten), Profil- und Recherche-Tab, automatische Updates (vorbereitet); dazu Aufträge an Claude Code (Ideen recherchieren, Idee aus Video, Skript schreiben, Kanal-Profil, freier Auftrag; im Hintergrund oder im Terminal) mit Auftrags-Liste und Fortschritt, Skills im Datenordner; dazu Willkommens-Assistent, Kanäle per ＋-Knopf (mit YouTube-Abgleich: Name, Bild, Abos, letzte 50 Videos), Feed der beobachteten Kanäle mit Ausreißer-Erkennung, Prüfintervall, Kontingent-Anzeige, Einstellungsseite, Windows-Installer.

## Entwickeln

```powershell
npm install
npm run dev      # Vite + Electron mit Hot-Reload
npm run start    # gebaute Oberfläche in Electron
npm run smoke    # unsichtbarer Testlauf mit eigenem Profil, speichert Screenshots
npm run dist     # Windows-Installer nach release/
```

## Aufbau

```
electron/
  main.cjs       Hauptprozess: Fenster, IPC, Smoke-Test
  preload.cjs    schmale Brücke window.ythub.* zur Oberfläche
  settings.cjs   Einstellungen im Benutzerprofil, YouTube-Key per safeStorage verschlüsselt
  channels.cjs   Kanal-Ordner im Datenordner, Link-/Handle-Erkennung
  checks.cjs     YouTube-Key testen, Claude Code finden
  youtube.cjs    YouTube-Data-API-Client mit Kontingent-Zähler
  sync.cjs       Kanal-Abgleich: Kanaldaten, letzte Uploads (videos.json), Ausreißer
  jobs.cjs       Aufträge: Auftrag-Datei schreiben, Claude Code starten (claude -p / Terminal), Fortschritt, Ergebnis-Datei
  content.cjs    Ideen, Skripte, Recherche, Kommentare lesen/schreiben (nur erlaubte Pfade im Kanal-Ordner)
  google.cjs     Google-Anmeldung (OAuth Desktop, Loopback + PKCE), Tokens verschlüsselt
  analytics.cjs  YouTube-Analytics-Abruf → analytics.json im Kanal-Ordner
  drivesync.cjs  Cloud-Sync mit Google Drive: Abgleich per MD5 gegen den letzten Stand, Konfliktkopien, Papierkorb statt Löschen
  schedules.cjs  geplante Aufträge (auftraege/plaene.json), Nachholen verpasster Termine
  updater.cjs    automatische Updates (electron-updater), aktiv sobald ein publish-Ziel eingerichtet ist
  assets/        CLAUDE.md und Skills (ythub-ideen, ythub-skript, ythub-profil), werden in den Datenordner kopiert
  fake-youtube.cjs  feste Testdaten für npm run smoke (kein Netz, kein Kontingent)
src/renderer/    React-Oberfläche (Dashboard, Plus-Dialog, Einstellungen, Willkommen)
```

## Wo was liegt

- **Einstellungen:** `%APPDATA%/YT Hub/settings.json` – der YouTube-Key nur verschlüsselt, die Oberfläche sieht nur die letzten 4 Zeichen.
- **Daten:** Standard `Dokumente/YTHub` (änderbar) – `channels/<kanal>/`, `auftraege/`, `.claude/skills/`.
- Entfernte Kanäle wandern in den Papierkorb.

## Ausreißer

Jedes Video wird mit dem Median der übrigen Videos desselben Formats im Kanal verglichen (Shorts ≤ 3 Min. mit Shorts, lange Videos mit langen). Nur Videos, die mindestens 3 Tage alt sind, zählen für den Vergleichswert, und es braucht mindestens 5 davon. Ab 2× gilt ein Video als Ausreißer 🔥, ab 5× als starker Ausreißer. Ein Abgleich kostet pro Kanal ca. 3 Einheiten des YouTube-Tageskontingents (10.000).

## Aufträge an Claude Code

1. Die App schreibt `auftraege/<id>.md` in den Datenordner (Typ, Kanal, Skill, Notiz).
2. **Im Hintergrund:** `claude -p "Lies die Datei auftraege/<id>.md …" --output-format stream-json --permission-mode acceptEdits --allowedTools "WebSearch WebFetch Read Write Edit Glob Grep Skill TodoWrite"` im Datenordner. Der Fortschritt erscheint live unter „Aufträge“. Es läuft immer nur ein Hintergrund-Auftrag, weitere warten.
   **Im Terminal:** ein Fenster mit Claude Code und demselben Auftrag – man kann mitreden.
3. Claude nutzt `CLAUDE.md` und den passenden Skill aus `.claude/skills/` und schreibt zum Schluss `auftraege/<id>.result.json` (Status, Zusammenfassung, Ergebnis-Dateien). Daran erkennt die App in beiden Fällen, dass der Auftrag fertig ist.

`npm run smoke` mit `YTHUB_SMOKE_CLAUDE=1` schickt zusätzlich einen echten kleinen Recherche-Auftrag (kostet ca. 0,60 $).

## Releases und automatische Updates

Installer und Updates kommen aus den GitHub Releases von [n3yus/yt-hub](https://github.com/n3yus/yt-hub/releases).
Neue Version veröffentlichen:

1. `version` in `package.json` erhöhen und committen.
2. Passenden Tag anlegen und pushen (GitHub verlangt ihn für veröffentlichte Releases):

```powershell
git tag v0.4.2; git push; git push origin v0.4.2
```

3. Mit angemeldeter GitHub CLI bauen und hochladen:

```powershell
$env:GH_TOKEN = (gh auth token); npm run release
```

4. Prüfen, dass das Release drei Dateien hat (`latest.yml`, `YT-Hub-Setup-<version>.exe`, `.blockmap`). Fehlt etwas, die Dateien aus `release/` nachladen (Installer vorher in `YT-Hub-Setup-<version>.exe` umbenennen):

```powershell
gh release view v0.5.0 --json assets --jq "[.assets[].name]"
```

Installierte Apps prüfen beim Start und alle 6 Stunden, laden Updates im Hintergrund und installieren sie beim nächsten Neustart (oder sofort per Knopf in den Einstellungen).

## Cloud-Sync (Google Drive)

Optional, in den Einstellungen ein- und ausschaltbar. Nutzt den eigenen Google-OAuth-Client (zusätzlich die **Google Drive API** aktivieren) mit dem Recht `drive.file`: YT Hub sieht nur Dateien, die es selbst angelegt hat.

- Synchronisiert den Datenordner mit dem Drive-Ordner „YT Hub Sync“ – beim Start, alle 10 Minuten und nach jedem fertigen Auftrag (nicht, während Claude im Hintergrund schreibt).
- Nicht synchronisiert: `.claude/` (Skills installiert die App), Logs, temporäre Dateien und die YouTube-Caches `videos.json`/`analytics.json` (jeder Rechner holt sie selbst).
- Auf beiden Seiten geändert → die lokale Fassung gewinnt, die Drive-Fassung wird als „… (Konflikt Drive <Datum>).md“ gespeichert. Bei `channel.json` und Auftrags-Dateien gewinnt still die lokale Fassung.
- Gelöschtes wandert in den Papierkorb (lokal bzw. in Drive), nichts wird endgültig gelöscht. Nach einem Wechsel des Datenordners oder Drive-Kontos wird beim ersten Abgleich nichts gelöscht.
