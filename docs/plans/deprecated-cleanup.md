# Deprecated-Aliase — Migrations-Backlog

Stand: Phase 1 abgeschlossen. Diese Einträge sind bewusst noch im Code (Abwärtskompatibilität) und können nach Migration entfernt werden.

| Datei | Marker | Ersatz / Aktion |
|-------|--------|-----------------|
| `src/renderer/src/lib/tasks-display-prefs.ts` | deprecated | `tasks-settings-prefs` |
| `src/renderer/src/components/connections/connections-panel-compat.tsx` | deprecated | `EntityContextBlock` |
| `src/shared/note-entity-links.ts` | deprecated | `ChronellEntityRef` |
| `src/renderer/src/lib/entity-links-client.ts` | deprecated alias | siehe Datei-Kommentar |
| `src/shared/zoom-shortcut-keys.ts` | deprecated | `isAppZoomShortcutInput` |
| `src/renderer/src/app/notes/notes-calendar-view-storage.ts` | deprecated | `readNotesActiveFcView` |
| `src/renderer/src/app/tasks/tasks-types.ts` | deprecated alias | Cloud-Aufgaben-Typen |
| `src/renderer/src/components/module-shell-layout.ts` | deprecated | `moduleNavColumnMiniMonthShellClass` |
| `src/renderer/src/app/connections/graph-components.ts` | deprecated | Migration `comp:0`-Keys |
| `src/main/graph/calendar-event-attachments.ts` | deprecated | `graphAddEventAttachments` |
| `src/main/ai/entity-link-suggestion-counts.ts` | deprecated | merge aus Heuristik/Scan/Panel |

## Vorgehen bei Migration

1. Grep nach Import des deprecated Symbols
2. Verbraucher auf Ersatz umstellen
3. Deprecated-Export entfernen
4. `npm run check`

## Erledigt (Phase 4)

- `date-fns`-Locale-Helfer → `@/lib/date-fns-locale` (`resolveDateFnsLocale`, `useDateFnsLocale`, …)
- FullCalendar-Plugins-Bundle → `calendar-fc-plugins.ts` (Phase 3)

## Nicht in diesem Backlog
