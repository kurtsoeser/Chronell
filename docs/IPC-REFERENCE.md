# IPC-Referenz (generiert)

> Automatisch erzeugt durch `npm run docs:ipc-reference`. Nicht manuell bearbeiten.

Stand: 2026-07-01

## Übersicht

| Metrik | Wert |
|--------|------|
| Invoke-Kanäle (`ipcMain.handle`) | 328 in `ipc-channels.ts` |
| Registrierte Handler (Summe) | 343 in `src/main/ipc/register-*-ipc.ts` |
| Push-Events (Main → Renderer) | 23 (siehe unten) |

Quelle der Kanalnamen: [`src/shared/ipc-channels.ts`](../src/shared/ipc-channels.ts)

## Handler-Registrierung nach Datei

| Datei | `ipcMain.handle`-Aufrufe |
|-------|---------------------------|
| `src/main/ipc/register-ai-connections-ipc.ts` | 9 |
| `src/main/ipc/register-app-ipc.ts` | 11 |
| `src/main/ipc/register-auth-ipc.ts` | 11 |
| `src/main/ipc/register-bookings-ipc.ts` | 5 |
| `src/main/ipc/register-calendar-ipc.ts` | 27 |
| `src/main/ipc/register-config-ipc.ts` | 15 |
| `src/main/ipc/register-entity-links-ipc.ts` | 23 |
| `src/main/ipc/register-files-ipc.ts` | 8 |
| `src/main/ipc/register-graph-ipc.ts` | 4 |
| `src/main/ipc/register-local-data-ipc.ts` | 4 |
| `src/main/ipc/register-location-ipc.ts` | 2 |
| `src/main/ipc/register-mail-body-index-ipc.ts` | 2 |
| `src/main/ipc/register-mail-compose-ipc.ts` | 13 |
| `src/main/ipc/register-mail-folders-ipc.ts` | 5 |
| `src/main/ipc/register-mail-ipc.ts` | 58 |
| `src/main/ipc/register-mail-list-ipc.ts` | 7 |
| `src/main/ipc/register-mail-meta-ipc.ts` | 7 |
| `src/main/ipc/register-mail-reading-popout-ipc.ts` | 8 |
| `src/main/ipc/register-notes-ipc.ts` | 33 |
| `src/main/ipc/register-notion-ipc.ts` | 14 |
| `src/main/ipc/register-panel-popout-ipc.ts` | 8 |
| `src/main/ipc/register-people-ipc.ts` | 12 |
| `src/main/ipc/register-profile-sync-ipc.ts` | 9 |
| `src/main/ipc/register-settings-backup-ipc.ts` | 9 |
| `src/main/ipc/register-tasks-ipc.ts` | 15 |
| `src/main/ipc/register-teams-chat-popout-ipc.ts` | 8 |
| `src/main/ipc/register-weather-ipc.ts` | 2 |
| `src/main/ipc/register-workflow-vip-rules-ipc.ts` | 14 |

## Invoke-Kanäle nach Namespace

Renderer ruft Kanäle über `window.mailClient.*` → `ipcRenderer.invoke` im Preload auf.
Main registriert Handler in `src/main/ipc/register-*-ipc.ts`.

### `ai-connections:`

- `ai-connections:cancel-embedding-rebuild`
- `ai-connections:clear-api-key`
- `ai-connections:get-embedding-index-status`
- `ai-connections:get-settings`
- `ai-connections:list-ollama-models`
- `ai-connections:rebuild-embedding-index`
- `ai-connections:set-api-key`
- `ai-connections:set-settings`
- `ai-connections:test-ollama-connection`

### `app:`

- `app:get-connectivity`
- `app:get-platform`
- `app:get-version`
- `app:global-search`
- `app:open-external`
- `app:set-launch-on-login`
- `app:show-test-notification`
- `app:window-close`
- `app:window-is-maximized`
- `app:window-minimize`
- `app:window-toggle-maximize`

### `auth:`

- `auth:add-google`
- `auth:add-microsoft`
- `auth:get-account-display-avatar-data-url`
- `auth:get-profile-photo-data-url`
- `auth:list-accounts`
- `auth:patch-account`
- `auth:pick-account-custom-avatar`
- `auth:refresh-google`
- `auth:refresh-microsoft`
- `auth:remove`
- `auth:reorder-accounts`

### `bookings:`

