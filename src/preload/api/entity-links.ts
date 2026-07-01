import { ipcRenderer } from 'electron'
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

export const entityLinksApi = {
list: (anchor: ChronellEntityRef): Promise<EntityLinksListResult> =>
      ipcRenderer.invoke(IPC.entityLinks.list, anchor),
    add: (input: EntityLinkAddInput): Promise<void> =>
      ipcRenderer.invoke(IPC.entityLinks.add, input),
    remove: (input: EntityLinkRemoveInput): Promise<void> =>
      ipcRenderer.invoke(IPC.entityLinks.remove, input),
    searchTargets: (input: EntityLinkSearchTargetsInput): Promise<EntityLinkTargetCandidate[]> =>
      ipcRenderer.invoke(IPC.entityLinks.searchTargets, input),
    getMailTodoMessageId: (todoId: number): Promise<number | null> =>
      ipcRenderer.invoke(IPC.entityLinks.getMailTodoMessageId, todoId),
    listGraph: (): Promise<EntityGraphSnapshot> =>
      ipcRenderer.invoke(IPC.entityLinks.listGraph),
    listNeighborhood: (input: EntityNeighborhoodInput): Promise<EntityGraphSnapshot> =>
      ipcRenderer.invoke(IPC.entityLinks.listNeighborhood, input),
    findPath: (input: EntityLinkPathInput): Promise<EntityLinkPathResult | null> =>
      ipcRenderer.invoke(IPC.entityLinks.findPath, input),
    suggest: (anchor: ChronellEntityRef): Promise<EntityLinkSuggestion[]> =>
      ipcRenderer.invoke(IPC.entityLinks.suggest, anchor),
    suggestAi: (
      input: EntityLinkAiSuggestInput
    ): Promise<import('@shared/entity-links').EntityLinkAiSuggestResult> =>
      ipcRenderer.invoke(IPC.entityLinks.suggestAi, input),
    getGraphDensityStats: (
      lookbackDays: number
    ): Promise<import('@shared/entity-links').EntityLinkGraphDensityStats> =>
      ipcRenderer.invoke(IPC.entityLinks.getGraphDensityStats, lookbackDays),
    estimateAiScanCost: (
      input?: EntityLinkAiScanInput
    ): Promise<import('@shared/entity-links').EntityLinkAiScanCostEstimate> =>
      ipcRenderer.invoke(IPC.entityLinks.estimateAiScanCost, input ?? {}),
    previewAiPayload: (
      input: import('@shared/entity-link-ai-payload').EntityLinkAiPayloadPreviewInput
    ): Promise<import('@shared/entity-link-ai-payload').EntityLinkAiPayloadPreview | null> =>
      ipcRenderer.invoke(IPC.entityLinks.previewAiPayload, input),
    getHeuristicSuggestionCounts: (
      anchors: ChronellEntityRef[]
    ): Promise<import('@shared/entity-link-ai-payload').EntityLinkSuggestionCountEntry[]> =>
      ipcRenderer.invoke(IPC.entityLinks.getHeuristicSuggestionCounts, anchors),
    listAiAudit: (
      limit?: number
    ): Promise<
      Array<{
        id: number
        kind: string
        anchorKey: string | null
        provider: string | null
        charEstimate: number
        includeExcerpt: boolean
        createdAt: string
      }>
    > => ipcRenderer.invoke(IPC.entityLinks.listAiAudit, limit ?? 15),
    evaluateLinkQuality: (
      input: import('@shared/entity-links').EntityLinkEvaluateQualityInput
    ): Promise<import('@shared/entity-links').EntityLinkEvaluateQualityResult> =>
      ipcRenderer.invoke(IPC.entityLinks.evaluateLinkQuality, input),
    startAiScan: (input?: EntityLinkAiScanInput): Promise<EntityLinkAiScanStatus> =>
      ipcRenderer.invoke(IPC.entityLinks.startAiScan, input ?? {}),
    cancelAiScan: (): Promise<EntityLinkAiScanStatus> =>
      ipcRenderer.invoke(IPC.entityLinks.cancelAiScan),
    getAiScanStatus: (): Promise<EntityLinkAiScanStatus> =>
      ipcRenderer.invoke(IPC.entityLinks.getAiScanStatus),
    acceptAiScanItems: (itemIds: string[]): Promise<number> =>
      ipcRenderer.invoke(IPC.entityLinks.acceptAiScanItems, itemIds),
    dismissAiScanItems: (itemIds: string[]): Promise<number> =>
      ipcRenderer.invoke(IPC.entityLinks.dismissAiScanItems, itemIds),
    dismissAiSuggestion: (input: import('@shared/entity-links').EntityLinkAiDismissInput): Promise<void> =>
      ipcRenderer.invoke(IPC.entityLinks.dismissAiSuggestion, input),
    listPalette: (input: EntityPaletteListInput): Promise<EntityLinkTargetCandidate[]> =>
      ipcRenderer.invoke(IPC.entityLinks.listPalette, input)
}
