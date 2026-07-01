# Chronell / MailClient — Funktionsprotokoll

Dieses Dokument beschreibt den **aktuellen Funktionsumfang** der Desktop-App. Es dient als Protokoll für Entwicklung, Dokumentation und Release-Planung und wird bei größeren Meilensteinen fortgeschrieben.

| Feld | Wert |
|------|------|
| **Produktname (UI)** | Chronell |
| **Technischer Name / Installer** | MailClient |
| **Version** | **0.9.31** |
| **Stand** | **22. Juni 2026** |
| **App-ID** | `at.kurtsoeser.chronell` |
| **Zielplattform** | Windows 11 (primär) |
| **Autor** | Kurt Soeser |

> **Hinweis zur Versionierung:** Sichtbare Version in Einstellungen → Info (`src/shared/app-version.ts`, synchron mit `package.json`).

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
9. [Verbindungen](#9-verbindungen)
10. [Personen (Kontakte)](#10-personen-kontakte)
11. [Home-Dashboard](#11-home-dashboard)
12. [Chat](#12-chat)
13. [Regeln und Automatisierung](#13-regeln-und-automatisierung)
14. [Notion-Integration](#14-notion-integration)
15. [Einstellungen und System](#15-einstellungen-und-system)
16. [Datenhaltung, Suche, Sicherheit](#16-datenhaltung-suche-sicherheit)
17. [Technischer Stack](#17-technischer-stack)
18. [Bekannte Abweichungen zur README](#18-bekannte-abweichungen-zur-readme)
19. [Installation (Windows) und Datenmigration](#19-installation-windows-und-datenmigration)
20. [Versionshistorie](#20-versionshistorie)

---

## 1. Produktvision

Chronell ist **kein klassischer E-Mail-Client zum bloßen Lesen von Listen**, sondern eine **Desktop-Arbeitszentrale für Zeit und Handlung**:

- E-Mails in **nächste Schritte** verwandeln (ToDos, Snooze, Wiedervorlage, QuickSteps)
- **Microsoft 365** und **Google** in **einem Fenster** kombinieren
- **Lokale SQLite-Datenhaltung** mit **Volltextsuche** auf dem Gerät
- **Fluent-2-Oberfläche** (Mica, Acrylic, Smoke, Design-Presets), React, Tailwind, Dark/Light, **DE/EN**

Marketing-Homepage: [chronell.app](https://chronell.app/) (Quellen: `docs/`).

---

## 2. App-Modi und Navigation

Die App gliedert sich in **zehn Hauptmodi** (obere Leiste, Reihenfolge anpassbar):

| Modus | Zweck |
|-------|--------|
| **Home** | Persönliches Dashboard mit konfigurierbaren Kacheln |
| **Mail** | Postfächer, Lesepane, Triage, Compose |
| **Kalender** | Multi-Kalender, Termine, Zeitliste, Gantt |
| **Bookings** | Microsoft Bookings — Buchungsseiten, Leistungen, Termine |
| **Aufgaben** | Microsoft To Do + Google Tasks |
| **Arbeit** | Vereinheitlichte Sicht auf Mail-ToDos, Cloud-Tasks und Termine; Workflow-Threads |
| **Personen** | Kontakte (Graph + Google) |
| **Notizen** | Kernnotizen mit Abschnitten, Seiten, Entity-Links |
| **Verbindungen** | Graph aller Objekt-Verknüpfungen, Palette, KI-Scan, Layout |
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
- **Microsoft Graph** (Mail, Kalender, Kontakte, To Do, Teams, …); **MSAL-Cache** und Token-Lock für stabilere Anmeldung (0.9.21)
- **Google APIs** (Gmail, Calendar, People, Tasks, …)
- Ersteinrichtung mit Browser-OAuth; optional **eigene OAuth-App** (Azure / Google Cloud) unter Einstellungen
- Build-Zeit-Konfiguration über `MAILCLIENT_*`-Umgebungsvariablen; optional Remote-OAuth-JSON
- Pro Konto: Anzeigename, **Akzentfarbe**, Sync-Fenster, Kalender-Vorlauf, Cache-Verwaltung
- **Notion**: interne Integration (Token) oder öffentliche OAuth-Integration

---

## 4. Mail

### Grundfunktionen

- Ordnerbaum pro Konto, Favoriten, **virtualisierte Listen** (react-virtuoso)
- Thread-/Nachrichtenansicht, **Lesepane** (Kontext-Speicher für Verbindungen/Vorschau; Konversations-Vorschau, 0.9.20), gelesen/ungelesen, markiert
- **Mehrfachauswahl** (0.9.21): Checkboxen in der Mail-Liste, Aktionsleiste (Archivieren, Löschen, Gelesen/Ungelesen, Kennzeichnen, Verschieben, ToDo, Snooze) für die gesamte Auswahl
- **ToDo-Thread-Cache** (0.9.21): schnellere Anzeige, wenn ein Thread bereits Mail-ToDos hat
- **Link-Farben** in Editor und Lesevorschau (0.9.21): lesbare Hyperlinks in Hell- und Dunkelmodus
- **Lesevorschau-Zoom** (Strg+Mausrad, Strg+Plus/Minus, Pinch; Standard in Einstellungen)
- **Composer** (0.9.20): modularer Aufbau, Pop-out-Fenster, **TipTap**-Editor mit Hell/Dunkel-Theme
- **Absender:** Hauptkonto, Alias, freigegebenes Postfach (M365); **Nachrichtenoptionen** (Vertraulichkeit, Lese-/Zustellungsbestätigung, geplanter Versand)
- **Textbausteine** im Composer; Signaturvorlagen wie zuvor
- **Anhänge:** lokal + **OneDrive / SharePoint** als Cloud-Link-Anhang oder Freigabe-Link im Text (Explorer, Favoriten, Link-Berechtigungen und Ablauf)
- **Gruppen-Empfänger** (0.9.22): Suche mail-aktivierter Microsoft-365-Gruppen im Composer über erweiterten Graph-Query (`ConsistencyLevel: eventual`)
- Entwürfe, Vorlagen mit Platzhaltern
- **Geplanter Versand** (Warteschlange im Main-Prozess; im Composer konfigurierbar)
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
- **Meta-Ordner** — virtuelle, kontenübergreifende Such-/Filteransichten; **0.9.23:** visueller Regel-Editor mit Ausdrucks-Builder (UND/ODER, Felder, Operatoren)
- **Kategorie-Favoriten** (0.9.23): häufig genutzte Mail-Kategorien in der Sidebar schneller erreichbar
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
- **Wiederholung / Serien** für Cloud-Tasks (0.9.21): M365 nativ über Graph; Google lokal in der App gespeichert
- Dialoge zum Anlegen von Cloud-Tasks (auch aus Mail-Kontext)
- Sync-Status und Cache pro Konto

---

## 7. Kalender

### Ansichten (FullCalendar)

- Tag, Woche, Monat, Jahr, Quartal, Listenwoche
- **N-Tage-Raster** (bis 21 Tage)
- Konfigurierbares **Zeitraster** (z. B. 30-Minuten-Slots), Montag als Wochenstart, Arbeitszeiten 07:00–20:00 (UI)

### Termine

- Multi-Kalender (Microsoft, Google, **M365-Gruppenkalender**)
- **Gruppenkalender** (0.9.22): Laden über `transitiveMemberOf` mit Fallback auf `memberOf` (direkte Mitgliedschaften); Advanced-Query-Header; klarere Fehlermeldungen bei fehlendem `GroupMember.Read.All`
- **ICS-Import** (0.9.23): `.ics`-Dateien per Drag & Drop oder Dialog importieren — einzelne oder mehrere Termine in M365-/Google-Kalender anlegen
- Termin-Dialog inkl. **Serien / Wiederholung** (0.9.21: überarbeiteter Dialog, klarere Felder, Termin aus Topbar); **0.9.23:** einheitlicher Chronell-Datums-Picker
- Drag & Resize mit Persistenz über Graph/Google
- Sichtbarkeit und Sidebar-Einblendung pro Kalender (Einstellungen)
- Zeitzonen-Unterstützung (Microsoft-Zeitzonenliste)

### Integration

- **Mail-ToDos** und **Cloud-Tasks** im Kalender darstellbar
- Rechte Spalten: optional **Posteingang**, **Vorschau**, **Zeitliste**
- **Termin- und Cloud-Task-Vorschau** in der rechten Spalte (erweiterte Detailansicht, 0.9.19)
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
- **WYSIWYG-Editor** (TipTap, wie Mail/Kalender): Formatierung, Checklisten, interne `[[Seitenlinks]]`, Hell/Dunkel
- **Seitenvorlagen** (Meeting, Projekt, Wochenplan, Checkliste)
- Listen- und **Kalenderansicht** für Notizen; Mini-Monat zur Datumsfilterung
- **Terminplanung** pro Notiz (`scheduledStart` / `End`, Ganztag)
- Volltextsuche in der Notizen-Shell
- **Anhänge**: lokal und Cloud (M365 / OneDrive über Graph)

### Entity-Links

Bidirektionale Verknüpfungen zwischen Notiz, Mail, Mail-ToDo, Termin, Cloud-Task und Kontakt — Picker in Notizen/Mail, zentral im Modul **Verbindungen** (siehe Abschnitt 9).

### Datenbank / IPC

- `user_notes`, `user_note_entity_links`, `note_sections`
- IPC: `register-notes-ipc.ts`, Repositories im Main-Prozess

---

## 9. Verbindungen

Eigenes Top-Level-Modul **Verbindungen** (`ConnectionsShell`): interaktiver **Graph** aller lokal gespeicherten Entity-Links.

### Graph & UI

- **Knoten:** Notiz, E-Mail, Mail-ToDo, Termin, Cloud-Task, Kontakt
- **Kanten:** manuell per Drag vom Knoten-Handle; Verbindungsarten filterbar
- **Palette** links: Objekte suchen und auf Canvas ziehen
- **Gruppierung:** nach Konto, Objektart, Insel, Zeit (Monat/Woche/Jahr), Domain, Firma, Kalender-/Task-Liste
- **Layout:** zoomen, fit view, Inseln verschieben, Anordnung speichern
- **Dichte:** Anzeige „% Mails ohne Verbindung“ mit Scan-Empfehlung
- **Vorschau-Dock** des gewählten Objekts (inkl. **Notiz-Vorschau** im Graph); **Mini-Graph** im Kontext (Mail, Termine, Notizen); **Kontextmenü** am Knoten; Sprung ins Zielmodul

### KI-gestützte Verbindungen

- **Provider:** Gemini, OpenAI, **Ollama (lokal)** — API-Keys im Secure Store
- **Vorschläge:** Einzelobjekt und **Mehrfach-Scan** (Insel, Auswahl im Graph)
- **Datenschutz:** Standard nur Metadaten (Betreff, Namen, Daten); Textauszüge max. 500 Zeichen nur mit `snippetMode` / Consent-Dialog
- **Retrieval:** Heuristik (Zeitfenster, Domain, Betreff) + optional **Embeddings** (Ollama `/api/embed`, SQLite `entity_embeddings`)
- **Qualität:** bestehende Kanten bewerten (`strong` / `moderate` / `weak` / `questionable`) — keine Auto-Löschung
- **Audit-Log** in Einstellungen; verworfene Vorschläge in Settings-Sicherung
- **Proaktive Hinweise:** Badges in Mail-Liste und am Graph (heuristisch / letzter Scan)
- **Workflow:** aus Modul „Alle Arbeit“ → „Verbindungen mit KI prüfen“; Graph-Kontextmenü startet Scan

**Ort in der UI:** Einstellungen → **KI-Verbindungen**; Haupt-UI: Modus **Verbindungen**.

**Code:** `src/main/ai/`, `src/shared/ai-connections.ts`, `src/renderer/src/app/connections/`

---

## 10. Personen (Kontakte)

- Sync **Microsoft Graph** + **Google People**; lokaler SQLite-Cache
- Navigation: Alle, Favoriten, nach Anbieter/Konto
- Sortierung (Vor-/Nachname, Anzeigename); Listen- und Kachelansicht
- Virtualisierte, gruppierte Liste; Drag-and-Drop für Konten-Reihenfolge
- **Detailpanel**: Bearbeiten, Foto, E-Mail/Telefon, Objekt-Notiz, Compose
- **Verknüpfte Notizen** am Kontakt (Entity-Links), Neu-Anlegen mit Sprung ins Notizen-Modul
- Neuer-Kontakt-Dialog, Kontextmenü

---

## 11. Home-Dashboard

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

## 12. Chat

- **Microsoft Teams** (Graph-Chats, `TeamsChatPanel`)
- **WhatsApp Web** eingebettet (eigener User-Agent)
- **Teams-Chat-Popouts**: abdockbare Fenster, Dock-Leiste, „Always on top“

---

## 13. Regeln und Automatisierung

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

## 14. Notion-Integration

- Mails und Termine als Blöcke an **Notion-Seiten** senden
- **Interne Integration** (Integrations-Token, empfohlen) oder **öffentliche OAuth-Integration**
- Ziele & Favoriten-Verwaltung in den Einstellungen
- Verbindung pro Workspace; Zielseiten müssen mit der Integration geteilt sein

---

## 15. Einstellungen und System

Einstellungen-Dialog (Zahnrad) mit Reitern:

| Reiter | Inhalte |
|--------|---------|
| **Allgemein** | Sprache (DE/EN), Dashboard-Raster, Wetter-Ort, OAuth, Notion, **Cloud-Sync**, **Backup** (manuell + Auto-Backup, Inhaltsvorschau) |
| **Konten** | Verbundene Konten, Farben, Sync, Cache leeren, Kalender-Vorlauf |
| **Mail** | Sync-Fenster, Anzeige, Sidebar-Ordner, Triage-Ordner, Kategorien, **Regeln** |
| **Kalender** | Zeitzone, API, Sidebar-Sichtbarkeit |
| **Kontakte** | Hinweise, Sprung zum Personen-Modul |
| **KI-Verbindungen** | Provider (Gemini/OpenAI/Ollama), Snippet-Modus, Scan-Profile, Audit-Log, Embeddings |
| **Oberfläche** | Design-Presets (Fluent, Midnight, Nord, …), L0–L3-Oberflächenfarben, Hell/Dunkel |
| **Info** | Version **0.9.23**, Stand **26. Mai 2026**, Produktname, App-ID |

### Fluent-2-Oberfläche (ab 0.9.17)

- **Mica**-App-Hintergrund, **Acrylic** für Popover/Menüs, **Smoke** für Modale
- Einheitliche Shell-Bars, Dashboard-Panels und Modul-Spalten (`chronell-tokens.css`)
- Wählbare **Presets** und eigene Oberflächenfarben — einmal einstellen, konsistent in allen Modulen

### Cloud-Sync (Profil)

Optional über **Supabase** (`chronell_profile_snapshots`):

| Modus | Verhalten |
|-------|-----------|
| **Nur lokal** | Kein Cloud-Profil |
| **Cloud-Sync** | Anmeldung Microsoft 365 (empfohlen) oder E-Mail-OTP |

**Synchronisiert:** Notizen, Entity-Links/Verbindungen, Regeln, QuickSteps, Workflow-Boards, UI-localStorage-Snapshot, VIP, Meta-Ordner, Triage-Zuordnungen, … — gleicher Umfang wie „Einstellungen sichern“.

**Nicht synchronisiert:** OAuth-Tokens, **Mail-Inhalte**, `mail.db`-Cache.

**Komfort:** Auto-Sync nach App-Start (~8 s), Hintergrund-Intervall **2–30 Min** (Standard 5), Push ~5 s nach Änderungen an Notizen/Verbindungen; leichter Zeitstempel-Check zwischen Vollabrufen; **Konflikt:** Cloud-Stand übernehmen oder lokal hochladen.

**Notiz-Anhänge:** Storage-Bucket `chronell-note-attachments`.

**Ersteinrichtung:** Assistent → Cloud-Sync-Sektion. Planung: [`docs/plans/cloud-sync-profil.md`](plans/cloud-sync-profil.md).

Weitere Systemfunktionen:

- **Einstellungs-Backup** (0.9.21): Export/Import JSON inkl. localStorage; **Auto-Backup** in wählbaren Ordner; **Inhaltsvorschau** vor Import (`SettingsBackupContentsDialog`)
- **Lokale Daten** — Speicherverbrauch anzeigen, Cache/DB bereinigen
- **Bulk-Entflaggen** auf dem Server (Dialog)
- Theming Hell / Dunkel / System, Akzentfarben
- Globale Tastenkürzel; **Übersicht** in Einstellungen → Allgemein (Mail, Zoom, Kalender)
- **Oberflächen-Zoom** (Strg+Umschalt+Plus/Minus/0) und **Mail-Vorschau-Zoom** getrennt konfigurierbar; **0.9.22:** Shortcuts werden im Main-Prozess abgefangen und an den Renderer weitergeleitet (zuverlässig auf DE-Tastaturen)

---

## 16. Datenhaltung, Suche, Sicherheit

- **SQLite** (`better-sqlite3`) im Main-Prozess: Mails, Metadaten, Kontakte, Notizen, Regeln, …
- **FTS5**-Indexe für schnelle lokale Suche
- **OAuth** über offizielle Flows; Geheimnisse nicht im Repo (`.env.example`)
- **Electron-Sicherheit:** `contextIsolation`, Preload-IPC, keine `nodeIntegration` im Renderer
- Offline-orientiert: Cache + lokale DB; Sync im Hintergrund
- Geplanter Versand, Undo-Pfade für destruktive Aktionen

---

## 17. Technischer Stack

| Schicht | Technologie |
|---------|-------------|
| Desktop | Electron 33 |
| UI | React 18, TypeScript, TailwindCSS, Radix, lucide-react |
| Build | electron-vite (Vite) |
| State | Zustand |
| Listen | react-virtuoso |
| Kalender | FullCalendar 6 |
| Editor | TipTap (Mail, Notizen) |
| DB | better-sqlite3 |
| APIs | @azure/msal-node, Microsoft Graph, Google APIs |
| i18n | i18next (DE, EN) |
| Tests | Vitest |
| Installer | electron-builder (NSIS, Windows x64) |

**Version** wird zentral in `src/shared/app-version.ts` und `package.json` geführt (`app.getVersion()` in Electron).

---

## 18. Bekannte Abweichungen zur README

Die Root-`README.md` wird mit Meilensteinen nachgezogen. Bei Widersprüchen gilt **dieses Funktionsprotokoll**.

| Thema | Ist-Stand (0.9.23) |
|-------|---------------------|
| Module | **Zehn** Top-Level-Modi inkl. **Verbindungen** und **Bookings** |
| Oberfläche | **Fluent 2** — Mica-Hintergrund, Acrylic-Popover, Design-Presets (Fluent, Midnight, Nord, …) |
| Regeln | **Einstellungen → Mail → Regeln** (kein eigener Tab) |
| Entity-Links | Zentral im Modul **Verbindungen** + in Notizen/Mail; Vorschau-Dock und Mini-Graph im Lesefenster |
| Profil-Sync | **Einstellungen → Allgemein → Cloud-Sync** (optional Supabase) |
| Homepage-Download | [GitHub Releases](https://github.com/kurtsoeser/Chronell/releases/download/v0.9.23/Chronell-0.9.23-setup.exe) (Installer im Repo per Git LFS) |

Bei Widersprüchen gilt **dieses Funktionsprotokoll**.

---

## 19. Installation (Windows) und Datenmigration

### Installer bauen

```powershell
npm run build:win
```

Ergebnis: `release/<version>/Chronell-<version>-setup.exe` (z. B. `release/0.9.19/Chronell-0.9.19-setup.exe`).

Öffentlicher Download nach `npm run publish:docs-release`: **GitHub Releases** (`githubDownloadUrl` in `latest.json`). Installer liegt zusätzlich unter `docs/release/` (Git LFS, auch >100 MB).

- **NSIS-Installer** deinstalliert bei gleicher `appId` automatisch die **vorherige Programmversion**, bevor die neue installiert wird (`deleteAppDataOnUninstall: false` — **Roaming-Daten bleiben** erhalten).
- Installationspfad (typisch): `C:\Program Files\Chronell\` (64-Bit; erfordert Admin beim Setup)
- **Deine Daten** (Konten, DB, Einstellungen): weiterhin `%APPDATA%\Chronell\` — nicht unter Program Files

### Von `npm run dev` auf die installierte App

| Was | Pfad / Verhalten |
|-----|------------------|
| **Bisher (Dev)** | `%APPDATA%\mailclient\` — DB, OAuth-Tokens, `config.json`, UI-Daten in Chromium |
| **Neu (Chronell)** | `%APPDATA%\Chronell\` |

Beim **ersten Start** (installierte App oder danach auch Dev) kopiert die App einmalig alle relevanten Daten von `mailclient` nach `Chronell` (ohne reine Browser-Caches). Der alte Ordner **bleibt als Backup** liegen.

Marker-Datei nach Migration: `%APPDATA%\Chronell\.chronell-migrated-from-mailclient.json`

**Empfohlene Schritte:**

1. `npm run dev` beenden (alle Chronell-/Electron-Fenster schließen).
2. `Chronell-0.9.23-setup.exe` (oder aktuelle Version von der Homepage) ausführen und installieren.
3. **Chronell** aus dem Startmenü starten — Migration läuft automatisch.
4. Konten und Einstellungen prüfen; bei Bedarf einmal Sync abwarten.
5. Optional: alten Ordner `C:\Users\<Du>\AppData\Roaming\mailclient` nach erfolgreicher Prüfung löschen (erst wenn alles passt).

---

## 20. Versionshistorie

### 0.9.31 - 22. Juni 2026

- **Mail:** Mail-Arbeitsbereich: Sidebar, Anhaenge, EWS und Aktionen (Kontext-Sidebar in Mail (Kontakt, Historie, Kalender); Composer und Lesefenster)
- **Kalender:** Kalender und Termine: Dialog, Vorschau, Kategorien und Shell (ueberarbeiteter Termin-Dialog; Datumsauswahl im Termin-Dialog)
- **Verbindungen:** Verbindungs-Graph und Objekt-Verknuepfungen (Verbindungs-Graph)
- **Homepage:** Release-Texte, Homepage-Timeline und Download auf 0.9.31


### 0.9.30 - 5. Juni 2026

- **Mail:** Mail-Arbeitsbereich: Sidebar, Anhaenge, EWS und Aktionen (Composer und Lesefenster)
- **Kalender:** Kalender und Termine: Dialog, Vorschau, Kategorien und Shell (ueberarbeiteter Termin-Dialog; Kalender-Layout speichern)
- **Einstellungen:** Einstellungen, Onboarding und Backup (Konten- und Erscheinungsbild-Einstellungen; ueberarbeiteter Ersteinrichtungs-Assistent)
- **Homepage:** Release-Texte, Homepage-Timeline und Download auf 0.9.30


### 0.9.29 - 4. Juni 2026

- **Mail:** Mail-Arbeitsbereich: Sidebar, Anhaenge, EWS und Aktionen (Composer und Lesefenster)
- **Kalender:** Kalender und Termine: Dialog, Vorschau, Kategorien und Shell (ueberarbeiteter Termin-Dialog; Kalender-Layout speichern)
- **Einstellungen:** Einstellungen, Onboarding und Backup (Konten- und Erscheinungsbild-Einstellungen; ueberarbeiteter Ersteinrichtungs-Assistent)
- **Homepage:** Release-Texte, Homepage-Timeline und Download auf 0.9.29


### 0.9.28 - 3. Juni 2026

- **Mail:** Mail-Arbeitsbereich: Sidebar, Anhaenge, EWS und Aktionen (Kontext-Sidebar in Mail (Kontakt, Historie, Kalender); Composer und Lesefenster)
- **Kalender:** Kalender und Termine: Dialog, Vorschau, Kategorien und Shell (ueberarbeiteter Termin-Dialog; Termin-Vorschau)
- **Aufgaben:** Aufgaben-Modul und Cloud-Tasks-Sync (Aufgaben-Modul)
- **Homepage:** Release-Texte, Homepage-Timeline und Download auf 0.9.28

