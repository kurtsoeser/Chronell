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

export const mailApi = {
listFolders: (accountId: string): Promise<MailFolder[]> =>
      ipcRenderer.invoke(IPC.mail.listFolders, accountId),
    getUnifiedInboxUnreadCount: (): Promise<number> =>
      ipcRenderer.invoke(IPC.mail.getUnifiedInboxUnreadCount),
    listMessages: (options: {
      folderId?: number
      accountId?: string
      limit?: number
    }): Promise<MailListItem[]> => ipcRenderer.invoke(IPC.mail.listMessages, options),
    listInboxTriage: (limit?: number | null): Promise<MailListItem[]> =>
      limit === undefined
        ? ipcRenderer.invoke(IPC.mail.listInboxTriage, {})
        : ipcRenderer.invoke(IPC.mail.listInboxTriage, { limit }),
    listUnifiedInbox: (
      limit?: number | null,
      options?: { includeOpenTodo?: boolean }
    ): Promise<MailListItem[]> => ipcRenderer.invoke(IPC.mail.listUnifiedInbox, limit, options),
    listMetaFolders: (): Promise<MetaFolderSummary[]> =>
      ipcRenderer.invoke(IPC.mail.listMetaFolders),
    getMetaFolder: (id: number): Promise<MetaFolderSummary | null> =>
      ipcRenderer.invoke(IPC.mail.getMetaFolder, id),
    createMetaFolder: (input: MetaFolderCreateInput): Promise<MetaFolderSummary> =>
      ipcRenderer.invoke(IPC.mail.createMetaFolder, input),
    updateMetaFolder: (input: MetaFolderUpdateInput): Promise<MetaFolderSummary> =>
      ipcRenderer.invoke(IPC.mail.updateMetaFolder, input),
    deleteMetaFolder: (id: number): Promise<void> => ipcRenderer.invoke(IPC.mail.deleteMetaFolder, id),
    reorderMetaFolders: (orderedIds: number[]): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.reorderMetaFolders, orderedIds),
    listMetaFolderMessages: (metaFolderId: number): Promise<MailListItem[]> =>
      ipcRenderer.invoke(IPC.mail.listMetaFolderMessages, metaFolderId),
    listCategoryMessages: (args: {
      accountId: string | null
      category: string
      limit?: number | null
    }): Promise<MailListItem[]> => ipcRenderer.invoke(IPC.mail.listCategoryMessages, args),
    listCorrespondence: (
      args: import('@shared/types').ListCorrespondenceInput
    ): Promise<import('@shared/types').ListCorrespondenceResult> =>
      ipcRenderer.invoke(IPC.mail.listCorrespondence, args),
    getSenderDomainAvatarDataUrl: (email: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.mail.getSenderDomainAvatarDataUrl, email),
    getMessage: (id: number): Promise<MailFull | null> =>
      ipcRenderer.invoke(IPC.mail.getMessage, id),
    listThreadMessages: (args: { accountId: string; threadKey: string }): Promise<MailFull[]> =>
      ipcRenderer.invoke(IPC.mail.listThreadMessages, args),
    listMessagesByThreads: (args: {
      accountId: string
      threadKeys: string[]
    }): Promise<MailListItem[]> =>
      ipcRenderer.invoke(IPC.mail.listMessagesByThreads, args),
    fetchInlineImages: (messageId: number): Promise<Record<string, string>> =>
      ipcRenderer.invoke(IPC.mail.fetchInlineImages, { messageId }),
    listAttachments: (messageId: number): Promise<AttachmentMeta[]> =>
      ipcRenderer.invoke(IPC.mail.listAttachments, { messageId }),
    openAttachment: (
      messageId: number,
      attachmentId: string
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.mail.openAttachment, { messageId, attachmentId }),
    saveAttachmentAs: (
      messageId: number,
      attachmentId: string,
      suggestedName?: string
    ): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> =>
      ipcRenderer.invoke(IPC.mail.saveAttachmentAs, {
        messageId,
        attachmentId,
        suggestedName
      }),
    syncAttachmentsFlag: (messageId: number, value: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.syncAttachmentsFlag, { messageId, value }),
    refreshNow: (folderId: number | null): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.refreshNow, { folderId }),
    setActiveFolder: (folderId: number | null): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.setActiveFolder, { folderId }),
    search: (query: string, limit?: number): Promise<SearchHit[]> =>
      ipcRenderer.invoke(IPC.mail.search, { query, limit }),
    syncAccount: (accountId: string): Promise<{ folders: number; inboxMessages: number }> =>
      ipcRenderer.invoke(IPC.mail.syncAccount, accountId),
    getAccountSyncMeta: (): Promise<import('@shared/types').AccountMailSyncMeta[]> =>
      ipcRenderer.invoke(IPC.mail.getAccountSyncMeta),
    clearLocalMailCache: (accountId: string): Promise<ClearLocalMailCacheResult> =>
      ipcRenderer.invoke(IPC.mail.clearLocalMailCache, accountId),
    bulkUnflagFlaggedMessages: (input: MailBulkUnflagInput): Promise<MailBulkUnflagResult> =>
      ipcRenderer.invoke(IPC.mail.bulkUnflagFlaggedMessages, input),
    syncFolder: (folderId: number): Promise<number> =>
      ipcRenderer.invoke(IPC.mail.syncFolder, folderId),
    markAllReadInFolder: (folderId: number): Promise<{ markedLocal: number }> =>
      ipcRenderer.invoke(IPC.mail.markAllReadInFolder, folderId),
    setRead: (messageId: number, isRead: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.setRead, { messageId, isRead }),
    setFlagged: (messageId: number, flagged: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.setFlagged, { messageId, flagged }),
    archive: (messageId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.archive, messageId),
    moveToTrash: (messageId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.moveToTrash, messageId),
    moveToFolder: (args: { messageId: number; targetFolderId: number }): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.moveToFolder, args),
    permanentDeleteMessage: (messageId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.permanentDeleteMessage, messageId),
    emptyTrashFolder: (folderId: number): Promise<{ deletedRemote: number }> =>
      ipcRenderer.invoke(IPC.mail.emptyTrashFolder, folderId),
    snooze: (messageId: number, wakeAt: string, preset?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.snooze, { messageId, wakeAt, preset }),
    unsnooze: (messageId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.unsnooze, messageId),
    listSnoozed: (limit?: number): Promise<SnoozedMessageItem[]> =>
      ipcRenderer.invoke(IPC.mail.listSnoozed, { limit }),
    listTodoMessages: (args: {
      accountId: string | null
      dueKind: TodoDueKindList
      limit?: number
    }): Promise<MailListItem[]> => ipcRenderer.invoke(IPC.mail.listTodoMessages, args),
    listAllOpenTodoMessages: (args?: {
      accountId?: string | null
      limit?: number
    }): Promise<MailListItem[]> =>
      ipcRenderer.invoke(IPC.mail.listAllOpenTodoMessages, args ?? {}),
    listTodoMessagesInRange: (args: {
      accountId: string | null
      rangeStartIso: string
      rangeEndIso: string
      limit?: number
    }): Promise<MailListItem[]> => ipcRenderer.invoke(IPC.mail.listTodoMessagesInRange, args),
    listTodoCounts: (): Promise<TodoCountsAll> => ipcRenderer.invoke(IPC.mail.listTodoCounts),
    listTemplates: (): Promise<MailTemplate[]> => ipcRenderer.invoke(IPC.mail.listTemplates),
    listQuickSteps: (): Promise<MailQuickStep[]> => ipcRenderer.invoke(IPC.mail.listQuickSteps),
    listQuickStepsAll: (): Promise<MailQuickStep[]> => ipcRenderer.invoke(IPC.mail.listQuickStepsAll),
    getQuickStep: (id: number): Promise<import('@shared/quicksteps').MailQuickStepDetail | null> =>
      ipcRenderer.invoke(IPC.mail.getQuickStep, id),
    saveQuickStep: (
      input: import('@shared/quicksteps').SaveMailQuickStepInput
    ): Promise<import('@shared/quicksteps').MailQuickStepDetail> =>
      ipcRenderer.invoke(IPC.mail.saveQuickStep, input),
    deleteQuickStep: (id: number): Promise<void> => ipcRenderer.invoke(IPC.mail.deleteQuickStep, id),
    runQuickStep: (args: { quickStepId: number; messageId: number }): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.runQuickStep, args),
    setTodoForMessage: (args: {
      messageId: number
      dueKind: TodoDueKindOpen
    }): Promise<void> => ipcRenderer.invoke(IPC.mail.setTodoForMessage, args),
    setTodoScheduleForMessage: (args: {
      messageId: number
      startIso: string
      endIso: string
    }): Promise<void> => ipcRenderer.invoke(IPC.mail.setTodoScheduleForMessage, args),
    completeTodoForMessage: (messageId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.completeTodoForMessage, messageId),
    removeMailTodoRecordsForMessage: (messageId: number): Promise<RemoveMailTodoRecordsResult> =>
      ipcRenderer.invoke(IPC.mail.removeMailTodoRecordsForMessage, messageId),
    listWaitingMessages: (args?: { limit?: number }): Promise<MailListItem[]> =>
      ipcRenderer.invoke(IPC.mail.listWaitingMessages, args ?? {}),
    setWaitingForMessage: (args: {
      messageId: number
      days?: number
    }): Promise<void> => ipcRenderer.invoke(IPC.mail.setWaitingForMessage, args),
    clearWaitingForMessage: (messageId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.clearWaitingForMessage, messageId),
    undoLast: (): Promise<UndoResult> => ipcRenderer.invoke(IPC.mail.undoLast),
    peekUndo: (): Promise<UndoableActionSummary | null> =>
      ipcRenderer.invoke(IPC.mail.peekUndo),
    unsubscribeOneClick: (messageId: number): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.unsubscribeOneClick, messageId),
    setMessageCategories: (args: {
      messageId: number
      categories: string[]
    }): Promise<void> => ipcRenderer.invoke(IPC.mail.setMessageCategories, args),
    listMasterCategories: (accountId: string): Promise<MailMasterCategory[]> =>
      ipcRenderer.invoke(IPC.mail.listMasterCategories, accountId),
    createMasterCategory: (args: {
      accountId: string
      displayName: string
      color: string
    }): Promise<MailMasterCategory> =>
      ipcRenderer.invoke(IPC.mail.createMasterCategory, args),
    updateMasterCategory: (args: {
      accountId: string
      categoryId: string
      displayName?: string
      color?: string
    }): Promise<void> => ipcRenderer.invoke(IPC.mail.updateMasterCategory, args),
    deleteMasterCategory: (args: { accountId: string; categoryId: string }): Promise<void> =>
      ipcRenderer.invoke(IPC.mail.deleteMasterCategory, args),
    listDistinctMessageTags: (accountId: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.mail.listDistinctMessageTags, accountId),
    getWorkflowMailFolderState: (accountId: string): Promise<WorkflowMailFolderUiState> =>
      ipcRenderer.invoke(IPC.mail.getWorkflowMailFolderState, accountId),
    ensureWorkflowMailFolders: (accountId: string): Promise<EnsureWorkflowMailFoldersResult> =>
      ipcRenderer.invoke(IPC.mail.ensureWorkflowMailFolders, accountId),
    setWorkflowMailFolderMapping: (args: {
      accountId: string
      wipFolderId: number | null
      doneFolderId: number | null
    }): Promise<void> => ipcRenderer.invoke(IPC.mail.setWorkflowMailFolderMapping, args)
}