- `bookings:get-business`
- `bookings:list-appointments`
- `bookings:list-businesses`
- `bookings:list-services`
- `bookings:list-staff-members`

### `calendar:`

- `calendar:create-event`
- `calendar:create-teams-meeting`
- `calendar:delete-event`
- `calendar:find-local-free-slots`
- `calendar:find-meeting-times`
- `calendar:get-account-sync-states`
- `calendar:get-attendee-schedule`
- `calendar:get-event`
- `calendar:list-calendars`
- `calendar:list-event-attachments`
- `calendar:list-events`
- `calendar:list-events-for-contact`
- `calendar:list-ms365-group-calendars`
- `calendar:open-event-attachment`
- `calendar:parse-ics-file`
- `calendar:parse-meeting-from-message`
- `calendar:patch-calendar-color`
- `calendar:patch-event-categories`
- `calendar:patch-event-icon`
- `calendar:patch-event-schedule`
- `calendar:pick-ics-file`
- `calendar:respond-to-meeting-invitation`
- `calendar:save-event-attachment-as`
- `calendar:suggest-from-message`
- `calendar:sync-account`
- `calendar:transfer-event`
- `calendar:update-event`

### `compose:`

- `compose:add-drive-explorer-favorite`
- `compose:create-drive-sharing-link`
- `compose:dispose-draft`
- `compose:list-drive-explorer`
- `compose:list-drive-explorer-favorites`
- `compose:list-send-from-options`
- `compose:recipient-suggestions`
- `compose:remove-drive-explorer-favorite`
- `compose:rename-drive-explorer-favorite`
- `compose:reorder-drive-explorer-favorites`
- `compose:save-draft`
- `compose:send`
- `compose:update-drive-explorer-favorite-cache`

### `config:`

- `config:get`
- `config:set-auto-load-images`
- `config:set-avatar-preferences`
- `config:set-calendar-time-zone`
- `config:set-first-run-setup-completed`
- `config:set-google-client-id`
- `config:set-gravatar-enabled`
- `config:set-mail-poll-interval-seconds`
- `config:set-microsoft-client-id`
- `config:set-microsoft-mail-transport`
- `config:set-notion-credentials`
- `config:set-profile-sync-poll-interval-seconds`
- `config:set-sync-window-days`
- `config:set-weather-location`
- `config:set-workflow-mail-folders-intro-dismissed`

### `entity-links:`

- `entity-links:accept-ai-scan-items`
- `entity-links:add`
- `entity-links:cancel-ai-scan`
- `entity-links:dismiss-ai-scan-items`
- `entity-links:dismiss-ai-suggestion`
- `entity-links:estimate-ai-scan-cost`
- `entity-links:evaluate-link-quality`
- `entity-links:find-path`
- `entity-links:get-ai-scan-status`
- `entity-links:get-graph-density-stats`
- `entity-links:get-heuristic-suggestion-counts`
- `entity-links:get-mail-todo-message-id`
- `entity-links:list`
- `entity-links:list-ai-audit`
- `entity-links:list-graph`
- `entity-links:list-neighborhood`
- `entity-links:list-palette`
- `entity-links:preview-ai-payload`
- `entity-links:remove`
- `entity-links:search-targets`
- `entity-links:start-ai-scan`
- `entity-links:suggest`
- `entity-links:suggest-ai`

### `files:`

- `files:get-mail-index-status`
- `files:list-cloud`
- `files:list-mail`
- `files:open-cloud-item-external`
- `files:open-mail-attachment`
- `files:save-cloud-item-as`
- `files:save-mail-attachment-as`
- `files:save-mail-to-drive`

### `folder:`

- `folder:create`
- `folder:delete`
- `folder:move`
- `folder:rename`
- `folder:toggle-favorite`

### `graph:`

- `graph:get-me`
- `graph:list-teams-chat-messages`
- `graph:list-teams-chats`
- `graph:send-teams-chat-message`

### `local-data:`

- `local-data:export-archive`
- `local-data:optimize`
- `local-data:pick-and-restore-archive`
- `local-data:scan-usage`

### `location:`

- `location:reverse`
- `location:search`

### `mail:`

