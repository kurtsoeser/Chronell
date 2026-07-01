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
  type UserNoteMoveToParentInput,
  type UserNoteSetCategoriesInput,
  type UserNoteSetPinnedInput,
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

export const notesApi = {
getMail: (messageId: number): Promise<UserNote | null> =>
      ipcRenderer.invoke(IPC.notes.getMail, messageId),
    upsertMail: (input: UserNoteMailUpsertInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.upsertMail, input),
    getPeopleContact: (contactId: number): Promise<UserNote | null> =>
      ipcRenderer.invoke(IPC.notes.getPeopleContact, contactId),
    upsertPeopleContact: (input: UserNotePeopleContactUpsertInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.upsertPeopleContact, input),
    getCalendar: (key: UserNoteCalendarKey): Promise<UserNote | null> =>
      ipcRenderer.invoke(IPC.notes.getCalendar, key),
    upsertCalendar: (input: UserNoteCalendarUpsertInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.upsertCalendar, input),
    createStandalone: (input: UserNoteStandaloneCreateInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.createStandalone, input),
    updateStandalone: (input: UserNoteStandaloneUpdateInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.updateStandalone, input),
    delete: (id: number): Promise<void> => ipcRenderer.invoke(IPC.notes.delete, id),
    list: (filters?: UserNoteListFilters): Promise<UserNoteListItem[]> =>
      ipcRenderer.invoke(IPC.notes.list, filters ?? {}),
    search: (filters: UserNoteSearchFilters): Promise<UserNoteListItem[]> =>
      ipcRenderer.invoke(IPC.notes.search, filters),
    getById: (id: number): Promise<UserNoteListItem | null> =>
      ipcRenderer.invoke(IPC.notes.getById, id),
    patchDisplay: (input: UserNotePatchDisplayInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.patchDisplay, input),
    listInRange: (filters: UserNoteListInRangeFilters): Promise<UserNoteListItem[]> =>
      ipcRenderer.invoke(IPC.notes.listInRange, filters),
    setSchedule: (input: UserNoteScheduleInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.setSchedule, input),
    clearSchedule: (id: number): Promise<UserNote> => ipcRenderer.invoke(IPC.notes.clearSchedule, id),
    moveToSection: (input: UserNoteMoveToSectionInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.moveToSection, input),
    moveToParent: (input: UserNoteMoveToParentInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.moveToParent, input),
    setCategories: (input: UserNoteSetCategoriesInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.setCategories, input),
    setPinned: (input: UserNoteSetPinnedInput): Promise<UserNote> =>
      ipcRenderer.invoke(IPC.notes.setPinned, input),
    sections: {
      list: (): Promise<NoteSection[]> => ipcRenderer.invoke(IPC.notes.sectionsList),
      create: (input: NoteSectionCreateInput): Promise<NoteSection> =>
        ipcRenderer.invoke(IPC.notes.sectionsCreate, input),
      update: (input: NoteSectionUpdateInput): Promise<NoteSection> =>
        ipcRenderer.invoke(IPC.notes.sectionsUpdate, input),
      delete: (id: number): Promise<void> => ipcRenderer.invoke(IPC.notes.sectionsDelete, id),
      reorder: (input: NoteSectionReorderInput): Promise<void> =>
        ipcRenderer.invoke(IPC.notes.sectionsReorder, input)
    },
    links: {
      list: (fromNoteId: number): Promise<NoteLinksBundle> =>
        ipcRenderer.invoke(IPC.notes.linksList, fromNoteId),
      add: (input: UserNoteLinkAddInput): Promise<void> =>
        ipcRenderer.invoke(IPC.notes.linksAdd, input),
      remove: (input: UserNoteLinkRemoveInput): Promise<void> =>
        ipcRenderer.invoke(IPC.notes.linksRemove, input),
      searchTargets: (args: {
        query?: string
        excludeNoteId?: number
        limit?: number
      }): Promise<NoteLinkTargetCandidate[]> =>
        ipcRenderer.invoke(IPC.notes.linksSearchTargets, args),
      listForContact: (contactId: number): Promise<PeopleContactLinkedNote[]> =>
        ipcRenderer.invoke(IPC.notes.listForContact, contactId)
    },
    attachments: {
      list: (noteId: number): Promise<UserNoteAttachment[]> =>
        ipcRenderer.invoke(IPC.notes.attachmentsList, noteId),
      addLocal: (input: UserNoteAttachmentAddLocalInput): Promise<UserNoteAttachment> =>
        ipcRenderer.invoke(IPC.notes.attachmentsAddLocal, input),
      addCloud: (input: UserNoteAttachmentAddCloudInput): Promise<UserNoteAttachment> =>
        ipcRenderer.invoke(IPC.notes.attachmentsAddCloud, input),
      remove: (args: { noteId: number; attachmentId: number }): Promise<void> =>
        ipcRenderer.invoke(IPC.notes.attachmentsRemove, args),
      open: (args: {
        noteId: number
        attachmentId: number
      }): Promise<{ ok: boolean; error?: string }> =>
        ipcRenderer.invoke(IPC.notes.attachmentsOpen, args),
      saveAs: (args: {
        noteId: number
        attachmentId: number
        suggestedName?: string
      }): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> =>
        ipcRenderer.invoke(IPC.notes.attachmentsSaveAs, args),
      readLocal: (args: {
        noteId: number
        attachmentId: number
      }): Promise<
        | { ok: true; dataBase64: string; contentType: string }
        | { ok: false; error: string }
      > => ipcRenderer.invoke(IPC.notes.attachmentsReadLocal, args)
    },
    exportPdf: (input: {
      title: string
      bodyHtml: string
      suggestedFileName?: string
    }): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> =>
      ipcRenderer.invoke(IPC.notes.exportPdf, input),
    printPage: (input: {
      title: string
      bodyHtml: string
    }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke(IPC.notes.printPage, input),
    readClipboardImage: (): Promise<{ dataBase64: string; contentType: string } | null> =>
      ipcRenderer.invoke(IPC.notes.readClipboardImage),
    onScreenClipTrigger: (handler: () => void): (() => void) => {
      const listener = (): void => handler()
      ipcRenderer.on('notes:screen-clip-trigger', listener)
      return (): void => {
        ipcRenderer.removeListener('notes:screen-clip-trigger', listener)
      }
    }
}
