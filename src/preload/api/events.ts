import { ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type AppConfig,
  type AppConnectivityState,
  type GlobalSearchResult,
  type AttachmentMeta,
  type ConnectedAccount,
  type MailFolder,
  type MailListItem,
  type MailFull,
  type MailChangedPayload,
  type SearchHit,
  type SnoozedMessageItem,
  type SyncStatus,
  type ComposeSendInput,
  type ComposeSendResult,
  type ComposeSaveDraftInput,
  type ComposeSaveDraftResult,
  type ComposeDisposeDraftInput,
  type UndoableActionSummary,
  type ComposeRecipientSuggestion,
  type ComposeListDriveExplorerInput,
  type ComposeDriveExplorerEntry,
  type ComposeDriveExplorerFavorite,
  type ComposeAddDriveExplorerFavoriteInput,
  type ComposeRemoveDriveExplorerFavoriteInput,
  type ComposeUpdateDriveExplorerFavoriteCacheInput,
  type ComposeRenameDriveExplorerFavoriteInput,
  type ComposeReorderDriveExplorerFavoritesInput,
  type ComposeCreateDriveSharingLinkInput,
  type ComposeCreateDriveSharingLinkResult,
  type UndoResult,
  type RemoveMailTodoRecordsResult,
  type TodoDueKindOpen,
  type TodoDueKindList,
  type TodoCountsAll,
  type MailTemplate,
  type MailQuickStep,
  type CalendarEventView,
  type CalendarSuggestionFromMail,
  type CalendarSaveEventInput,
  type CalendarSaveEventResult,
  type CalendarUpdateEventInput,
  type CalendarGetEventInput,
  type CalendarGetEventResult,
  type CalendarDeleteEventInput,
  type CalendarGraphCalendarRow,
  type CalendarListCalendarsInput,
  type CalendarM365GroupCalendarsPage,
  type CalendarListEventsInput,
  type CalendarPatchEventIconInput,
  type CalendarPatchScheduleInput,
  type CalendarPatchCalendarColorInput,
  type PatchAccountInput,
  type TaskItemRow,
  type TaskListRow,
  type TasksCreateTaskInput,
  type TasksDeleteTaskInput,
  type TasksBulkDeleteCompletedFlaggedEmailInput,
  type TasksBulkDeleteCompletedFlaggedEmailResult,
  type TasksListListsInput,
  type TasksListTasksInput,
  type TasksPatchTaskDisplayInput,
  type TasksPatchTaskInput,
  type TasksClearPlannedScheduleInput,
  type TasksListPlannedSchedulesInput,
  type TasksSetPlannedScheduleInput,
  type TaskPlannedScheduleDto,
  type TasksUpdateTaskInput,
  type TasksCreateMailCloudTaskFromMessageInput,
  type TasksPromoteMailTodoToCloudTaskInput,
  type MailCloudTaskLinkDto,
  type WorkflowBoard,
  type WorkflowColumn,
  type MailMasterCategory,
  type WorkflowMailFolderUiState,
  type EnsureWorkflowMailFoldersResult,
  type MetaFolderSummary,
  type MetaFolderCreateInput,
  type MetaFolderUpdateInput,
  type TeamsChatSummary,
  type TeamsChatMessageView,
  type TeamsChatPopoutOpenInput,
  type TeamsChatPopoutRef,
  type TeamsChatPopoutListItem,
  type MailReadingPopoutOpenInput,
  type MailReadingPopoutRef,
  type SettingsBackupExportResult,
  type SettingsBackupPickResult,
  type SettingsBackupPayload,
  type LocalDataUsageReport,
  type LocalDataOptimizeResult,
  type LocalDataArchiveExportMode,
  type LocalDataArchiveExportResult,
  type LocalDataArchiveImportResult,
  type AppConfigWeatherLocation,
  type OpenMeteoForecast,
  type OpenMeteoGeocodeHit,
  type LocationSuggestion,
  type NoteSection,
  type NoteSectionCreateInput,
  type NoteSectionReorderInput,
  type NoteSectionUpdateInput,
  type UserNote,
  type UserNoteCalendarKey,
  type UserNoteCalendarUpsertInput,
  type UserNoteKind,
  type NoteLinksBundle,
  type NoteEntityLinkTarget,
  type NoteLinkTargetCandidate,
  type PeopleContactLinkedNote,
  type UserNoteLinkAddInput,
  type UserNoteLinkRemoveInput,
  type UserNoteListFilters,
  type UserNoteSearchFilters,
  type UserNoteListInRangeFilters,
  type UserNoteListItem,
  type UserNoteMailUpsertInput,
  type UserNotePeopleContactUpsertInput,
  type UserNoteMoveToSectionInput,
  type UserNoteScheduleInput,
  type UserNoteStandaloneCreateInput,
  type UserNotePatchDisplayInput,
  type UserNoteStandaloneUpdateInput,
  type UserNoteAttachment,
  type UserNoteAttachmentAddLocalInput,
  type UserNoteAttachmentAddCloudInput,
  type BookingsAppointmentRow,
  type BookingsBusinessDetail,
  type BookingsBusinessRow,
  type BookingsGetBusinessInput,
  type BookingsListAppointmentsInput,
  type BookingsListBusinessesInput,
  type BookingsListServicesInput,
  type BookingsListStaffMembersInput,
  type BookingsStaffMemberRow,
  type BookingsServiceRow,
  type PeopleContactView,
  type PeopleCreateContactInput,
  type PeopleListInput,
  type PeopleNavCounts,
  type PeopleSetContactPhotoInput,
  type PeopleSetFavoriteInput,
  type PeopleSyncAccountResult,
  type PeopleUpdateContactInput,
  type ClearLocalMailCacheResult,
  type MailBulkUnflagInput,
  type MailBulkUnflagResult,
  type MailBulkUnflagProgressPayload,
  type ClearLocalTasksCacheResult,
  type NotionAppendEventInput,
  type NotionAppendMailInput,
  type NotionAppendResult,
  type NotionConnectionStatus,
  type NotionCreateEventPageInput,
  type NotionCreateMailPageInput,
  type NotionCreatePageInput,
  type NotionCreatePageResult,
  type NotionDestinationsConfig,
  type NotionSearchPageHit,
  type NotionSavedDestination
} from '@shared/types'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type {
  EntityGraphSnapshot,
  EntityLinkAddInput,
  EntityLinkAiScanInput,
  EntityLinkAiScanStatus,
  EntityLinkAiSuggestInput,
  EntityLinkPathInput,
  EntityLinkPathResult,
  EntityLinkRemoveInput,
  EntityLinkSearchTargetsInput,
  EntityLinkSuggestion,
  EntityLinkTargetCandidate,
  EntityLinksListResult,
  EntityNeighborhoodInput,
  EntityPaletteListInput
} from '@shared/entity-links'
import type {
  AiConnectionsProvider,
  AiConnectionsSetApiKeyInput,
  AiConnectionsSetSettingsInput,
  AiConnectionsSettings
} from '@shared/ai-connections'
import type {
  MailRuleDefinition,
  MailRuleTrigger,
  MailRuleDto,
  MailRuleDryRunResult,
  AutomationInboxEntry
} from '@shared/mail-rules'
import {
  mailChangedHandlers,
  calendarChangedHandlers,
  tasksChangedHandlers,
  zoomShortcutHandlers
} from '../ipc-listeners'

