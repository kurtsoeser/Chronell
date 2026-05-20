# Chronell

**Chronell** ist eine Desktop-Arbeitszentrale für Windows 11 — kein klassischer E-Mail-Client zum bloßen Lesen von Listen, sondern ein System, **Zeit und Handlung** zu steuern: Mail-Triage, Aufgaben, Kalender, Microsoft Bookings und mehr in **einem Fenster**, mit **Microsoft 365** und **Google** kombiniert und **lokaler SQLite-Datenhaltung** auf deinem Rechner.

| | |
|---|---|
| **Homepage & Download** | [kurtsoeser.github.io/Chronell](https://kurtsoeser.github.io/Chronell/) |
| **Aktuelle Version** | **0.9.13** (18. Mai 2026) |
| **Windows-Installer** | [GitHub Release](https://github.com/kurtsoeser/Chronell/releases/latest) oder [direkt von Pages](https://kurtsoeser.github.io/Chronell/release/latest/Chronell-setup.exe) |
| **Technischer Repo-Name** | MailClient · **App-ID:** `at.kurtsoeser.chronell` |
| **Ausführliches Protokoll** | [`docs/FUNKTIONSPROTOKOLL.md`](docs/FUNKTIONSPROTOKOLL.md) |
| **Landing Page (Quellen)** | [`docs/`](docs/) · Deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md) |

> **Status:** Funktionsfähige Beta für **Windows 11**. Multi-Account-Synchronisation über **Microsoft Graph** und **Google APIs** (Gmail, Kalender, Kontakte, Tasks). Die Oberfläche ist auf **Deutsch** und **Englisch** verfügbar.

---

## Inhaltsverzeichnis

- [Warum Chronell?](#warum-chronell)
- [Neuigkeiten (0.9.x)](#neuigkeiten-09x)
- [Die neun Module](#die-neun-module)
- [Funktionen im Überblick](#funktionen-im-überblick)
- [Mail & Triage](#mail--triage)
- [Kalender & Terminplanung](#kalender--terminplanung)
- [Microsoft Bookings](#microsoft-bookings)
- [Alle Arbeit, Aufgaben, Notizen, Personen](#alle-arbeit-aufgaben-notizen-personen)
- [Home-Dashboard, Chat, Regeln](#home-dashboard-chat-regeln)
- [Datenschutz & lokale Daten](#datenschutz--lokale-daten)
- [Chronell vs. Outlook & Web](#chronell-vs-outlook--web)
- [Download & Installation](#download--installation)
- [Tech-Stack](#tech-stack)
- [Entwicklung & Build](#entwicklung--build)
- [OAuth für Endnutzer](#oauth-für-endnutzer)
- [Projektstruktur](#projektstruktur)
- [Roadmap](#roadmap)
- [Lizenz](#lizenz)

---

## Warum Chronell?

Klassische Mail-Clients zeigen Listen. **Chronell** ist auf einen **Workflow für deinen Tag** ausgelegt:

- Posteingang **entlasten** und jede Nachricht zur **Entscheidung** machen (erledigen, planen, snoozen, delegieren)
- **Mail-ToDos**, Cloud-Aufgaben und Termine in **einer Zeitleiste** sehen
- **Microsoft Bookings** (Team-Buchungsseiten) neben Mail und Kalender — ohne Outlook-Web-Tab
- **Mehrere Konten** (M365 + Google) in **einer Oberfläche**, mit **schneller lokaler Volltextsuche**

Typische Zielgruppe: Power-User mit Microsoft 365 und/oder Gmail, mehrere Postfächer, Wunsch nach **offline-tauglichem Cache** und moderner UI.

---

## Neuigkeiten (0.9.x)

| Bereich | Was neu ist |
|--------|-------------|
| **Microsoft Bookings** | Eigenes Modul: Buchungsseiten, Leistungen, Termine aus Microsoft Graph — für M365-Konten mit Bookings-Lizenz |
| **Book with me** | Persönliche Buchungslinks im Kalender (Terminplanung), getrennt von Unternehmens-Bookings |
| **Kalender Gantt** | Zeitstrahl-Ansicht mit skalierbaren Intervallen; Mail-ToDos, Tasks und Termine auf einer Timeline |
| **Modul „Alle Arbeit“** | Vereinheitlichte Liste/Kanban-Ansicht für Mail-ToDos, Cloud-Tasks und Termine (ersetzt den früheren Top-Level-Modus „Workflow“) |
| **Notizen** | Entity-Links zwischen Notizen, Mails, Terminen, Tasks und Kontakten |
| **Home-Dashboard** | Erweiterte Kacheln (Wetter, Fristen, Alle Arbeit, Notizen, …), freies Pixel-Layout |
| **Branding & Installer** | Produktname **Chronell**, Windows-Setup `Chronell-setup.exe`, Migration von `%APPDATA%\mailclient` → `Chronell` |
| **Homepage** | Öffentliche Seite mit Download, DE/EN — [kurtsoeser.github.io/Chronell](https://kurtsoeser.github.io/Chronell/) |

---

## Die neun Module

Die obere Leiste gliedert die App in **neun Modi** (Reihenfolge anpassbar, einzelne Tabs ausblendbar):

| Modul | Zweck |
|-------|--------|
| **Home** | Persönliches Dashboard mit konfigurierbaren Kacheln |
| **Mail** | Postfächer, Lesepane, Triage, Rich-Text-Compose |
| **Kalender** | Multi-Kalender (M365 + Google), Zeitliste, Gantt-Zeitstrahl |
| **Bookings** | **Microsoft Bookings** — Buchungsseiten, Leistungen, Termine (M365) |
| **Aufgaben** | Microsoft To Do + Google Tasks |
| **Alle Arbeit** | Mail-ToDos, Cloud-Tasks und Termine in Liste oder Kanban |
| **Personen** | Kontakte (Graph + Google), lokal gecacht |
| **Notizen** | Kernnotizen an Mails/Terminen oder freistehend, Markdown, Verknüpfungen |
| **Chat** | Microsoft Teams + WhatsApp Web (eingebettet) |

**Querschnitt:** Globale Suche (Ctrl+K), „Neu …“-Dialog, Snooze, QuickSteps, geplanter Versand, Notion-Export, Ersteinrichtungs-Assistent, DE/EN.

---

## Funktionen im Überblick

| Bereich | Kurzbeschreibung |
|--------|-------------------|
| **Konten** | Mehrere Konten parallel; **Microsoft 365** (Graph) und **Google**; optional eigene OAuth-App |
| **Mail** | Virtualisierte Listen, FTS5-Suche, TipTap-Compose, Snooze, Waiting for, Mail-ToDos, QuickSteps, Meta-Ordner, Kategorien |
| **Kalender** | Tag/Woche/Monat/Jahr, Zeitliste, Gantt; Termine inkl. Serien; Mail-ToDos & Tasks im Kalender |
| **Bookings** | Unternehmens-Bookings in der App; Verwaltung/Veröffentlichung weiter in Outlook Web |
| **Aufgaben** | To Do + Google Tasks, Listen-, Kanban- und Kalenderansicht |
| **Alle Arbeit** | Einheitliche WorkItems aus Mail, Tasks und Kalender |
| **Personen** | Kontakte mit Fotos, Notizen-Verknüpfungen, Compose |
| **Notizen** | Abschnitte, Seiten, Anhänge (lokal/Cloud), Entity-Links |
| **Regeln** | Visuelle Mail-Regeln (Einstellungen → Mail → Regeln), Dry-Run |
| **Chat** | Teams-Chats, WhatsApp Web, abdockbare Popouts |
| **Home** | Kacheln für Posteingang, Fristen, Kalender, Compose, Wetter, … |
| **System** | Hell/Dunkel, Akzentfarben, Einstellungs-Backup, `prefers-reduced-motion` |

---

## Mail & Triage

- **Mail-ToDos** mit Fälligkeits-Buckets (überfällig, heute, morgen, Woche, später, erledigt)
- **Snooze** und **Waiting for** (Wiedervorlage / auf Antwort warten)
- **QuickSteps** — konfigurierbare Aktionsketten mit Tastenkürzeln
- **Meta-Ordner** — virtuelle, kontenübergreifende Such-/Filteransichten
- **Workflow-Ordner** pro Konto (z. B. „In Bearbeitung“ / „Erledigt“) für Triage
- **Rich-Text-Compose** (TipTap), Anhänge, Entwürfe, Vorlagen, **geplanter Versand**
- **Rückgängig** über Nachrichtenaktionen; Verknüpfung Mail ↔ Cloud-Task
- **Notion:** Mail als Block an Notion-Seite senden
- Lange Listen: **react-virtuoso** (virtualisiert)

---

## Kalender & Terminplanung

- **Microsoft-** und **Google-Kalender** in einer Shell (FullCalendar)
- Ansichten: Tag, Woche, Monat, Jahr, Quartal, Listenwoche, N-Tage-Raster
- **Zeitliste** — kombinierte Timeline aus ToDos, Tasks und Terminen (abdockbar)
- **Gantt-Zeitstrahl** — skalierbare Intervalle, Drag & Drop für geplante Zeiten
- Termine inkl. **Serien/Wiederholung**; Drag & Resize mit Persistenz
- **Terminplanung (Book with me):** persönliche Buchungslinks, Einladung per Mail, Sprung zu Bookings
- Notizen an Terminen; Kalender-Vorlauf pro Konto konfigurierbar

---

## Microsoft Bookings

> Erfordert ein **Microsoft-365-Konto** mit **Bookings-Lizenz** und passenden **Graph-Berechtigungen** (Admin-Einwilligung ggf. nötig).

Im Modul **Bookings**:

- **Buchungsseiten** (Businesses) des Teams auflisten und auswählen
- **Leistungen** und **anstehende Termine** in der App anzeigen
- Öffentliche Buchungs-URL kopieren oder in Outlook Bookings verwalten
- Termin-Vorschau mit Sprung zu Outlook Web

**Book with me** (persönliche 1:1-Buchungsseite) wird im **Kalender** unter Terminplanung verwaltet — getrennt von Unternehmens-Bookings.

Einstellungen: **Einstellungen → Bookings** (Übersicht, Book with me, Zugriff & Konten).

---

## Alle Arbeit, Aufgaben, Notizen, Personen

### Alle Arbeit

- Vereinheitlichte **`WorkItem`**-Sicht: `mail_todo`, `cloud_task`, `calendar_event`
- Listen- und **Kanban-Ansicht** nach Fälligkeit
- Vorschau-Panel, geplante Arbeitszeiten, Kontextmenüs

### Aufgaben

- **Microsoft To Do** und **Google Tasks** zentral
- Listen-, Kanban- und Kalenderansicht; Anlegen auch aus Mail-Kontext

### Notizen

- An **Mail**, an **Termin** oder **freistehend** (Kernnotizen)
- Abschnittsbaum, Markdown-Editor, Listen-/Kalenderansicht
- **Entity-Links** (Notiz ↔ Mail ↔ Termin ↔ Task ↔ Kontakt)
- Anhänge lokal und über M365/OneDrive

### Personen

- Kontakte von M365 + Google, lokal gecacht
- Listen- und Kachelansicht, Detailpanel, Compose, verknüpfte Notizen

---

## Home-Dashboard, Chat, Regeln

### Home-Dashboard

- **Freies Pixel-Layout** (ziehen, skalieren, pinnen)
- Kacheln u. a.: Posteingang, ToDo-Buckets, Snooze, Suche, Mini-Kalender, Fristen, Wetter, Compose, **Alle Arbeit**, Notizen
- Benutzerdefinierte Kacheln mit Sprung zu Ordner, Termin oder Mail

### Chat

- **Microsoft Teams** (Graph)
- **WhatsApp Web** eingebettet
- Abdockbare Teams-Popouts, „Always on top“

### Regeln

- Visuelle **Regel-Engine** (Bedingungen + Aktionen: verschieben, Tag, ToDo, Snooze, …)
- Trigger: bei Eingang, manuell; Ausführungs-Historie
- **Ort in der UI:** Einstellungen → Mail → Regeln

---

## Datenschutz & lokale Daten

- **SQLite** auf dem Gerät: Mails, Metadaten, Kontakte, Notizen — Suche über **FTS5**
- **OAuth** nur zu Microsoft/Google; keine eigenen Server für Mail-Inhalte
- **Electron:** `contextIsolation`, Preload-IPC — keine `nodeIntegration` im Renderer
- Geheimnisse nur lokal (`.env` nicht im Repo; Vorlage: [`.env.example`](.env.example))

---

## Chronell vs. Outlook & Web

| Aspekt | Chronell | Typisch Outlook / Web |
|--------|----------|------------------------|
| **Fokus** | Zeit & Handlung: Triage, ToDos, Zeitliste, Bookings in einem Desktop | Listen- und Tab-Chaos |
| **Multi-Provider** | M365 + Google kombiniert | Getrennte Apps |
| **Lokale Suche** | SQLite + FTS5 auf dem Gerät | Oft serverzentriert |
| **Bookings** | Modul in der App (Graph) | Meist nur Outlook Web |
| **Anpassung** | Open Source am Code; QuickSteps, Meta-Ordner, Regeln | Produktstrategie des Anbieters |

**Ehrlich:** Chronell ersetzt nicht jedes Enterprise-Outlook-Szenario (Exchange-Admin, Compliance-Archivierung). Stärken: **Workflow**, **lokale Daten**, **Multi-Provider**, moderne UI.

---

## Download & Installation

### Endnutzer (Windows 11)

1. Installer von der [Homepage](https://kurtsoeser.github.io/Chronell/) oder [GitHub Releases](https://github.com/kurtsoeser/Chronell/releases/latest) laden  
2. `Chronell-setup.exe` ausführen und installieren  
3. Beim ersten Start: **Ersteinrichtungs-Assistent** (Microsoft/Google anmelden)

**Upgrade von älteren MailClient-Builds:** Daten unter `%APPDATA%\mailclient` werden beim ersten Start von Chronell automatisch nach `%APPDATA%\Chronell` migriert.

### Maintainer: Installer veröffentlichen

```powershell
npm run build:win
```

Nach dem Build erscheint die Abfrage, ob die Version auch auf **GitHub** veröffentlicht werden soll (Installer nach `docs/release/`, Manifeste, GitHub Release via `gh`). Bei **Ja** passiert das automatisch; bei **Nein** nur lokaler Build unter `release/<version>/`.

Manuell (ohne erneuten Build):

```powershell
npm run publish:docs-release
```

Anschließend `docs/release/` committen und pushen (GitHub Pages). Details: [`docs/DEPLOY.md`](docs/DEPLOY.md).

> Installer sind ~90 MB. GitHub erlaubt bis **100 MB pro Datei** im Repo; bei größeren Builds: Git LFS oder nur GitHub Releases.

---

## Tech-Stack

- **Electron 33** · **React 18** · **TypeScript** · **electron-vite**
- **Tailwind CSS** · **Radix UI** · **lucide-react** · **Zustand**
- **TipTap** (Compose/Notizen) · **FullCalendar** · **react-virtuoso**
- **better-sqlite3** (Main) · **FTS5**
- **Microsoft Graph** · **Google APIs** (Gmail, Calendar, People, Tasks, Bookings, …)
- **MSAL** · **electron-builder** (NSIS, Windows x64)
- **Vitest** · **i18next** (DE/EN)

---

## Entwicklung & Build

### Voraussetzungen

- **Node.js ≥ 20** (empfohlen: 22)
- **Windows 11** (primäres Zielsystem)

### Lokal starten

```powershell
npm install
npm run dev
```

### Windows-Installer bauen

```powershell
npm run build:win
```

Ausgabe: `release/<version>/Chronell-<version>-setup.exe` (lokal, in `.gitignore`).

Ohne interaktive Versionsabfrage (gleiche Version neu bauen):

```powershell
npm run prebuild:win -- -NoBump
npm run build:win:inner
npm run finish:win
```

(`prebuild:win` laeuft bei `npm run build:win` automatisch einmal; nicht doppelt aufrufen.)

Hinweis: `signAndEditExecutable: false` in `electron-builder.yml` — für Verteilung später **Authenticode**-Signatur empfohlen.

### Tests

```powershell
npm run test
npm run test:watch
```

---

## OAuth für Endnutzer

Für öffentliche Verteilung trägt der Herausgeber die Azure- und Google-OAuth-Registrierung einmal ein. Endnutzer nutzen den **Ersteinrichtungs-Assistenten**.

- Build-Zeit: `MAILCLIENT_*` in `.env` oder Remote-JSON (`MAILCLIENT_REMOTE_OAUTH_CONFIG_URL`)
- **Microsoft 365:** ggf. [Admin-Zustimmung](https://login.microsoftonline.com/organizations/v2.0/adminconsent?client_id=APPLICATION_ID&redirect_uri=REDIRECT_URI) — inkl. Scopes für Mail, Kalender, Tasks, **Bookings**, Teams, …
- **Google:** bei öffentlicher Nutzung oft OAuth-Verifizierung nötig
- Eigene Apps: Einstellungen → Allgemein → Eigene OAuth-App

Mehr: [docs/google-oauth-oeffentlich.md](docs/google-oauth-oeffentlich.md)

---

## Projektstruktur

```
src/
  main/           Electron Main — DB, Sync, Graph/Gmail/Bookings, IPC
    ipc/          IPC nach Bereich (mail, calendar, bookings, auth, …)
    db/           SQLite-Repositories, FTS
  preload/        Sichere IPC-Brücke
  renderer/       React-UI
    src/app/      Shells: home, mail, calendar, bookings, work, tasks, …
    src/components/
    src/stores/
    src/lib/
  shared/         Typen, IPC-Konstanten, app-version
docs/             Homepage (GitHub Pages), DEPLOY, release/
resources/        Branding, Icons
scripts/          Build, publish-docs-release, Branding-Sync
```

---

## Roadmap

Ausführliches Konzept: [.cursor/plans/mailclient_konzept_skizze_2f302c68.plan.md](.cursor/plans/mailclient_konzept_skizze_2f302c68.plan.md)

**Erreicht (Auswahl):** Multi-Account-Sync, Mail-Workflow, Kalender+Zeitliste, Alle Arbeit, Notizen mit Entity-Links, Home-Dashboard, Bookings, öffentliche Homepage mit Download.

**In Arbeit / geplant:** Weitere Bookings-Tiefenintegration, Regel-Ausbau, KI-Schicht (Datenmodell teils vorbereitet), macOS (nicht im aktuellen Fokus).

Vollständiger Ist-Stand: [`docs/FUNKTIONSPROTOKOLL.md`](docs/FUNKTIONSPROTOKOLL.md)

---

## Lizenz

`package.json`: **`UNLICENSED`** / **`private`**. Nutzung und Weitergabe nach Vereinbarung mit der Urheber:in.

---

**Autor:** [Kurt Soeser](https://github.com/kurtsoeser) · **Produkt:** Chronell · **Repository:** MailClient
