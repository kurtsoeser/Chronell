# Mitwirken an Chronell

Danke für dein Interesse am MailClient/Chronell-Repository. Dieses Dokument beschreibt den erwarteten Workflow für Code-Änderungen.

Weitere Kontext-Dokumente:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Prozess-Modell, Datenfluss, Module
- [docs/IPC-REFERENCE.md](docs/IPC-REFERENCE.md) — IPC-Kanäle (generiert)
- [README.md](README.md) — Produkt, Build, OAuth

---

## Voraussetzungen

- **Node.js ≥ 20** (empfohlen: 22)
- **Windows 11** als primäres Zielsystem
- Repository klonen, dann:

```powershell
npm install
npm run dev
```

---

## Vor jedem Pull Request

Führe den vollständigen Check aus:

```powershell
npm run check
```

Das umfasst:

| Schritt | Befehl | Zweck |
|---------|--------|--------|
| Typecheck | `npm run typecheck` | Main + Renderer TypeScript |
| Tests | `npm run test` | Vitest (~500 Tests) |
| Lint | `npm run lint` | ESLint 9 (Flat Config) |
| i18n | `npm run validate:i18n` | DE/EN Key-Parität |
| Version | `npm run validate:version` | README ↔ package.json |

Optional bei Test-/Refactor-Arbeit:

```powershell
npm run test:coverage    # Coverage-Report in coverage/
npm run test:coverage:p0 # P0-Repo-Schwellen (rules, messages-list, meta-folders)
npm run test:coverage:p1 # P1-Repo-Schwellen (folders, calendar-events)
npm run test:coverage:repos # P0 + P1 in einem Lauf (CI); braucht funktionierendes better-sqlite3
npm run validate:knip    # ungenutzte Exports (nicht in check)
npm run docs:ipc-reference   # IPC-REFERENCE.md neu generieren
```

---

## Branch & Commits

- Feature-Branches von `main` abzweigen
- Commit-Messages: kurz, im Imperativ, **warum** vor **was**
- Keine Secrets in Commits (`.env`, Tokens, `credentials.json`)
- **Kein Force-Push** auf `main`

---

## Internationalisierung (i18n)

- Alle nutzer sichtbaren Strings über **i18next** (`useTranslation`)
- Keys in **beiden** Dateien pflegen:
  - `src/renderer/src/locales/de.json`
  - `src/renderer/src/locales/en.json`
- `npm run validate:i18n` muss grün sein — gleiche Key-Anzahl und -Struktur

---

## Neues Feature — empfohlene Schichten

### 1. Domänenlogik (`src/shared/`)

Reine Funktionen (Parser, Regeln, Formatierung) hier ablegen und mit `*.test.ts` absichern.

```text
src/shared/meine-domäne.ts
src/shared/meine-domäne.test.ts
```

### 2. Persistenz & Provider (`src/main/`)

- SQLite nur in `src/main/db/*-repo.ts`
- Microsoft Graph unter `src/main/graph/`, Google unter `src/main/google/`
- Hintergrund-Fehler: `logBackgroundError('kontext', err)`

### 3. IPC

1. Kanal in `src/shared/ipc-channels.ts`
2. DTOs in `src/shared/types.ts` oder domänennahem Modul
3. Handler in `src/main/ipc/register-<bereich>-ipc.ts`
4. Preload-Methode in `src/preload/index.ts`
5. Typ in `src/renderer/src/global.d.ts`
6. `npm run docs:ipc-reference` (wenn Kanäle geändert)

Siehe [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#3-ipc-konventionen).

### 4. UI (`src/renderer/`)

- Feature-Shell unter `src/renderer/src/app/<modul>/`
- Wiederverwendbares unter `components/` oder `lib/`
- State: **Zustand**-Store nur wenn mehrere Komponenten denselben Server-Cache teilen
- IPC-Fehler im Renderer: `logIpcError('kontext', err)` statt stilles `catch`

### 5. Tests

- Bevorzugt Unit-Tests für `shared/` und Main-Helfer ohne DB
- Fixtures: `src/test-fixtures/` (z. B. `makeMailListItem`)
- React-Komponenten-Tests (`*.test.tsx`) nur bei isolierter UI-Logik — noch selten im Projekt
- DB-Repo-Tests: `createInMemoryTestDb()` in `src/test-fixtures/db.ts`; `npm rebuild better-sqlite3` fuer Vitest (System-Node). Nach `electron-rebuild` ggf. erneut rebuilden, wenn Tests lokal uebersprungen werden. Siehe `docs/plans/phase-3-5-deepening.md`.

---

## Code-Stil

- TypeScript strict, **keine** `@ts-ignore`
- ESLint-Warnungen nicht unnötig erhöhen; neue Fehler vermeiden
- Bestehende Muster im umgebenden Code übernehmen (Imports, Benennung, Hook-Struktur)
- Kleine, fokussierte Diffs — kein Drive-by-Refactoring in unbetroffenen Dateien

---

## Große Dateien

Diese Dateien sind bewusst noch monolithisch; Änderungen dort **inkrementell** und mit Tests:

| Datei | Hinweis |
|-------|---------|
| `CalendarShell.tsx` | Hooks extrahieren (`use-calendar-shell-*`) |
| `preload/index.ts` | API nach Bereichen splitten |
| `shared/types.ts` | Typen in Domänen-Module auslagern |

---

## Was wir aktuell nicht erwarten

- E2E-Tests (Playwright) — zurückgestellt
- Redux / React Query — IPC-first bleibt
- Große Framework-Upgrades ohne eigenes Issue/PR

---

## Fragen

Bei Architektur- oder IPC-Fragen zuerst [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) lesen. Für Produktverhalten [docs/FUNKTIONSPROTOKOLL.md](docs/FUNKTIONSPROTOKOLL.md).
