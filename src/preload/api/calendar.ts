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

export const calendarApi = {
listEvents: (args: CalendarListEventsInput): Promise<CalendarEventView[]> =>
      ipcRenderer.invoke(IPC.calendar.listEvents, args),
    listEventsForContact: (
      args: import('@shared/types').CalendarListEventsForContactInput
    ): Promise<CalendarEventView[]> =>
      ipcRenderer.invoke(IPC.calendar.listEventsForContact, args),
    listCalendars: (args: CalendarListCalendarsInput): Promise<CalendarGraphCalendarRow[]> =>
      ipcRenderer.invoke(IPC.calendar.listCalendars, args),
    listMicrosoft365GroupCalendars: (args: {
      accountId: string
      offset?: number
      limit?: number
    }): Promise<CalendarM365GroupCalendarsPage> =>
      ipcRenderer.invoke(IPC.calendar.listMicrosoft365GroupCalendars, args),
    patchCalendarColor: (args: CalendarPatchCalendarColorInput): Promise<void> =>
      ipcRenderer.invoke(IPC.calendar.patchCalendarColor, args),
    createTeamsMeeting: (args: {
      accountId: string
      subject: string
      startIso: string
      endIso: string
      bodyHtml?: string
      graphCalendarId?: string | null
      attendeeEmails?: string[] | null
    }): Promise<{ id: string; webLink: string | null; joinUrl: string | null }> =>
      ipcRenderer.invoke(IPC.calendar.createTeamsMeeting, args),
    suggestFromMessage: (messageId: number): Promise<CalendarSuggestionFromMail> =>
      ipcRenderer.invoke(IPC.calendar.suggestFromMessage, messageId),
    findLocalFreeSlots: (
      input: import('@shared/types').CalendarFindLocalFreeSlotsInput
    ): Promise<import('@shared/types').CalendarFreeSlot[]> =>
      ipcRenderer.invoke(IPC.calendar.findLocalFreeSlots, input),
    getAttendeeSchedule: (
      input: import('@shared/types').CalendarGetAttendeeScheduleInput
    ): Promise<import('@shared/types').CalendarAttendeeScheduleView[]> =>
      ipcRenderer.invoke(IPC.calendar.getAttendeeSchedule, input),
    findMeetingTimes: (
      input: import('@shared/types').CalendarFindMeetingTimesInput
    ): Promise<import('@shared/types').CalendarFreeSlot[]> =>
      ipcRenderer.invoke(IPC.calendar.findMeetingTimes, input),
    createEvent: (input: CalendarSaveEventInput): Promise<CalendarSaveEventResult> =>
      ipcRenderer.invoke(IPC.calendar.createEvent, input),
    updateEvent: (input: CalendarUpdateEventInput): Promise<void> =>
      ipcRenderer.invoke(IPC.calendar.updateEvent, input),
    getEvent: (input: CalendarGetEventInput): Promise<CalendarGetEventResult> =>
      ipcRenderer.invoke(IPC.calendar.getEvent, input),
    listEventAttachments: (
      input: import('@shared/types').CalendarListEventAttachmentsInput
    ): Promise<import('@shared/types').CalendarEventAttachmentMeta[]> =>
      ipcRenderer.invoke(IPC.calendar.listEventAttachments, input),
    openEventAttachment: (
      input: import('@shared/types').CalendarEventAttachmentActionInput
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.calendar.openEventAttachment, input),
    saveEventAttachmentAs: (
      input: import('@shared/types').CalendarEventAttachmentActionInput & {
        suggestedName?: string
      }
    ): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> =>
      ipcRenderer.invoke(IPC.calendar.saveEventAttachmentAs, input),
    deleteEvent: (input: CalendarDeleteEventInput): Promise<void> =>
      ipcRenderer.invoke(IPC.calendar.deleteEvent, input),
    transferEvent: (
      input: import('@shared/types').CalendarTransferEventInput
    ): Promise<import('@shared/types').CalendarSaveEventResult> =>
      ipcRenderer.invoke(IPC.calendar.transferEvent, input),
    patchEventSchedule: (input: CalendarPatchScheduleInput): Promise<void> =>
      ipcRenderer.invoke(IPC.calendar.patchEventSchedule, input),
    patchEventIcon: (input: CalendarPatchEventIconInput): Promise<void> =>
      ipcRenderer.invoke(IPC.calendar.patchEventIcon, input),
    patchEventCategories: (args: {
      accountId: string
      graphEventId: string
      categories: string[]
      graphCalendarId?: string | null
    }): Promise<void> => ipcRenderer.invoke(IPC.calendar.patchEventCategories, args),
    syncAccount: (accountId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.calendar.syncAccount, accountId),
    getAccountSyncStates: (): Promise<import('@shared/types').CalendarAccountSyncStateRow[]> =>
      ipcRenderer.invoke(IPC.calendar.getAccountSyncStates),
    parseIcsFile: (filePath: string): Promise<import('@shared/types').CalendarParseIcsFileResult> =>
      ipcRenderer.invoke(IPC.calendar.parseIcsFile, filePath),
    pickIcsFile: (): Promise<
      import('@shared/types').CalendarParseIcsFileResult | { cancelled: true }
    > => ipcRenderer.invoke(IPC.calendar.pickIcsFile),
    parseMeetingFromMessage: (
      messageId: number
    ): Promise<import('@shared/types').CalendarParseMeetingFromMessageResult> =>
      ipcRenderer.invoke(IPC.calendar.parseMeetingFromMessage, messageId),
    respondToMeetingInvitation: (
      input: import('@shared/types').CalendarRespondToMeetingInput
    ): Promise<import('@shared/types').CalendarRespondToMeetingResult> =>
      ipcRenderer.invoke(IPC.calendar.respondToMeetingInvitation, input),
    onIcsFileOpen: (handler: (payload: { filePath: string }) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, payload: { filePath: string }): void => {
        if (payload?.filePath?.trim()) handler({ filePath: payload.filePath.trim() })
      }
      ipcRenderer.on('calendar:ics-file-open', listener)
      return (): void => {
        ipcRenderer.off('calendar:ics-file-open', listener)
      }
    }
}
