# Phase 3 & 5 — Vertiefung (Backlog nach Roadmap 0–6)

Stand: Juli 2026. Phasen 0–2, 4 (Kern), 6 und die Modularisierung von `types`/`preload` sind erledigt. Dieses Dokument beschreibt die **verbleibende Vertiefung** von Phase 3 (CalendarShell) und Phase 5 (DB-Repo-Tests).

## Gesamtstatus

| Phase | Kern | Vertiefung (dieses Dokument) |
|-------|------|------------------------------|
| 3 CalendarShell-Split | ~30 % (Header, Sidebar, Overlays, FC-Plugins) | Hooks + FC/Panels |
| 5 Tests | Coverage + Shared-Unit-Tests | In-Memory-SQLite + Repo-Tests |

**Ziel:** CalendarShell unter ~1.200 Zeilen; mindestens P0-Repos mit Integrationstests abgedeckt.

---

## Phase 3 — CalendarShell-Split

### Bereits extrahiert

| Modul | Zeilen ca. |
|-------|------------|
| `CalendarShellHeader.tsx` | 515 |
| `CalendarShellSidebarCalendars.tsx` | 881 |
| `CalendarShellLoadingOverlay.tsx` | 24 |
| `CalendarShellAlerts.tsx` | 12 |
| `shell/CalendarShellOverlayToggles.tsx` | 141 |
| `use-calendar-shell-light-overlays.ts` | 151 |
| `use-calendar-shell-event-persist.ts` | ~330 |
| `use-calendar-shell-graph-events.ts` | ~400 |
| `use-calendar-shell-cloud-tasks.ts` | ~350 |
| `use-calendar-shell-calendar-visibility.ts` | ~490 |
| `CalendarShellFullCalendar.tsx` | ~800 |
| `use-calendar-shell-right-panels.ts` | ~360 |
| `CalendarShellPreviewBody.tsx` | ~280 |
| `CalendarShellRightPanels.tsx` | ~270 |
| `CalendarShellModals.tsx` | ~175 |
| `CalendarShellGotoDateDialog.tsx` | ~90 |
| `use-calendar-shell-keyboard.ts` | ~230 |
| `calendar-shell-event-dialog-state.ts` | ~20 |
| `calendar-shell-storage.ts` | 332 |
| `calendar-shell-view-helpers.ts` | 53 |
| `calendar-fc-plugins.ts` | 19 |
| `CalendarShellLeftSidebar.tsx` | ~200 |
| `use-calendar-shell-scheduling.ts` | ~80 |
| `use-calendar-shell-pending-focus.ts` | ~120 |
| `use-calendar-shell-mail-actions.ts` | ~280 |
| `use-calendar-shell-fc-event-sources.ts` | ~90 |
| `use-calendar-shell-gantt-handlers.ts` | ~70 |
| `lib/calendar-folder-color-context-menu.ts` | ~40 |

`CalendarShell.tsx` liegt bei **~1.458 Zeilen** (Orchestrierung; Ziel &lt;1.500 erfüllt).

Optional (klein): `use-calendar-shell-panel-layout.ts`, `CalendarShellCalendarPane.tsx` (nur falls weitere Verkleinerung auf ~1.200 gewünscht).

### Schrittfolge (empfohlen)

| # | Datei | Nutzen |
|---|-------|--------|
| 1–6 | Hooks, FC, Right-Panels | ✅ |
| 7 | `CalendarShellModals.tsx` + `CalendarShellGotoDateDialog.tsx` | ✅ |
| 8 | `use-calendar-shell-keyboard.ts` | ✅ |

### Akzeptanzkriterien Phase 3

- [x] Schritt 4: `use-calendar-shell-calendar-visibility.ts`
- [x] Schritt 5: `CalendarShellFullCalendar.tsx`
- [x] Schritt 6: `CalendarShellRightPanels.tsx` + `use-calendar-shell-right-panels.ts`
- [x] Schritt 7: `CalendarShellModals.tsx` + `CalendarShellGotoDateDialog.tsx`
- [x] Schritt 8: `use-calendar-shell-keyboard.ts`
- [x] `CalendarShell.tsx` < 1.500 Zeilen (aktuell **~1.458**)
- [x] Mindestens 4 Hooks `use-calendar-shell-*` — **12 erfüllt** (+ `scheduling`, `pending-focus`, `mail-actions`, `fc-event-sources`, `gantt-handlers`)
- [ ] Manuelle Regression (Checkliste unten — im laufenden Client abhaken)
- [x] `npm run check` grün (0 TypeScript-Fehler, Lint-Warnings unverändert)

### Manuelle Regression Kalender

