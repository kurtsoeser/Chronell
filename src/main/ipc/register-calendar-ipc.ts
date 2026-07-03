import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions } from 'electron'
import {
  IPC,
  type CalendarEventView,
  type CalendarSuggestionFromMail,
  type CalendarSaveEventInput,
  type CalendarSaveEventResult,
  type CalendarUpdateEventInput,
  type CalendarGetEventInput,
  type CalendarGetEventResult,
  type CalendarResolveMeetingRecordingInput,
  type CalendarResolveMeetingRecordingResult,
  type CalendarDeleteEventInput,
  type CalendarPatchEventIconInput,
  type CalendarPatchScheduleInput,
  type CalendarTransferEventInput,
  type CalendarPatchCalendarColorInput,
  type CalendarGraphCalendarRow,
  type CalendarAccountSyncStateRow,
  type CalendarListCalendarsInput,
  type CalendarListEventsInput,
  type CalendarListEventsForContactInput,
  type CalendarM365GroupCalendarsPage,
  type CalendarParseIcsFileResult,
  type CalendarListEventAttachmentsInput,
  type CalendarEventAttachmentActionInput,
  type CalendarEventAttachmentMeta
} from '@shared/types'
import {
  listCalendarEventAttachments,
  openCalendarEventAttachment,
  saveCalendarEventAttachmentAs
} from '../calendar-event-attachment-service'
import { sanitizeFileName } from './ipc-helpers'
import { parseIcsFileAtPath } from '../ics-import-service'
import {
  parseMeetingInvitationFromMessage,
  respondToMeetingInvitation
} from '../meeting-invitation-service'
import { listAccounts } from '../accounts'
import {
  afterCalendarEventCreated,
  afterCalendarEventDeleted,
  afterCalendarEventIconPatched,
  prepareCalendarEventSchedulePatch,
  rollbackCalendarEventSchedulePatch,
  afterCalendarEventUpdated
} from '../calendar-cache-mutations'
import { broadcastCalendarChanged } from './ipc-broadcasts'
import {
  listCalendarAccountSyncStates,
  listCalendarEventsCached,
  syncCalendarAccount
} from '../calendar-cache-service'
import { syncCalendarFoldersForAccount } from '../calendar-folders-cache-service'
import { getCalendarEventCached } from '../calendar-event-details-cache-service'
import { getCalendarEventDetailsFromCache } from '../db/calendar-event-details-repo'
import {
  listCalendarsCached,
  listM365GroupCalendarsCached
} from '../calendar-folders-cache-service'
import {
  patchMicrosoftCalendarColor,
  createTeamsMeetingForAccount,
  createSimpleCalendarEventForAccount,
  updateCalendarEventForAccount,
  deleteCalendarEventForAccount,
  patchCalendarEventScheduleForAccount,
  patchCalendarEventCategories,
  buildCalendarSuggestionFromMessage,
  findLocalFreeSlotsForAccount,
  getAttendeeScheduleForAccount,
  findMeetingTimesForAccount
} from '../calendar-service'
import { transferCalendarEvent } from '../calendar-event-transfer'
import { assertAppOnline } from '../network-status'
import {
  listStandardCalendarFoldersFromCache,
  setCalendarFolderDisplayColorOverride
} from '../db/calendar-folders-repo'
import {
  calendarMenuPresetDisplayHex,
  calendarMenuPresetOutlookSyncColor,
  isCalendarColorMenuPreset,
  isCalendarExtendedColorPreset
} from '@shared/graph-calendar-colors'
import { listCalendarEventsForContactEmails } from '../db/calendar-events-repo'

