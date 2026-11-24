# YT Hub – erste Übersicht

> Stand: 24.11.2026 · Entwurf zum Diskutieren, noch nichts gebaut

## 1. Idee in einem Satz

Ein lokaler Hub, in dem jeder YouTube-Kanal ein eigenes „Zuhause“ hat (Identität, Zielgruppe, Ideen, Skripte, Performance), und in dem Claude Code mit genau diesem Kanal-Kontext **Videoideen recherchiert** und **Skripte schreibt**.

```
 Kanal wählen ──► Ideen recherchieren ──► Idee auswählen ──► Skript schreiben
      ▲                                                             │
      └──── Performance / Learnings fließen zurück ◄── veröffentlicht ◄┘
```

## 2. Kanäle: leerer Start, Hinzufügen per Plus-Knopf

Der Hub startet **ohne Kanäle**. Das Dashboard zeigt nur eine leere Fläche mit einem **＋ Kanal hinzufügen**-Knopf.

Der Plus-Knopf öffnet einen kurzen Dialog:

| Feld | Pflicht | Zweck |
|---|---|---|
| YouTube-Link oder `@Handle` | ja | Kanal eindeutig finden; Name, Bild, Abos, letzte Videos werden über die YouTube API automatisch geholt |
| Anzeigename | nein | wird sonst vom Kanal übernommen |
| Art | ja | **Eigener Kanal** (Skripte schreiben) oder **Beobachten** (nur überwachen und als Inspiration/Konkurrenz für die Recherche) |
| Kurzbeschreibung / Nische | nein | Startpunkt für das Kanal-Profil |

Nach dem Speichern:
1. Der Hub legt den Kanal-Ordner an (siehe unten).
2. Optional: Claude entwirft aus den letzten Videos ein erstes Profil (`channel.md`), das du korrigierst.
3. Beobachtete Kanäle lassen sich einem eigenen Kanal als Vergleichskanal zuordnen.

Kanäle lassen sich später bearbeiten, archivieren oder entfernen.

## 3. Grundprinzip: Dateien sind die Datenbank

Alles liegt als **Markdown + JSON** im Dateisystem. Vorteil: Claude Code kann alles direkt lesen und schreiben, die App zeigt es nur schön an. Kein Sync-Problem, alles versionierbar mit git.

```
<Datenordner>/          # in den Einstellungen wählbar, Standard: Dokumente/YTHub
  channels/             # beim Start leer – jeder Plus-Klick legt hier einen Ordner an
    <kanal-slug>/
      channel.json      # Link, Handle, YouTube-ID, Art (eigen/beobachten), hinzugefügt am
      channel.md        # Identität: Nische, Zielgruppe, Ton, Formate, Länge, Do's & Don'ts
      style-guide.md    # nur eigene Kanäle: Hook-Muster, Sprache, Struktur
      competitors.json  # zugeordnete beobachtete Kanäle
      ideas/            # eine Datei pro Idee (Status, Score, Quellen)
      scripts/          # nur eigene Kanäle: eine Datei pro Skript
      research/         # Recherche-Berichte mit Datum
      stats.json        # Kennzahlen aus der YouTube API (Cache)
  auftraege/            # Aufträge an Claude Code (eine Datei pro Auftrag)
  .claude/skills/       # Hub-Skills: research, script, review …

YTHub/ (Programm, wird veröffentlicht)
  app/                  # Electron-App (Oberfläche + Hauptprozess), Installer-Build
```

## 4. Kernfunktionen

### A. Kanäle & Profile
- Hinzufügen per Plus-Knopf (siehe Abschnitt 2)
- Steckbrief pro Kanal: Nische, Zielgruppe, Tonalität, typische Videolänge, Long-Form vs. Shorts
- Style-Guide für eigene Kanäle (Claude kann ihn aus vorhandenen Videos ableiten)

### B. Überwachen
- Neue Uploads der beobachteten Kanäle erscheinen in einem Feed
- Markierung von **Ausreißern** (Video läuft deutlich besser als der Kanal-Schnitt)
- Ein Klick: „Daraus Idee für Kanal X machen“

### C. Ideen-Recherche (mit Claude)
- **Quellen:** beobachtete Kanäle, Websuche, YouTube Data API, Kommentare der eigenen Videos, Google Trends, Reddit
- **Ergebnis:** Ideen-Karten mit Titelvorschlägen, Hook, Begründung („warum jetzt?“), Quellen und Score (Nachfrage · Konkurrenz · Passung zum Kanal · Aufwand)
- **Backlog/Board:** Neu → Favorit → In Arbeit → Produziert → Veröffentlicht / Verworfen
- Optional: wöchentliche automatische Recherche pro Kanal (geplanter Task)