Einmal im laufenden Client (`npm run dev`) durchklicken — **kein** Vitest-Ersatz:

- [ ] **Termin per Drag** im Wochen-/Tagesraster verschieben; Zeit speichert sich nach Sync
- [ ] **Mail-Todo-Overlay**: Mail als ToDo einplanen, Chip im Kalender, Drag ändert Fälligkeit
- [ ] **Cloud-Task-Overlay**: Task in Kalender ziehen / verschieben, Persistenz nach Reload
- [ ] **Neuer Termin**: Quick-Create (Auswahl im Raster) und „Neuer Termin“-Dialog
- [ ] **Tastatur**: `.` Gehe-zu-Datum, `/` Suche, `t` Heute, `d`/`w`/`m` Ansichten, Escape schließt Popover/Dialog
- [ ] **Rechte Panels**: Vorschau-Dock öffnen/schließen, Termin in Preview bearbeiten

---

## Phase 5 — DB-Repo-Tests

### Ausgangslage

- **37** Repo-Module unter `src/main/db/`
- Domänenlogik in `src/shared/` und `rule-evaluator` gut getestet
- **Keine** echten SQLite-Integrationstests (nur `user-notes-search.test.ts` → Shared-FTS)

### Infrastruktur

| Datei | Rolle |
|-------|--------|
| `src/test-fixtures/db.ts` | `createInMemoryTestDb()` — alle `MIGRATIONS` auf `:memory:` |
| Repo-Tests | `vi.hoisted` + `vi.mock('./index', { getDb })` |

### Priorität Repo-Tests

| Prio | Modul | Was testen |
|------|-------|------------|
| P0 | `rules-repo.ts` | CRUD, JSON-Fallback, `markRuleExecuted` / `hasRuleExecuted` |
| P0 | `messages-repo-list.ts` (Pure) | `metaFolderCriteriaHasActiveFilter`, FTS-Normalisierung |
| P0 | `messages-repo-list.ts` (DB) | `listMessagesForMetaCriteria`, Listen/Zähler, Inbox, Kategorien | ✅ |
| P0 | `meta-folders-repo.ts` | Validierung, CRUD, `reorderMetaFolders` |
| P1 | `folders-repo.ts` | Upsert `well_known`, Sortierung | ✅ |
| P1 | `calendar-events-repo.ts` | Range-Query, Upsert, Sync-Fenster, Prune | ✅ |
| P2 | `messages-repo-ops.ts` | FTS `searchMessages`, Snooze | ✅ |
| P2 | `entity-links-repo.ts` | Add/Remove, Orphan-Purge | ✅ |

### Akzeptanzkriterien Phase 5

- [x] `createInMemoryTestDb` + `rules-repo.test.ts`
- [x] `messages-repo-list.filters.test.ts` (Pure Functions)
- [x] `messages-repo-list.meta.test.ts` + `meta-folders-repo.test.ts`
- [x] `calendar-events-repo.test.ts`
- [x] P1: `folders-repo.test.ts`
- [x] P2: `messages-repo-ops.test.ts`
- [x] P2: `entity-links-repo.test.ts`
- [x] `messages-repo-list.ops.test.ts` + erweiterte Meta-Tests (`messages-repo-list` **~88 %** Statements)
- [x] `npm run test:coverage:repos` — P0 + P1 Schwellen (`scripts/verify-repo-coverage.mjs`, CI)
- [x] CI (`npm run check`) grün — plus **`test:coverage:repos`**

### Coverage vs. Kalender-UI

**Vitest-Coverage gilt nur für `src/main/db/*` und Shared-Logik** — nicht für React-Kalenderkomponenten. Kalender-Verhalten (Drag, Mail-Todo, Cloud-Task) bleibt **Phase 3: manuelle Regression oder später E2E**; UI-Dateien in `coverage/` rot zu sehen ist erwartet und kein Qualitätsmangel für Phase 5.


---

## Umsetzungsreihenfolge (diese Session)

1. ~~Plan + Test-Harness~~
2. ~~`rules-repo.test.ts` + Filter-Tests~~
3. ~~`use-calendar-shell-event-persist.ts`~~
4. ~~`use-calendar-shell-graph-events.ts` + Meta-Ordner-DB-Tests~~
5. `npm run check` ✅
6. `CalendarShell.tsx` < 1.500 ✅ (Hooks: scheduling, pending-focus, mail-actions, fc-sources, gantt; `CalendarShellLeftSidebar.tsx`)

Nächste Sessions: manuelle Regression abhaken; optional weiter auf ~1.200 Zeilen (`CalendarShellCalendarPane`).