- `mail:archive`
- `mail:bulk-unflag-flagged-messages`
- `mail:clear-local-mail-cache`
- `mail:clear-waiting-for-message`
- `mail:complete-todo-for-message`
- `mail:create-master-category`
- `mail:create-meta-folder`
- `mail:delete-master-category`
- `mail:delete-meta-folder`
- `mail:delete-quick-step`
- `mail:empty-trash-folder`
- `mail:ensure-workflow-mail-folders`
- `mail:fetch-inline-images`
- `mail:get-account-sync-meta`
- `mail:get-message`
- `mail:get-meta-folder`
- `mail:get-quick-step`
- `mail:get-sender-domain-avatar-data-url`
- `mail:get-unified-inbox-unread-count`
- `mail:get-workflow-mail-folder-state`
- `mail:list-all-open-todo-messages`
- `mail:list-attachments`
- `mail:list-category-messages`
- `mail:list-correspondence`
- `mail:list-distinct-message-tags`
- `mail:list-folders`
- `mail:list-inbox-triage`
- `mail:list-master-categories`
- `mail:list-messages`
- `mail:list-messages-by-threads`
- `mail:list-meta-folder-messages`
- `mail:list-meta-folders`
- `mail:list-quick-steps`
- `mail:list-quick-steps-all`
- `mail:list-snoozed`
- `mail:list-templates`
- `mail:list-thread-messages`
- `mail:list-todo-counts`
- `mail:list-todo-messages`
- `mail:list-todo-messages-in-range`
- `mail:list-unified-inbox`
- `mail:list-waiting-messages`
- `mail:mark-all-read-in-folder`
- `mail:move-to-folder`
- `mail:move-to-trash`
- `mail:open-attachment`
- `mail:peek-undo`
- `mail:permanent-delete-message`
- `mail:refresh-now`
- `mail:remove-mail-todo-records-for-message`
- `mail:reorder-meta-folders`
- `mail:run-quick-step`
- `mail:save-attachment-as`
- `mail:save-quick-step`
- `mail:search`
- `mail:set-active-folder`
- `mail:set-flagged`
- `mail:set-message-categories`
- `mail:set-read`
- `mail:set-todo-for-message`
- `mail:set-todo-schedule-for-message`
- `mail:set-waiting-for-message`
- `mail:set-workflow-mail-folder-mapping`
- `mail:snooze`
- `mail:sync-account`
- `mail:sync-attachments-flag`
- `mail:sync-folder`
- `mail:undo-last`
- `mail:unsnooze`
- `mail:unsubscribe-one-click`
- `mail:update-master-category`
- `mail:update-meta-folder`

### `mail-body-index:`

- `mail-body-index:get-status`
- `mail-body-index:set-settings`

### `mail-reading-popout:`

- `mail-reading-popout:close`
- `mail-reading-popout:close-all`
- `mail-reading-popout:focus`
- `mail-reading-popout:get-always-on-top`
- `mail-reading-popout:is-open`
- `mail-reading-popout:open`
- `mail-reading-popout:request-dock`
- `mail-reading-popout:set-always-on-top`

### `notes:`

- `notes:clear-schedule`
- `notes:create-standalone`
- `notes:delete`
- `notes:get-by-id`
- `notes:get-calendar`
- `notes:get-mail`
- `notes:get-people-contact`
- `notes:list`
- `notes:list-for-contact`
- `notes:list-in-range`
- `notes:move-to-section`
- `notes:patch-display`
- `notes:search`
- `notes:set-schedule`
- `notes:update-standalone`
- `notes:upsert-calendar`
- `notes:upsert-mail`
- `notes:upsert-people-contact`

### `notion:`

- `notion:add-favorite`
- `notion:append-event`
- `notion:append-mail`
- `notion:connect`
- `notion:connect-internal`
- `notion:create-event-page`
- `notion:create-mail-page`
- `notion:create-page`
- `notion:disconnect`
- `notion:get-destinations`
- `notion:get-status`
- `notion:remove-favorite`
- `notion:search-pages`
- `notion:set-destinations`

### `panel-popout:`

- `panel-popout:close`
- `panel-popout:close-all`
- `panel-popout:focus`
- `panel-popout:is-open`
- `panel-popout:open`
- `panel-popout:request-dock`
- `panel-popout:stash-payload`
- `panel-popout:take-payload`

### `people:`

- `people:create-contact`
- `people:delete-contact`
- `people:find-by-email`
- `people:get-by-id`
- `people:get-nav-counts`
- `people:get-photo-data-url`
- `people:list`
- `people:set-contact-photo`
- `people:set-favorite`
- `people:sync-account`
- `people:sync-all`
- `people:update-contact`