### D. Skript-Werkstatt (mit Claude, nur eigene Kanäle)
- Aus einer Idee: Gliederung → Rohfassung → Überarbeitung, immer mit Kanal-Profil + Style-Guide als Kontext
- Bausteine: Hook-Varianten, Titel- & Thumbnail-Ideen, Kapitelmarken, Beschreibung & Tags
- Feedback-Schleife: Kommentare an Absätze, Claude überarbeitet gezielt
- Prüfungen: Sprechdauer (Wörter → Minuten), Hook in den ersten 15 s, Wiederholungen

### E. Performance-Rückkanal (später)
- Views, CTR, Wiedergabedauer pro Video aus YouTube Analytics
- Learnings landen im Kanal-Profil („Videos mit Frage-Hook laufen 30 % besser“) → bessere nächste Recherche

## 5. Aufträge an Claude Code (kein Chat in der App)

Die App hat **keinen eigenen Chat**. Stattdessen schickt man aus der App einen **Auftrag** an Claude Code los. Claude Code arbeitet ihn auf dem Rechner des Benutzers ab und schreibt die Ergebnisse als Dateien in den Datenordner – die App zeigt sie dann an.

**Ablauf eines Auftrags**

```
 Knopf in der App ──► Auftrag-Dialog ──► Auftrag-Datei ──► Claude Code ──► Ergebnis-Dateien ──► App zeigt Ergebnis
 („Ideen recherchieren“)  (Kanal, Ziel,      im Datenordner     (läuft lokal)    (ideas/, scripts/, …)
                          Notiz, Vorlage)
```

**Auftragsarten (Vorlagen)**

| Auftrag | Startet von | Ergebnis |
|---|---|---|
| Ideen recherchieren | Kanal-Seite | neue Ideen-Karten in `ideas/` + Bericht in `research/` |
| Idee aus Video ableiten | Feed (Ausreißer) | Ideen-Karte mit Bezug auf das Vorbild-Video |
| Kanal-Profil entwerfen | nach dem Hinzufügen | `channel.md` / `style-guide.md` |
| Skript schreiben | Ideen-Detail | neues Skript in `scripts/` |
| Skript überarbeiten | Skript-Editor (mit Kommentaren) | neue Skript-Version |
| Freier Auftrag | überall | was im Textfeld steht, mit Kanal-Kontext |

Im Dialog kann man vor dem Absenden eine **eigene Notiz** ergänzen („Fokus auf Shorts“, „lockerer Ton“).

**Wie der Auftrag Claude Code erreicht**
- Die App schreibt den Auftrag als Datei nach `<Datenordner>/auftraege/<datum>-<art>.md` (Kanal, Ziel, Notiz, welche Dateien Claude lesen soll, wohin das Ergebnis gehört).
- Zwei Arten zu starten, in den Einstellungen wählbar:
  - **Im Hintergrund:** Die App startet `claude -p` (Claude Code ohne Chatfenster) im Datenordner. Status in der App: *wartet → läuft → fertig / Fehler*, mit Protokoll zum Aufklappen.
  - **In Claude Code öffnen:** Die App öffnet ein Terminal mit Claude Code und dem Auftrag als erster Nachricht – für Aufträge, bei denen man mitreden will.
- Eine **Auftrags-Liste** zeigt alle laufenden und erledigten Aufträge; fertige Ergebnisse sind direkt verlinkt.
- Die Hub-Skills (`research`, `script`, …) liegen im Datenordner unter `.claude/skills/`, damit Claude Code bei jedem Auftrag dieselben Regeln und Vorlagen nutzt.

**Voraussetzung beim Benutzer:** Claude Code ist installiert und angemeldet. Die App bringt kein Claude mit und speichert keinen Anthropic-Key. Die Einstellungsseite erkennt, ob `claude` gefunden wird, und zeigt sonst eine Installationsanleitung.

## 6. Einstellungen & Veröffentlichung

Das Programm soll veröffentlicht werden. Darum bringt es **keine eigenen Schlüssel mit**: Jeder Benutzer trägt seinen eigenen YouTube-API-Key auf einer Einstellungsseite ein.

**Einstellungsseite**

| Einstellung | Details |
|---|---|
| YouTube-API-Key | Eingabefeld (verdeckt, mit „anzeigen“), Knopf **Testen** prüft den Key mit einer günstigen API-Abfrage, Statusanzeige (gültig / ungültig / Kontingent aufgebraucht), Link zur Anleitung „So bekommst du einen Key“ |
| Claude Code | Status „gefunden / nicht gefunden“ (mit Pfad), Standard-Startart für Aufträge (Hintergrund / in Claude Code öffnen) |
| Datenordner | wo die Kanal-Ordner liegen (Standard: `Dokumente/YTHub`) |
| Prüfintervall | wie oft beobachtete Kanäle auf neue Videos geprüft werden |
| Sprache | Oberfläche und Standardsprache für Skripte |