export function registerCalendarIpc(): void {
  ipcMain.removeHandler(IPC.calendar.listEvents)
  ipcMain.handle(
    IPC.calendar.listEvents,
    async (_event, args: CalendarListEventsInput): Promise<CalendarEventView[]> => {
      const include = args.includeCalendars
      return listCalendarEventsCached(args.startIso, args.endIso, {
        focus: args.focusCalendar ?? undefined,
        includeCalendars: Array.isArray(include) ? include : undefined,
        forceRefresh: args.forceRefresh === true
      })
    }
  )
  ipcMain.removeHandler(IPC.calendar.listEventsForContact)
  ipcMain.handle(
    IPC.calendar.listEventsForContact,
    async (_event, args: CalendarListEventsForContactInput): Promise<CalendarEventView[]> => {
      return listCalendarEventsForContactEmails({
        emails: args.emails ?? [],
        startIso: args.startIso,
        endIso: args.endIso,
        limit: args.limit
      })
    }
  )
  ipcMain.removeHandler(IPC.calendar.listCalendars)
  ipcMain.handle(
    IPC.calendar.listCalendars,
    async (_event, args: CalendarListCalendarsInput): Promise<CalendarGraphCalendarRow[]> => {
      if (args.forceRefresh === true) assertAppOnline()
      return listCalendarsCached(args.accountId, { forceRefresh: args.forceRefresh === true })
    }
  )
  ipcMain.removeHandler(IPC.calendar.listMicrosoft365GroupCalendars)
  ipcMain.handle(
    IPC.calendar.listMicrosoft365GroupCalendars,
    async (
      _event,
      args: { accountId: string; offset?: number; limit?: number }
    ): Promise<CalendarM365GroupCalendarsPage> => {
      assertAppOnline()
      return listM365GroupCalendarsCached(args.accountId, {
        offset: args.offset,
        limit: args.limit
      })
    }
  )
  ipcMain.removeHandler(IPC.calendar.patchCalendarColor)
  ipcMain.handle(
    IPC.calendar.patchCalendarColor,
    async (_event, args: CalendarPatchCalendarColorInput): Promise<void> => {
      if (!args?.accountId?.trim() || !args.graphCalendarId?.trim() || !args.color?.trim()) {
        throw new Error('Ungueltige Parameter fuer Kalenderfarbe.')
      }
      const accountId = args.accountId.trim()
      const graphCalendarId = args.graphCalendarId.trim()
      const colorPreset = args.color.trim()
      const accounts = await listAccounts()
      const acc = accounts.find((a) => a.id === accountId)
      const cached = listStandardCalendarFoldersFromCache(accountId).find((c) => c.id === graphCalendarId)
      const canPatchRemote =
        acc?.provider === 'microsoft' &&
        cached?.canEdit !== false &&
        cached?.calendarKind !== 'm365Group'

      if (!isCalendarColorMenuPreset(colorPreset)) {
        throw new Error('Ungueltige Kalenderfarbe.')
      }

      const displayHex = calendarMenuPresetDisplayHex(colorPreset)
      const outlookSync = calendarMenuPresetOutlookSyncColor(colorPreset)

      if (!canPatchRemote) {
        if (colorPreset !== 'auto' && !displayHex) {
          throw new Error('Ungueltige Kalenderfarbe.')
        }
        setCalendarFolderDisplayColorOverride(accountId, graphCalendarId, displayHex)
        return
      }

      assertAppOnline()
      if (!outlookSync) {
        throw new Error('Ungueltige Kalenderfarbe.')
      }

      if (isCalendarExtendedColorPreset(colorPreset)) {
        setCalendarFolderDisplayColorOverride(accountId, graphCalendarId, displayHex)
        await patchMicrosoftCalendarColor({
          accountId,
          graphCalendarId,
          color: outlookSync
        })
        return
      }

      setCalendarFolderDisplayColorOverride(accountId, graphCalendarId, null)
      await patchMicrosoftCalendarColor({
        accountId,
        graphCalendarId,
        color: outlookSync
      })
    }
  )
  ipcMain.removeHandler(IPC.calendar.createTeamsMeeting)
  ipcMain.handle(
    IPC.calendar.createTeamsMeeting,
    async (
      _event,
      args: {
        accountId: string
        subject: string
        startIso: string
        endIso: string
        bodyHtml?: string
        graphCalendarId?: string | null
        attendeeEmails?: string[] | null
      }
    ) => {
      assertAppOnline()
      const result = await createTeamsMeetingForAccount(args.accountId, {
        subject: args.subject,
        startIso: args.startIso,
        endIso: args.endIso,
        bodyHtml: args.bodyHtml,
        graphCalendarId: args.graphCalendarId ?? null,
        attendeeEmails: args.attendeeEmails
      })
      await afterCalendarEventCreated(
        args.accountId,
        {
          accountId: args.accountId,
          graphCalendarId: args.graphCalendarId ?? null,
          subject: args.subject,
          startIso: args.startIso,
          endIso: args.endIso,
          isAllDay: false,
          bodyHtml: args.bodyHtml ?? null,
          attendeeEmails: args.attendeeEmails ?? null,
          teamsMeeting: true
        },
        { id: result.id, webLink: result.webLink }
      )
      return result
    }
  )
  ipcMain.removeHandler(IPC.calendar.suggestFromMessage)
  ipcMain.handle(
    IPC.calendar.suggestFromMessage,
    (_event, messageId: number): Promise<CalendarSuggestionFromMail> =>
      buildCalendarSuggestionFromMessage(messageId)
  )

  ipcMain.removeHandler(IPC.calendar.findLocalFreeSlots)
  ipcMain.handle(
    IPC.calendar.findLocalFreeSlots,
    (_event, input: import('@shared/types').CalendarFindLocalFreeSlotsInput) =>
      findLocalFreeSlotsForAccount(input)
  )

  ipcMain.removeHandler(IPC.calendar.getAttendeeSchedule)
  ipcMain.handle(
    IPC.calendar.getAttendeeSchedule,
    (_event, input: import('@shared/types').CalendarGetAttendeeScheduleInput) =>
      getAttendeeScheduleForAccount(input)
  )

  ipcMain.removeHandler(IPC.calendar.findMeetingTimes)
  ipcMain.handle(
    IPC.calendar.findMeetingTimes,
    (_event, input: import('@shared/types').CalendarFindMeetingTimesInput) =>
      findMeetingTimesForAccount(input)
  )

  ipcMain.removeHandler(IPC.calendar.createEvent)
  ipcMain.handle(
    IPC.calendar.createEvent,
    async (_event, input: CalendarSaveEventInput): Promise<CalendarSaveEventResult> => {
      if (!input?.accountId?.trim()) {
        throw new Error('Ungueltige Parameter fuer calendar:create-event (accountId fehlt).')
      }
      if (!input?.subject?.trim()) {
        throw new Error('Ungueltige Parameter fuer calendar:create-event (subject fehlt).')
      }
      if (!input?.startIso?.trim() || !input?.endIso?.trim()) {
        throw new Error('Ungueltige Parameter fuer calendar:create-event (Zeitraum fehlt).')
      }
      const start = Number.parseFloat(String(Date.parse(input.startIso)))
      const end = Number.parseFloat(String(Date.parse(input.endIso)))
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error('Ungueltige Parameter fuer calendar:create-event (ungueltiges Datum).')
      }
      if (input.isAllDay ? end <= start : end <= start) {
        throw new Error('Ungueltige Parameter fuer calendar:create-event (Ende muss nach Start liegen).')
      }
      assertAppOnline()
      const result = await createSimpleCalendarEventForAccount(input)
      const event = await afterCalendarEventCreated(input.accountId, input, result)
      return event ? { ...result, event } : result
    }
  )

  ipcMain.removeHandler(IPC.calendar.updateEvent)
  ipcMain.handle(IPC.calendar.updateEvent, async (_event, input: CalendarUpdateEventInput): Promise<void> => {
    assertAppOnline()
    await updateCalendarEventForAccount(input)
    await afterCalendarEventUpdated(input.accountId, input)
  })

  ipcMain.removeHandler(IPC.calendar.getEvent)
  ipcMain.handle(
    IPC.calendar.getEvent,
    async (_event, input: CalendarGetEventInput): Promise<CalendarGetEventResult> => {
      assertAppOnline()
      if (!input?.accountId?.trim() || !input.graphEventId?.trim()) {
        throw new Error('Ungueltige Parameter fuer calendar:get-event.')
      }
      if (input.cacheOnly === true) {
        return (
          getCalendarEventDetailsFromCache(
            input.accountId.trim(),
            input.graphEventId.trim()
          ) ?? {
            subject: null,
            attendeeEmails: [],
            joinUrl: null,
            isOnlineMeeting: false,
            bodyHtml: null
          }
        )
      }
      return getCalendarEventCached(
        {
          accountId: input.accountId.trim(),
          graphEventId: input.graphEventId.trim(),
          graphCalendarId: input.graphCalendarId?.trim() || null
        },
        { forceRefresh: input.forceRefresh === true }
      )
    }
  )

  ipcMain.removeHandler(IPC.calendar.resolveMeetingRecording)
  ipcMain.handle(
    IPC.calendar.resolveMeetingRecording,
    async (
      _event,
      input: CalendarResolveMeetingRecordingInput
    ): Promise<CalendarResolveMeetingRecordingResult> => {
      assertAppOnline()
      const accountId = input?.accountId?.trim()
      if (!accountId) {
        return {
          recordingUrl: null,
          recapUrl: null,
          source: null,
          recapSource: null,
          hasGraphRecording: false
        }
      }

      const { extractMeetingRecapUrl, extractMeetingStreamRecordingUrl } = await import(
        '@shared/extract-meeting-recording-url'
      )
      const { resolveTeamsMeetingRecapUrl } = await import('@shared/note-teams-meeting-recap')

      const joinUrl = input.joinUrl?.trim()
      const recapResolved = resolveTeamsMeetingRecapUrl({
        bodyHtml: input.bodyHtml,
        joinUrl,
        recapFromBody: extractMeetingRecapUrl(input.bodyHtml)
      })

      let recordingUrl = extractMeetingStreamRecordingUrl(input.bodyHtml)
      let source: CalendarResolveMeetingRecordingResult['source'] = recordingUrl ? 'body' : null
      let hasGraphRecording = false

      if (joinUrl && accountId.startsWith('ms:')) {
        const { graphResolveMeetingRecording } = await import('../graph/meeting-recording-graph')
        const fromGraph = await graphResolveMeetingRecording(accountId, joinUrl)
        hasGraphRecording = fromGraph.hasRecording
        if (!recordingUrl && fromGraph.hasRecording) {
          source = 'graph'
        }
      }

      return {
        recordingUrl,
        recapUrl: recapResolved.url,
        source,
        recapSource: recapResolved.source,
        hasGraphRecording
      }
    }
  )

  ipcMain.removeHandler(IPC.calendar.listEventAttachments)
  ipcMain.handle(
    IPC.calendar.listEventAttachments,
    async (
      _event,
      input: CalendarListEventAttachmentsInput
    ): Promise<CalendarEventAttachmentMeta[]> => {
      assertAppOnline()
      if (!input?.accountId?.trim() || !input.graphEventId?.trim()) {
        throw new Error('Ungueltige Parameter fuer calendar:list-event-attachments.')
      }
      return listCalendarEventAttachments({
        accountId: input.accountId.trim(),
        graphEventId: input.graphEventId.trim(),
        graphCalendarId: input.graphCalendarId?.trim() || null
      })
    }
  )

  ipcMain.removeHandler(IPC.calendar.openEventAttachment)
  ipcMain.handle(
    IPC.calendar.openEventAttachment,
    async (
      _event,
      input: CalendarEventAttachmentActionInput
    ): Promise<{ ok: boolean; error?: string }> => {
      assertAppOnline()
      return openCalendarEventAttachment(input)
    }
  )

  ipcMain.removeHandler(IPC.calendar.saveEventAttachmentAs)
  ipcMain.handle(
    IPC.calendar.saveEventAttachmentAs,
    async (
      event,
      input: CalendarEventAttachmentActionInput & { suggestedName?: string }
    ): Promise<{ ok: boolean; path?: string; error?: string; cancelled?: boolean }> => {
      assertAppOnline()
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const suggested = sanitizeFileName(input.suggestedName ?? 'attachment')
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: suggested,
        title: 'Anhang speichern unter'
      })
      if (result.canceled || !result.filePath) {
        return { ok: false, cancelled: true }
      }
      const saved = await saveCalendarEventAttachmentAs({
        ...input,
        filePath: result.filePath
      })
      return saved.ok
        ? { ok: true, path: result.filePath }
        : { ok: false, error: saved.error }
    }
  )

  ipcMain.removeHandler(IPC.calendar.deleteEvent)
  ipcMain.handle(IPC.calendar.deleteEvent, async (_event, input: CalendarDeleteEventInput): Promise<void> => {
    assertAppOnline()
    await deleteCalendarEventForAccount(input)
    afterCalendarEventDeleted(input.accountId, input.graphEventId)
  })

  ipcMain.removeHandler(IPC.calendar.patchEventSchedule)
  ipcMain.handle(
    IPC.calendar.patchEventSchedule,
    async (_event, input: CalendarPatchScheduleInput): Promise<void> => {
      assertAppOnline()
      const previous = prepareCalendarEventSchedulePatch(input)
      try {
        await patchCalendarEventScheduleForAccount(input)
        broadcastCalendarChanged(input.accountId)
      } catch (e) {
        rollbackCalendarEventSchedulePatch(
          input.accountId,
          input.graphEventId,
          previous
        )
        throw e
      }
    }
  )

  ipcMain.removeHandler(IPC.calendar.transferEvent)
  ipcMain.handle(
    IPC.calendar.transferEvent,
    async (_event, input: CalendarTransferEventInput): Promise<CalendarSaveEventResult> => {
      assertAppOnline()
      return transferCalendarEvent(input)
    }
  )

  ipcMain.removeHandler(IPC.calendar.patchEventIcon)
  ipcMain.handle(
    IPC.calendar.patchEventIcon,
    async (_event, input: CalendarPatchEventIconInput): Promise<void> => {
      const graphEventId = input.graphEventId?.trim()
      if (!graphEventId) throw new Error('graphEventId fehlt.')
      afterCalendarEventIconPatched(input)
    }
  )

  ipcMain.removeHandler(IPC.calendar.patchEventCategories)
  ipcMain.handle(
    IPC.calendar.patchEventCategories,
    async (
      _event,
      args: { accountId: string; graphEventId: string; categories: string[]; graphCalendarId?: string | null }
    ): Promise<void> => {
      assertAppOnline()
      await patchCalendarEventCategories(
        args.accountId,
        args.graphEventId,
        args.categories,
        args.graphCalendarId ?? null
      )
    }
  )

  ipcMain.removeHandler(IPC.calendar.syncAccount)
  ipcMain.handle(IPC.calendar.syncAccount, async (_event, accountId: unknown): Promise<void> => {
    assertAppOnline()
    const id = typeof accountId === 'string' ? accountId.trim() : ''
    if (!id) throw new Error('accountId fehlt.')
    await syncCalendarFoldersForAccount(id).catch((e) => {
      console.warn('[calendar] Ordner-Sync:', id, e)
    })
    await syncCalendarAccount(id)
  })

  ipcMain.removeHandler(IPC.calendar.getAccountSyncStates)
  ipcMain.handle(
    IPC.calendar.getAccountSyncStates,
    async (): Promise<CalendarAccountSyncStateRow[]> => listCalendarAccountSyncStates()
  )

  ipcMain.removeHandler(IPC.calendar.parseIcsFile)
  ipcMain.handle(
    IPC.calendar.parseIcsFile,
    async (_event, filePath: unknown): Promise<CalendarParseIcsFileResult> => {
      const p = typeof filePath === 'string' ? filePath.trim() : ''
      if (!p) throw new Error('Dateipfad fehlt.')
      return parseIcsFileAtPath(p)
    }
  )

  ipcMain.removeHandler(IPC.calendar.pickIcsFile)
  ipcMain.handle(
    IPC.calendar.pickIcsFile,
    async (event): Promise<CalendarParseIcsFileResult | { cancelled: true }> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const options: OpenDialogOptions = {
        title: 'iCalendar-Datei importieren',
        filters: [{ name: 'iCalendar', extensions: ['ics'] }],
        properties: ['openFile']
      }
      const { canceled, filePaths } = await (win
        ? dialog.showOpenDialog(win, options)
        : dialog.showOpenDialog(options))
      if (canceled || !filePaths?.[0]) {
        return { cancelled: true }
      }
      return parseIcsFileAtPath(filePaths[0])
    }
  )

  ipcMain.removeHandler(IPC.calendar.parseMeetingFromMessage)
  ipcMain.handle(IPC.calendar.parseMeetingFromMessage, async (_event, messageId: number) =>
    parseMeetingInvitationFromMessage(messageId)
  )

  ipcMain.removeHandler(IPC.calendar.respondToMeetingInvitation)
  ipcMain.handle(IPC.calendar.respondToMeetingInvitation, async (_event, input) =>
    respondToMeetingInvitation(input)
  )
}