### `profile-sync:`

- `profile-sync:cache-ui-prefs`
- `profile-sync:get-status`
- `profile-sync:resolve-conflict`
- `profile-sync:send-otp`
- `profile-sync:set-data-mode`
- `profile-sync:sign-in-microsoft365`
- `profile-sync:sign-out`
- `profile-sync:sync-now`
- `profile-sync:verify-otp`

### `rules:`

- `rules:apply-manual`
- `rules:create`
- `rules:delete`
- `rules:dry-run`
- `rules:get`
- `rules:list`
- `rules:list-automation`
- `rules:undo-automation`
- `rules:update`

### `settings-backup:`

- `settings-backup:apply-full`
- `settings-backup:build-preview`
- `settings-backup:export-to-file`
- `settings-backup:get-auto-backup-status`
- `settings-backup:pick-and-read`
- `settings-backup:pick-auto-backup-directory`
- `settings-backup:run-auto-backup-now`
- `settings-backup:set-auto-backup`
- `settings-backup:summarize`

### `tasks:`

- `tasks:bulk-delete-completed-flagged-email-tasks`
- `tasks:clear-local-tasks-cache`
- `tasks:clear-planned-schedule`
- `tasks:create-mail-cloud-task-from-message`
- `tasks:create-task`
- `tasks:delete-task`
- `tasks:list-lists`
- `tasks:list-mail-cloud-task-links`
- `tasks:list-planned-schedules`
- `tasks:list-tasks`
- `tasks:patch-task`
- `tasks:patch-task-display`
- `tasks:promote-mail-todo-to-cloud-task`
- `tasks:set-planned-schedule`
- `tasks:update-task`

### `teams-chat-popout:`

- `teams-chat-popout:close`
- `teams-chat-popout:close-all`
- `teams-chat-popout:focus`
- `teams-chat-popout:get-always-on-top`
- `teams-chat-popout:is-open`
- `teams-chat-popout:list-open`
- `teams-chat-popout:open`
- `teams-chat-popout:set-always-on-top`

### `vip:`

- `vip:add`
- `vip:list`
- `vip:remove`

### `weather:`

- `weather:forecast`
- `weather:geocode`

### `workflow:`

- `workflow:list-boards`
- `workflow:update-board-columns`

## Push-Events (ohne invoke)

Main sendet mit `webContents.send`; Preload abonniert via `ipcRenderer.on` und stellt Listener unter `window.mailClient.events` bereit.

| Kanal | Typische Nutzung |
|-------|------------------|
| `accounts:changed` | Kontenliste im Renderer |
| `app:connectivity` | Online/Offline-Badge |
| `app:window-maximized-changed` | — |
| `calendar:changed` | Kalender-Events neu laden |
| `calendar:ics-file-open` | — |
| `calendar:sync-status` | — |
| `entity-embeddings:index-progress` | — |
| `entity-links:ai-scan-progress` | — |
| `entity-links:changed` | Verbindungs-Graph invalidieren |
| `mail-body-index:progress` | — |
| `mail:bulk-unflag-progress` | — |
| `mail:changed` | Mail-Liste / Ordner-Zähler neu laden |
| `mail:sync-meta-changed` | — |
| `mail-reading-popout:closed` | — |
| `mail-reading-popout:dock` | — |
| `notes:changed` | Notizen-Listen aktualisieren |
| `panel-popout:closed` | — |
| `panel-popout:dock` | — |
| `profile-sync:applied` | Profil-Daten nach Pull anwenden |
| `profile-sync:status` | Cloud-Sync-Status |
| `sync:status` | Sync-Fortschritt in UI |
| `tasks:changed` | Cloud-Tasks neu laden |
| `teams-chat-popout:closed` | — |

## Neue Kanäle hinzufügen

1. Konstante in `src/shared/ipc-channels.ts`
2. Input/Output-Typen in `src/shared/types.ts` (oder domänennahes Modul)
3. `ipcMain.handle` in passender `register-*-ipc.ts`
4. Methode in `src/preload/index.ts` → `window.mailClient`
5. Typ in `src/renderer/src/global.d.ts` (MailClientApi)
6. Dieses Dokument neu generieren: `npm run docs:ipc-reference`