**Regeln für die Veröffentlichung**
- Der Key wird **nur lokal** gespeichert, im Benutzerprofil (`%APPDATA%/YTHub/`) und verschlüsselt über die Schlüsselablage des Betriebssystems (Electron `safeStorage`) – nie im Programmordner, nie im Datenordner, nie im git-Repo.
- Der Key verlässt den Rechner nur in Richtung Google-API; die Oberfläche bekommt ihn nach dem Speichern nie wieder im Klartext (nur `••••abcd`).
- Ohne Key funktioniert der Hub trotzdem: Kanäle lassen sich anlegen, Aufträge schicken; Funktionen, die die API brauchen, zeigen einen Hinweis mit Link zur Einstellungsseite.
- Erster Start: kurzer Einrichtungs-Assistent (Datenordner → YouTube-Key → Claude Code prüfen).
- `.gitignore` sorgt dafür, dass nie ein echter Key mit veröffentlicht wird.
- Kontingent im Blick behalten: Die YouTube Data API hat ein Tageskontingent (Standard 10.000 Einheiten); der Hub cacht Ergebnisse und zeigt den ungefähren Verbrauch an.

## 7. Technik: Desktop-App mit Installer

- **Rahmen:** **Electron** – passt zum Node-Backend, kann Claude Code als Prozess starten, Terminals öffnen und Dateien beobachten
- **Oberfläche:** Vite + React im Electron-Fenster
- **Hauptprozess (Node):** liest/schreibt Datenordner und Einstellungen, ruft die YouTube API ab (der Key bleibt hier), startet und überwacht Aufträge, beobachtet Ergebnis-Dateien
- **Installer:** `electron-builder` → Windows-Installer (`.exe`, NSIS), später auch macOS (`.dmg`) und Linux (`.AppImage`)
- **Updates:** automatische Updates über GitHub Releases (`electron-updater`)
- **YouTube:** YouTube Data API v3 (Key des Benutzers), später YouTube Analytics API (OAuth, eigene Kanäle)
- **Hinweis:** Ohne Code-Signatur zeigt Windows beim Installieren eine SmartScreen-Warnung; ein Signatur-Zertifikat kann später dazukommen

## 8. Bildschirme

1. **Dashboard** – leer mit ＋-Knopf; danach alle Kanäle als Karten (eigene und beobachtete getrennt): offene Ideen, Skripte in Arbeit, letzter Upload
2. **Kanal hinzufügen** – Dialog hinter dem ＋-Knopf
3. **Kanal** – Profil, Ideen-Board (Kanban), Skripte, Recherche-Berichte, zugeordnete Vergleichskanäle
4. **Feed** – neue Videos der beobachteten Kanäle, Ausreißer hervorgehoben
5. **Ideen-Detail** – Begründung, Quellen, Vergleichsvideos, Auftrag „Skript schreiben“
6. **Skript-Ansicht** – Text mit Kommentaren an Absätzen, Sprechdauer, Versionen, Auftrag „Überarbeiten“
7. **Aufträge** – laufende und erledigte Aufträge an Claude Code mit Status und Ergebnis-Links
8. **Einstellungen** – YouTube-API-Key mit Testen-Knopf, Claude-Code-Status, Datenordner, Prüfintervall, Sprache

## 9. Fahrplan

| Phase | Inhalt |
|---|---|
| **0** | Electron-Grundgerüst mit Installer, leeres Dashboard, ＋-Dialog, Kanal-Ordner anlegen, Einstellungsseite mit API-Key |
| **1** | YouTube-API: Kanaldaten beim Hinzufügen holen, Uploads der beobachteten Kanäle, Ausreißer |
| **2** | Aufträge: Auftrag-Dialog, Start von Claude Code, Auftrags-Liste, Skills `research` und `script` |
| **3** | Ideen-Board, Skript-Ansicht mit Kommentaren, automatische Updates |
| **4** | Analytics-Rückkanal, geplante Aufträge (z. B. wöchentliche Recherche) |

## 10. Offene Fragen

1. Welches Standard-Prüfintervall für beobachtete Kanäle (beim Öffnen der App, täglich …)?
2. Soll der Installer zum Start nur für Windows gebaut werden?
3. Name der App – bleibt es bei „YT Hub“?