export const eventsApi = {
onAccountsChanged: (handler: (accounts: ConnectedAccount[]) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, accounts: ConnectedAccount[]): void =>
        handler(accounts)
      ipcRenderer.on('accounts:changed', listener)
      return (): void => {
        ipcRenderer.off('accounts:changed', listener)
      }
    },
    onSyncStatus: (handler: (status: SyncStatus) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, status: SyncStatus): void => handler(status)
      ipcRenderer.on('sync:status', listener)
      return (): void => {
        ipcRenderer.off('sync:status', listener)
      }
    },
    onMailSyncMetaChanged: (handler: (payload: { accountId: string }) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, payload: { accountId: string }): void =>
        handler(payload)
      ipcRenderer.on('mail:sync-meta-changed', listener)
      return (): void => {
        ipcRenderer.off('mail:sync-meta-changed', listener)
      }
    },
    onConnectivityChange: (handler: (payload: { online: boolean }) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, payload: { online: boolean }): void => handler(payload)
      ipcRenderer.on('app:connectivity', listener)
      return (): void => {
        ipcRenderer.off('app:connectivity', listener)
      }
    },
    onWindowMaximizedChanged: (handler: (maximized: boolean) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, maximized: boolean): void => handler(Boolean(maximized))
      ipcRenderer.on('app:window-maximized-changed', listener)
      return (): void => {
        ipcRenderer.off('app:window-maximized-changed', listener)
      }
    },
    onMailChanged: (handler: (payload: MailChangedPayload) => void): (() => void) => {
      mailChangedHandlers.add(handler)
      return (): void => {
        mailChangedHandlers.delete(handler)
      }
    },
    onZoomShortcut: (
      handler: (intent: import('@shared/zoom-shortcut-keys').ZoomShortcutIntent) => void
    ): (() => void) => {
      zoomShortcutHandlers.add(handler)
      return (): void => {
        zoomShortcutHandlers.delete(handler)
      }
    },
    onMailBulkUnflagProgress: (handler: (payload: MailBulkUnflagProgressPayload) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, payload: MailBulkUnflagProgressPayload): void =>
        handler(payload)
      ipcRenderer.on('mail:bulk-unflag-progress', listener)
      return (): void => {
        ipcRenderer.off('mail:bulk-unflag-progress', listener)
      }
    },
    onCalendarChanged: (handler: (payload: { accountId: string }) => void): (() => void) => {
      calendarChangedHandlers.add(handler)
      return (): void => {
        calendarChangedHandlers.delete(handler)
      }
    },
    onCalendarSyncStatus: (handler: (status: SyncStatus) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, status: SyncStatus): void => handler(status)
      ipcRenderer.on('calendar:sync-status', listener)
      return (): void => {
        ipcRenderer.off('calendar:sync-status', listener)
      }
    },
    onTasksChanged: (handler: (payload: { accountId: string }) => void): (() => void) => {
      tasksChangedHandlers.add(handler)
      return (): void => {
        tasksChangedHandlers.delete(handler)
      }
    },
    onNotesChanged: (
      handler: (payload: {
        kind?: UserNoteKind
        noteId?: number
        messageId?: number | null
        accountId?: string | null
      }) => void
    ): (() => void) => {
      const listener = (
        _e: IpcRendererEvent,
        payload: {
          kind?: UserNoteKind
          noteId?: number
          messageId?: number | null
          accountId?: string | null
        }
      ): void => handler(payload)
      ipcRenderer.on('notes:changed', listener)
      return (): void => {
        ipcRenderer.off('notes:changed', listener)
      }
    },
    onEntityLinksChanged: (handler: () => void): (() => void) => {
      const listener = (): void => handler()
      ipcRenderer.on('entity-links:changed', listener)
      return (): void => {
        ipcRenderer.off('entity-links:changed', listener)
      }
    },
    onEntityLinkAiScanProgress: (
      handler: (status: EntityLinkAiScanStatus) => void
    ): (() => void) => {
      const listener = (_e: IpcRendererEvent, status: EntityLinkAiScanStatus): void =>
        handler(status)
      ipcRenderer.on('entity-links:ai-scan-progress', listener)
      return (): void => {
        ipcRenderer.off('entity-links:ai-scan-progress', listener)
      }
    },
    onEntityEmbeddingProgress: (
      handler: (progress: import('@shared/entity-embeddings').EntityEmbeddingProgress | null) => void
    ): (() => void) => {
      const listener = (
        _e: IpcRendererEvent,
        progress: import('@shared/entity-embeddings').EntityEmbeddingProgress | null
      ): void => handler(progress)
      ipcRenderer.on('entity-embeddings:index-progress', listener)
      return (): void => {
        ipcRenderer.off('entity-embeddings:index-progress', listener)
      }
    },
    onMailBodyIndexProgress: (
      handler: (progress: import('@shared/mail-body-index').MailBodyIndexProgress | null) => void
    ): (() => void) => {
      const listener = (
        _e: IpcRendererEvent,
        progress: import('@shared/mail-body-index').MailBodyIndexProgress | null
      ): void => handler(progress)
      ipcRenderer.on('mail-body-index:progress', listener)
      return (): void => {
        ipcRenderer.off('mail-body-index:progress', listener)
      }
    },
    onTeamsChatPopoutClosed: (handler: (payload: TeamsChatPopoutRef) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, payload: TeamsChatPopoutRef): void => handler(payload)
      ipcRenderer.on('teams-chat-popout:closed', listener)
      return (): void => {
        ipcRenderer.off('teams-chat-popout:closed', listener)
      }
    },
    onMailReadingPopoutClosed: (handler: (payload: MailReadingPopoutRef) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, payload: MailReadingPopoutRef): void => handler(payload)
      ipcRenderer.on('mail-reading-popout:closed', listener)
      return (): void => {
        ipcRenderer.off('mail-reading-popout:closed', listener)
      }
    },
    onPanelPopoutClosed: (
      handler: (payload: import('@shared/panel-popout').PanelPopoutClosedPayload) => void
    ): (() => void) => {
      const listener = (
        _e: IpcRendererEvent,
        payload: import('@shared/panel-popout').PanelPopoutClosedPayload
      ): void => handler(payload)
      ipcRenderer.on('panel-popout:closed', listener)
      return (): void => {
        ipcRenderer.off('panel-popout:closed', listener)
      }
    },
    onPanelPopoutDock: (
      handler: (payload: import('@shared/panel-popout').PanelPopoutDockPayload) => void
    ): (() => void) => {
      const listener = (
        _e: IpcRendererEvent,
        payload: import('@shared/panel-popout').PanelPopoutDockPayload
      ): void => handler(payload)
      ipcRenderer.on('panel-popout:dock', listener)
      return (): void => {
        ipcRenderer.off('panel-popout:dock', listener)
      }
    },
    onMailReadingPopoutDock: (handler: (payload: MailReadingPopoutRef) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, payload: MailReadingPopoutRef): void =>
        handler(payload)
      ipcRenderer.on('mail-reading-popout:dock', listener)
      return (): void => {
        ipcRenderer.off('mail-reading-popout:dock', listener)
      }
    },
    onProfileSyncStatus: (
      handler: (status: import('@shared/types').ProfileSyncStatus) => void
    ): (() => void) => {
      const listener = (_e: IpcRendererEvent, status: import('@shared/types').ProfileSyncStatus): void =>
        handler(status)
      ipcRenderer.on('profile-sync:status', listener)
      return (): void => {
        ipcRenderer.off('profile-sync:status', listener)
      }
    },
    onProfileSyncApplied: (
      handler: (payload: { localStorage: Record<string, string> }) => void
    ): (() => void) => {
      const listener = (
        _e: IpcRendererEvent,
        payload: { localStorage: Record<string, string> }
      ): void => handler(payload)
      ipcRenderer.on('profile-sync:applied', listener)
      return (): void => {
        ipcRenderer.off('profile-sync:applied', listener)
      }
    }
}
