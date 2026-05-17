# Chronell / MailClient — Funktionsprotokoll

Dieses Dokument beschreibt den **aktuellen Funktionsumfang** der Desktop-App. Es dient als Protokoll für Entwicklung, Dokumentation und Release-Planung und wird bei größeren Meilensteinen fortgeschrieben.

| Feld | Wert |
|------|------|
| **Produktname (UI)** | Chronell |
| **Technischer Name / Installer** | MailClient |
| **Version** | **0.9.7** |
| **Stand** | **17. Mai 2026** |
| **App-ID** | `at.kurtsoeser.mailclient` |
| **Zielplattform** | Windows 11 (primär) |
| **Autor** | Kurt Soeser |

> **Hinweis zur Versionierung:** Mit **0.9.7** startet die sichtbare Versionsführung in der App (Einstellungen → Info). Vorher war `package.json` noch auf `0.0.1` — der Funktionsumfang entspricht jedoch bereits einem fortgeschrittenen Vor-1.0-Stand.

---

## Inhaltsverzeichnis

1. [Produktvision](#1-produktvision)
2. [App-Modi und Navigation](#2-app-modi-und-navigation)
3. [Konten und Authentifizierung](#3-konten-und-authentifizierung)
4. [Mail](#4-mail)
5. [Arbeit (Work)](#5-arbeit-work)
6. [Aufgaben (Tasks)](#6-aufgaben-tasks)
7. [Kalender](#7-kalender)
8. [Notizen](#8-notizen)
9. [Personen (Kontakte)](#9-personen-kontakte)
10. [Home-Dashboard](#10-home-dashboard)
11. [Chat](#11-chat)
12. [Regeln und Automatisierung](#12-regeln-und-automatisierung)
13. [Notion-Integration](#13-notion-integration)
14. [Einstellungen und System](#14-einstellungen-und-system)
15. [Datenhaltung, Suche, Sicherheit](#15-datenhaltung-suche-sicherheit)
16. [Technischer Stack](#16-technischer-stack)
17. [Bekannte Abweichungen zur README](#17-bekannte-abweichungen-zur-readme)
18. [Versionshistorie](#18-versionshistorie)

---

## 1. Produktvision

Chronell ist **kein klassischer E-Mail-Client zum bloßen Lesen von Listen**, sondern eine **Desktop-Arbeitszentrale für Zeit und Handlung**:

- E-Mails in **nächste Schritte** verwandeln (ToDos, Snooze, Wiedervorlage, QuickSteps)
- **Microsoft 365** und **Google** in **einem Fenster** kombinieren
- **Lokale SQLite-Datenhaltung** mit **Volltextsuche** auf dem Gerät
- Moderne UI (React, Tailwind, Dark/Light), **DE/EN**

Marketing-Homepage: [kurtsoeser.github.io/Chronell](https://kurtsoeser.github.io/Chronell/) (Quellen: `docs/`).

---

## 2. App-Modi und Navigation

Die App gliedert sich in **acht Hauptmodi** (obere Leiste, Reihenfolge anpassbar):

| Modus | Zweck |
|-------|--------|
| **Home** | Persönliches Dashboard mit konfigurierbaren Kacheln |
| **Mail** | Postfächer, Lesepane, Triage, Compose |
| **Kalender** | Multi-Kalender, Termine, optionale Zeitliste |
| **Aufgaben** | Microsoft To Do + Google Tasks |
| **Arbeit** | Vereinheitlichte Sicht auf Mail-ToDos, Cloud-Tasks und Termine |
| **Personen** | Kontakte (Graph + Google) |
| **Notizen** | Kernnotizen mit Abschnitten, Seiten, Verknüpfungen |
| **Chat** | Microsoft Teams + WhatsApp Web |

**Querschnitt:**

- Globale Suche (Mail, Notizen, Termine, Tasks, Kontakte)
- Globaler **„Neu …“**-Dialog (Mail, Aufgabe, Termin, Notiz, Chat, Kontakt, Regel)
- `ComposerStack`, Snooze-Picker, Cloud-Task-aus-Mail, Notion-Zielauswahl
- Zentraler Dialog-Host (`AppDialogHost`), Toasts, Undo-Pfade
- Ersteinrichtungs-Assistent für OAuth und Konten
- UI-Animationen mit `prefers-reduced-motion`-Unterstützung

**Migrationen alter Modi:** frühere Modi wie `workflow` → `work`, `mega` → Kalender-Zeitliste, `rules` → Mail-Einstellungen → Regeln.

---

## 3. Konten und Authentifizierung

- **Mehrere Konten** parallel (Microsoft 365, Google)
- **Microsoft Graph** (Mail, Kalender, Kontakte, To Do, Teams, …)
- **Google APIs** (Gmail, Calendar, People, Tasks, …)
- Ersteinrichtung mit Browser-OAuth; optional **eigene OAuth-App** (Azure / Google Cloud) unter Einstellungen
- Build-Zeit-Konfiguration über `MAILCLIENT_*`-Umgebungsvariablen; optional Remote-OAuth-JSON
- Pro Konto: Anzeigename, **Akzentfarbe**, Sync-Fenster, Kalender-Vorlauf, Cache-Verwaltung
- **Notion**: interne Integration (Token) oder öffentliche OAuth-Integration

---

## 4. Mail

### Grundfunktionen

- Ordnerbaum pro Konto, Favoriten, **virtualisierte Listen** (react-virtuoso)
- Thread-/Nachrichtenansicht, Lesepane, gelesen/ungelesen, markiert
- **Rich-Text-Compose** (TipTap), Anhänge, Entwürfe, Vorlagen mit Platzhaltern
- **Geplanter Versand** (Warteschlange im Main-Prozess)
- Verschieben, Archivieren, Löschen, Kategorien (Outlook-Masterkategorien)
- **FTS5-Volltextsuche** lokal (Betreff, Body, Metadaten)
- Bilder optional automatisch laden (Einstellung)
- **List-Unsubscribe**-Felder im Datenmodell

### Workflow-Funktionen

- **Mail-ToDos** mit Fälligkeits-Buckets (überfällig, heute, morgen, Woche, später, erledigt)
- Optional **Kalender-Zeiträume** pro Mail-ToDo (Start/Ende)
- **Snooze** — zeitlich ausblenden und zurückholen
- **Waiting for** — Follow-up / „auf Antwort warten“
- **QuickSteps** — konfigurierbare Aktionsketten mit Tastenkürzeln
- **Tags** auf Nachrichten (lokal, per Regeln setzbar)
- **VIP-Absender** pro Konto
- **Meta-Ordner** — virtuelle, kontenübergreifende Such-/Filteransichten
- **Workflow-Ordner** pro Konto (z. B. „In Bearbeitung“ / „Erledigt“) für Triage
- **Rückgängig** über Nachrichtenaktionen (Undo-Store)
- Verknüpfung Mail ↔ **Cloud-Task** (Microsoft To Do / Google Tasks)
- **Notion**: Mail als Block an Notion-Seite senden

### Sidebar & Anzeige

- Sichtbarkeit einzelner Mail-Ordner in der Sidebar (Einstellungen)
- Gefilterte „Markiert“-Ansicht (optional ohne Papierkorb/Junk)

---

## 5. Arbeit (Work)

Das Modul **„Arbeit“** bündelt offene Punkte aus verschiedenen Quellen als **`WorkItem`**:

| Typ | Quelle |
|-----|--------|
| `mail_todo` | Mail-ToDo aus der lokalen DB |
| `cloud_task` | Microsoft To Do / Google Tasks |
| `calendar_event` | Kalendertermin |

- **Listen- und Kanban-Ansicht**
- Vorschau-Panel, Kontextmenüs
- Geplante Arbeitszeiten (`plannedStart` / `plannedEnd`) für Sortierung und Kalender-Zeitliste
- Ersetzt das frühere eigenständige Top-Level-Modul „Workflow“

---

## 6. Aufgaben (Tasks)

- Zentraler Modus für **Microsoft To Do** und **Google Tasks**
- Listen-, **Kanban-** und **Kalender-Ansicht**
- Inline-Erstellung, Detail-Panel, Drag-and-Drop (Fälligkeit / Spalten)
- Dialoge zum Anlegen von Cloud-Tasks (auch aus Mail-Kontext)
- Sync-Status und Cache pro Konto

---

## 7. Kalender

### Ansichten (FullCalendar)

- Tag, Woche, Monat, Jahr, Quartal, Listenwoche
- **N-Tage-Raster** (bis 21 Tage)
- Konfigurierbares **Zeitraster** (z. B. 30-Minuten-Slots), Montag als Wochenstart, Arbeitszeiten 07:00–20:00 (UI)

### Termine

- Multi-Kalender (Microsoft, Google, M365-Gruppenkalender)
- Termin-Dialog inkl. **Serien / Wiederholung**
- Drag & Resize mit Persistenz über Graph/Google
- Sichtbarkeit und Sidebar-Einblendung pro Kalender (Einstellungen)
- Zeitzonen-Unterstützung (Microsoft-Zeitzonenliste)

### Integration

- **Mail-ToDos** und **Cloud-Tasks** im Kalender darstellbar
- Rechte Spalten: optional **Posteingang**, **Vorschau**, **Zeitliste**
- **Zeitliste** (`CalendarTimelinePane`): kombinierte Timeline aus ToDos, Tasks und Terminen; abdockbar
- Notizen an Terminen; Notion-Export von Terminen
- Kalender-Vorlauf pro Konto konfigurierbar (30 Tage bis „alles“)

---

## 8. Notizen

### Notiz-Arten

1. **An Mail** gebunden  
2. **An Kalendertermin** gebunden  
3. **Freistehend** (Kernnotizen)

### Struktur & Bearbeitung

- **Abschnitte** (`NoteSection`): hierarchischer Baum, Icons, Farben, Drag-and-Drop
- **Seiten-Panel**: sortierbare Notizliste pro Kontext, Kopieren/Verschieben
- **Markdown-Editor** (`ObjectNoteEditor` / MD-Komponenten)
- Listen- und **Kalenderansicht** für Notizen; Mini-Monat zur Datumsfilterung
- **Terminplanung** pro Notiz (`scheduledStart` / `End`, Ganztag)
- Volltextsuche in der Notizen-Shell
- **Anhänge**: lokal und Cloud (M365 / OneDrive über Graph)

### Entity-Links (ab 0.9.x)

Bidirektionale Verknüpfungen zwischen:

- Notiz ↔ Notiz  
- Notiz ↔ Mail  
- Notiz ↔ Termin  
- Notiz ↔ Cloud-Task  
- Notiz ↔ **Kontakt**

Picker-Dialog, Panel „Verknüpfte Objekte“, Vorschau, Navigation ins Zielmodul.

### Datenbank / IPC

- `user_notes`, `user_note_entity_links`, `note_sections`
- IPC: `register-notes-ipc.ts`, Repositories im Main-Prozess

---

## 9. Personen (Kontakte)

- Sync **Microsoft Graph** + **Google People**; lokaler SQLite-Cache
- Navigation: Alle, Favoriten, nach Anbieter/Konto
- Sortierung (Vor-/Nachname, Anzeigename); Listen- und Kachelansicht
- Virtualisierte, gruppierte Liste; Drag-and-Drop für Konten-Reihenfolge
- **Detailpanel**: Bearbeiten, Foto, E-Mail/Telefon, Objekt-Notiz, Compose
- **Verknüpfte Notizen** am Kontakt (Entity-Links), Neu-Anlegen mit Sprung ins Notizen-Modul
- Neuer-Kontakt-Dialog, Kontextmenü

---

## 10. Home-Dashboard

- **Freies Pixel-Layout** (v2): ziehen, skalieren, ausblenden, pinnen
- Konfigurierbare **Rasterweite** (Einstellungen → Allgemein)
- Layout-Snapshot / Backup über Einstellungs-Backup

### Eingebaute Kacheln (Auswahl)

| Kachel | Funktion |
|--------|----------|
| Posteingang | Schnellzugriff auf neue Mails |
| ToDo-Buckets | Alle / überfällig / heute / … |
| Warten auf Antwort | Waiting-for-Mails |
| Snooze | Zurückgeholte / schlafende Mails |
| Suche | Globale Suche |
| Kalender | Mini-Woche / Monat |
| Heute-Timeline | Tagesüberblick |
| Fristen | Anstehende Fälligkeiten |
| Wetter | Open-Meteo (Ort in Einstellungen) |
| Uhr / Weltuhr | Zeitanzeige |
| Nächstes Online-Meeting | Aus Kalender |
| Schreibtisch-Notiz | Kurznotiz |
| Compose | Neue Mail |
| **Alle Arbeit** | WorkItems-Überblick |
| **Notizen** | Neu / Übersicht / zuletzt bearbeitet |

- **Benutzerdefinierte Kacheln**: Verknüpfung zu Ordner, Termin oder Mail
- Mail-Kontextmenüs auf dem Dashboard; Sprung in andere Modi

---

## 11. Chat

- **Microsoft Teams** (Graph-Chats, `TeamsChatPanel`)
- **WhatsApp Web** eingebettet (eigener User-Agent)
- **Teams-Chat-Popouts**: abdockbare Fenster, Dock-Leiste, „Always on top“

---

## 12. Regeln und Automatisierung

Visuelle **Regel-Engine** (JSON-Definitionen im Main):

### Bedingungen (Auswahl)

- Absender, Empfänger, Betreff, Body, Anhänge, List-Id  
- Konto, Ordner, Wichtigkeit, Gelesen-Status  
- UND/ODER-Bäume

### Aktionen (Auswahl)

- Verschieben, Tag setzen, gelesen/markiert  
- ToDo anlegen, Snooze (Presets)  
- Weiterleiten, Löschen, Regelausführung stoppen  
- (Konzept: Auto-Antwort)

### Trigger

- Bei Eingang, manuell  
- Ausführungs-Historie (welche Regel auf welche Nachricht)

**Ort in der UI:** Einstellungen → Mail → Regeln (kein eigener Top-Level-Tab mehr).

---

## 13. Notion-Integration

- Mails und Termine als Blöcke an **Notion-Seiten** senden
- **Interne Integration** (Integrations-Token, empfohlen) oder **öffentliche OAuth-Integration**
- Ziele & Favoriten-Verwaltung in den Einstellungen
- Verbindung pro Workspace; Zielseiten müssen mit der Integration geteilt sein

---

## 14. Einstellungen und System

Einstellungen-Dialog (Zahnrad) mit Reitern:

| Reiter | Inhalte |
|--------|---------|
| **Allgemein** | Sprache (DE/EN), Dashboard-Raster, Wetter-Ort, OAuth, Notion, Backup |
| **Konten** | Verbundene Konten, Farben, Sync, Cache leeren, Kalender-Vorlauf |
| **Mail** | Sync-Fenster, Anzeige, Sidebar-Ordner, Triage-Ordner, Kategorien, **Regeln** |
| **Kalender** | Zeitzone, API, Sidebar-Sichtbarkeit |
| **Kontakte** | Hinweise, Sprung zum Personen-Modul |
| **Info** | **Version 0.9.7**, Stand **17. Mai 2026**, Produktname, App-ID |

Weitere Systemfunktionen:

- **Einstellungs-Backup** (Export/Import JSON inkl. localStorage)
- **Lokale Daten** — Speicherverbrauch anzeigen, Cache/DB bereinigen
- **Bulk-Entflaggen** auf dem Server (Dialog)
- Theming Hell / Dunkel / System, Akzentfarben
- Globale Tastenkürzel

---

## 15. Datenhaltung, Suche, Sicherheit

- **SQLite** (`better-sqlite3`) im Main-Prozess: Mails, Metadaten, Kontakte, Notizen, Regeln, …
- **FTS5**-Indexe für schnelle lokale Suche
- **OAuth** über offizielle Flows; Geheimnisse nicht im Repo (`.env.example`)
- **Electron-Sicherheit:** `contextIsolation`, Preload-IPC, keine `nodeIntegration` im Renderer
- Offline-orientiert: Cache + lokale DB; Sync im Hintergrund
- Geplanter Versand, Undo-Pfade für destruktive Aktionen

---

## 16. Technischer Stack

| Schicht | Technologie |
|---------|-------------|
| Desktop | Electron 33 |
| UI | React 18, TypeScript, TailwindCSS, Radix, lucide-react |
| Build | electron-vite (Vite) |
| State | Zustand |
| Listen | react-virtuoso |
| Kalender | FullCalendar 6 |
| Editor | TipTap, MD-Editor |
| DB | better-sqlite3 |
| APIs | @azure/msal-node, Microsoft Graph, Google APIs |
| i18n | i18next (DE, EN) |
| Tests | Vitest |
| Installer | electron-builder (NSIS, Windows x64) |

**Version** wird zentral in `src/shared/app-version.ts` und `package.json` geführt (`app.getVersion()` in Electron).

---

## 17. Bekannte Abweichungen zur README

Die Root-`README.md` beschreibt teils einen älteren Modul-Schnitt. Aktueller Stand:

| README (älter) | Ist-Stand (0.9.7) |
|----------------|-------------------|
| Modul „Workflow“ | Modul **Arbeit** (`work`) |
| Modul „Regeln“ als eigener Tab | **Einstellungen → Mail → Regeln** |
| Notizen: drei Arten | zusätzlich Abschnitte, Seiten, Entity-Links, Anhänge, Kalenderansicht |
| Chat: Teams | Teams **+ WhatsApp Web** + Popouts |
| — | Globale Suche, Notion, erweitertes Dashboard |

Bei Widersprüchen gilt **dieses Funktionsprotokoll**.

---

## 18. Installation (Windows) und Datenmigration

### Installer bauen

```powershell
npm run build:win
```

Ergebnis: `release/<version>/Chronell-<version>-setup.exe` (z. B. `release/0.9.7/Chronell-0.9.7-setup.exe`).

- **NSIS-Installer** deinstalliert bei gleicher `appId` automatisch die **vorherige Programmversion**, bevor die neue installiert wird (`deleteAppDataOnUninstall: false` — **Roaming-Daten bleiben** erhalten).
- Installationspfad (typisch): `%LOCALAPPDATA%\Programs\Chronell\`

### Von `npm run dev` auf die installierte App

| Was | Pfad / Verhalten |
|-----|------------------|
| **Bisher (Dev)** | `%APPDATA%\mailclient\` — DB, OAuth-Tokens, `config.json`, UI-Daten in Chromium |
| **Neu (Chronell)** | `%APPDATA%\Chronell\` |

Beim **ersten Start** (installierte App oder danach auch Dev) kopiert die App einmalig alle relevanten Daten von `mailclient` nach `Chronell` (ohne reine Browser-Caches). Der alte Ordner **bleibt als Backup** liegen.

Marker-Datei nach Migration: `%APPDATA%\Chronell\.chronell-migrated-from-mailclient.json`

**Empfohlene Schritte:**

1. `npm run dev` beenden (alle Chronell-/Electron-Fenster schließen).
2. `Chronell-0.9.7-setup.exe` ausführen und installieren.
3. **Chronell** aus dem Startmenü starten — Migration läuft automatisch.
4. Konten und Einstellungen prüfen; bei Bedarf einmal Sync abwarten.
5. Optional: alten Ordner `C:\Users\<Du>\AppData\Roaming\mailclient` nach erfolgreicher Prüfung löschen (erst wenn alles passt).

---

## 19. Versionshistorie

### 0.9.7 — 17. Mai 2026

- **Windows-Installer** `Chronell-0.9.7-setup.exe`, Produktname Chronell
- **Automatische Datenmigration** `%APPDATA%\mailclient` → `%APPDATA%\Chronell`
- **Erste sichtbare App-Version** in Einstellungen → Info
- `package.json` und `src/shared/app-version.ts` auf **0.9.7** gesetzt
- Dieses **Funktionsprotokoll** angelegt als Referenz des Gesamtstands
- Enthält u. a. den ausgebauten **Notizen**-Bereich mit **Entity-Links**, Modul **Arbeit**, Kalender-**Zeitliste**, erweitertes **Home-Dashboard**, **Personen** mit verknüpften Notizen

### Vor 0.9.7

- Kontinuierliche Entwicklung ohne öffentliche SemVer-Anzeige (`package.json` zuvor `0.0.1`)
- Funktionsumfang entsprach bereits einem umfangreichen Vor-1.0-Produkt (siehe Abschnitte 2–15)

---

*Letzte Aktualisierung dieses Dokuments: 17. Mai 2026 · Version 0.9.7*
