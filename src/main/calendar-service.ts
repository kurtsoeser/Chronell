import { listAccounts } from './accounts'
import { runGraphMailboxRequest } from './graph/graph-account-request'
import { formatGraphErrorMessage } from './graph/graph-request-errors'
import { mapWithConcurrency } from './map-with-concurrency'
import {
  graphListCalendarView,
  graphListCalendarViewInCalendar,
  graphListCalendars,
  graphListM365GroupCalendarPage,
  graphPatchCalendarColor,
  graphCreateTeamsCalendarEvent,
  graphCreateSimpleCalendarEvent,
  graphUpdateCalendarEvent,
  graphPatchCalendarEventTimes,
  graphDeleteCalendarEvent,
  graphPatchEventCategories,
  graphPatchEventStatus,
  graphGetCalendarEvent,
  type GraphCalendarEventRow,
  type CreateTeamsCalendarEventInput,
  type CreateTeamsCalendarEventResult
} from './graph/calendar-graph'
import {
  graphCreateOnlineMeetingWithTemplate,
  type CreateOnlineMeetingWithTemplateResult
} from './graph/online-meeting-create'
import { addCalendarEventAttachments } from './calendar-event-attachment-service'
import { patchCachedCalendarEventMeetingFields } from './calendar-cache-mutations'
import {
  googleListCalendars,
  googleListEventsInCalendar,
  googleCreateEvent,
  googleUpdateEvent,
  googlePatchEventTimes,
  googlePatchEventStatus,
  googleDeleteEvent,
  googleGetCalendarEventDetail
} from './google/calendar-google'
import { addDays, min as minDate, startOfDay } from 'date-fns'
import { getMessageById } from './db/messages-repo'
import { ensureMessageBodyLoaded } from './message-body-fetch'
import { buildMailEmlAttachment } from './mail-eml-export'
import { buildMailCalendarEventDescriptionHtml } from '@shared/mail-calendar-event-description'
import { meetingAttendeesFromMailParticipants } from '@shared/mail-meeting-attendees'
import { findLocalFreeSlots } from '@shared/calendar-free-slots'
import type {
  CalendarEventView,
  CalendarSuggestionFromMail,
  CalendarSaveEventInput,
  CalendarSaveEventResult,
  CalendarUpdateEventInput,
  CalendarDeleteEventInput,
  CalendarGraphCalendarRow,
  CalendarM365GroupCalendarsPage,
  CalendarPatchCalendarColorInput,
  CalendarPatchScheduleInput,
  CalendarIncludeCalendarRef,
  ConnectedAccount,
  CalendarGetEventInput,
  CalendarGetEventResult,
  CalendarRespondToEventInput,
  CalendarRespondToEventResult,
  CalendarFindLocalFreeSlotsInput,
  CalendarFreeSlot,
  CalendarGetAttendeeScheduleInput,
  CalendarAttendeeScheduleView,
  CalendarFindMeetingTimesInput
} from '@shared/types'
import { listCalendarEventsInRange } from './db/calendar-events-repo'
import { parseMeetingInvitationFromMessage } from './meeting-invitation-service'
import {
  graphGetAttendeeSchedule,
  graphFindMeetingTimes
} from './graph/calendar-graph'
import { respondToGraphCalendarEvent } from './graph/calendar-meeting-response'

export type CalendarListEventsFocus =
  | null
  | undefined
  | { accountId: string; graphCalendarId: string }

export interface ListMergedCalendarEventsOptions {
  focus?: CalendarListEventsFocus
  includeCalendars?: CalendarIncludeCalendarRef[] | null
  /** Google: `syncToken`-Delta statt Zeitfenster (Hintergrund-Sync). Standard: false. */
  googleIncremental?: boolean
}

const DEFAULT_CALENDAR_LOAD_AHEAD_DAYS = 365
/** Graph MailboxConcurrency: max. ~4 gleichzeitige Anfragen pro Postfach — konservativ 2. */
const MICROSOFT_CALENDAR_VIEW_CONCURRENCY = 2

/** Ende des fuer ein Konto angefragten Zeitraums (Ansicht vs. Vorausschau ab heute). */
function effectiveFetchEndForAccount(acc: ConnectedAccount, viewEnd: Date): Date {
  if (acc.calendarLoadAheadDays === null) {
    return viewEnd
  }
  const days = acc.calendarLoadAheadDays ?? DEFAULT_CALENDAR_LOAD_AHEAD_DAYS
  const cap = addDays(startOfDay(new Date()), days)
  return minDate([viewEnd, cap])
}

async function fetchMicrosoftCalendarViews(
  acc: ConnectedAccount,
  calendarIds: string[],
  start: Date,
  end: Date
): Promise<GraphCalendarEventRow[]> {
  if (calendarIds.length === 0) return []
  const batches = await mapWithConcurrency(
    calendarIds,
    MICROSOFT_CALENDAR_VIEW_CONCURRENCY,
    async (calId) => {
      try {
        return await runGraphMailboxRequest(acc.id, `calendarView ${calId}`, () =>
          graphListCalendarViewInCalendar(acc.id, calId, start, end)
        )
      } catch (e) {
        console.warn('[calendar-service] Kalender konnte nicht geladen werden:', acc.id, calId, e)
        return [] as GraphCalendarEventRow[]
      }
    }
  )
  const seenIds = new Set<string>()
  const rows: GraphCalendarEventRow[] = []
  for (const batch of batches) {
    for (const r of batch) {
      if (seenIds.has(r.id)) continue
      seenIds.add(r.id)
      rows.push(r)
    }
  }
  return rows
}

async function fetchGoogleCalendarViews(
  acc: ConnectedAccount,
  calendarIds: string[],
  start: Date,
  end: Date,
  useIncremental: boolean
): Promise<GraphCalendarEventRow[]> {
  if (calendarIds.length === 0) return []
  const batches = await Promise.all(
    calendarIds.map(async (calId) => {
      try {
        return await googleListEventsInCalendar(acc.id, calId, start, end, useIncremental)
      } catch (e) {
        console.warn('[calendar-service] Google Kalender konnte nicht geladen werden:', acc.id, calId, e)
        return [] as GraphCalendarEventRow[]
      }
    })
  )
  const seen = new Set<string>()
  const rows: GraphCalendarEventRow[] = []
  for (const batch of batches) {
    for (const r of batch) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      rows.push(r)
    }
  }
  return rows
}

function rowToView(acc: ConnectedAccount, r: GraphCalendarEventRow, source: 'microsoft' | 'google'): CalendarEventView {
  return {
    id: `${acc.id}:${r.id}`,
    source,
    accountId: acc.id,
    accountEmail: acc.email,
    accountColorClass: acc.color,
    graphEventId: r.id,
    title: r.subject?.trim() || '(Ohne Titel)',
    startIso: r.startIso,
    endIso: r.endIso,
    isAllDay: r.isAllDay,
    location: r.location,
    webLink: r.webLink,
    joinUrl: r.joinUrl,
    organizer: r.organizer,
    categories: r.categories.length > 0 ? r.categories : undefined,
    displayColorHex: r.displayColorHex,
    graphCalendarId: r.graphCalendarId,
    calendarCanEdit: r.calendarCanEdit !== false,
    showAs: r.showAs ?? null,
    sensitivity: r.sensitivity ?? null,
    isSeries: r.isSeries === true
  }
}

export async function listMergedCalendarEvents(
  startIso: string,
  endIso: string,
  options?: ListMergedCalendarEventsOptions
): Promise<CalendarEventView[]> {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const accounts = await listAccounts()
  const out: CalendarEventView[] = []
  const focus = options?.focus
  const includeCalendars = options?.includeCalendars
  const googleIncremental = options?.googleIncremental === true

  if (focus?.accountId && focus.graphCalendarId) {
    const acc = accounts.find((a) => a.id === focus.accountId)
    if (!acc) {
      return []
    }
    const effEnd = effectiveFetchEndForAccount(acc, end)
    if (effEnd.getTime() <= start.getTime()) {
      return []
    }
    if (acc.provider === 'microsoft') {
      let rows: GraphCalendarEventRow[] = []
      try {
        rows = await graphListCalendarViewInCalendar(acc.id, focus.graphCalendarId, start, effEnd)
      } catch (e) {
        console.warn('[calendar-service] Graph Kalender-Ansicht fehlgeschlagen:', acc.id, focus.graphCalendarId, e)
      }
      for (const r of rows) {
        out.push(rowToView(acc, r, 'microsoft'))
      }
    } else if (acc.provider === 'google') {
      let rows: GraphCalendarEventRow[] = []
      try {
        rows = await googleListEventsInCalendar(
          acc.id,
          focus.graphCalendarId,
          start,
          effEnd,
          googleIncremental
        )
      } catch (e) {
        console.warn('[calendar-service] Google Kalender fehlgeschlagen:', acc.id, focus.graphCalendarId, e)
      }
      for (const r of rows) {
        out.push(rowToView(acc, r, 'google'))
      }
    }
    out.sort((a, b) => a.startIso.localeCompare(b.startIso))
    return out
  }

  if (Array.isArray(includeCalendars)) {
    if (includeCalendars.length === 0) {
      return []
    }
    const byAccount = new Map<string, Set<string>>()
    for (const ref of includeCalendars) {
      const cid = ref.graphCalendarId?.trim()
      if (!cid) continue
      const set = byAccount.get(ref.accountId) ?? new Set<string>()
      set.add(cid)
      byAccount.set(ref.accountId, set)
    }
    for (const [accountId, idSet] of byAccount) {
      const acc = accounts.find((a) => a.id === accountId)
      if (!acc || (acc.provider !== 'microsoft' && acc.provider !== 'google')) continue
      const effEnd = effectiveFetchEndForAccount(acc, end)
      if (effEnd.getTime() <= start.getTime()) continue
      const ids = [...idSet]
      if (acc.provider === 'microsoft') {
        const rows = await fetchMicrosoftCalendarViews(acc, ids, start, effEnd)
        for (const r of rows) {
          out.push(rowToView(acc, r, 'microsoft'))
        }
      } else {
        const rows = await fetchGoogleCalendarViews(acc, ids, start, effEnd, googleIncremental)
        for (const r of rows) {
          out.push(rowToView(acc, r, 'google'))
        }
      }
    }
    out.sort((a, b) => a.startIso.localeCompare(b.startIso))
    return out
  }

  for (const acc of accounts) {
    const effEnd = effectiveFetchEndForAccount(acc, end)
    if (effEnd.getTime() <= start.getTime()) {
      continue
    }
    if (acc.provider === 'microsoft') {
      let rows: GraphCalendarEventRow[] = []
      try {
        const calendars = await graphListCalendars(acc.id)
        if (calendars.length === 0) {
          rows = await graphListCalendarView(acc.id, start, effEnd)
        } else {
          rows = await fetchMicrosoftCalendarViews(
            acc,
            calendars.map((c) => c.id),
            start,
            effEnd
          )
        }
      } catch (e) {
        console.warn('[calendar-service] Graph-Kalender fehlgeschlagen:', acc.id, e)
      }
      for (const r of rows) {
        out.push(rowToView(acc, r, 'microsoft'))
      }
    } else if (acc.provider === 'google') {
      let rows: GraphCalendarEventRow[] = []
      try {
        const calendars = await googleListCalendars(acc.id)
        rows = await fetchGoogleCalendarViews(
          acc,
          calendars.map((c) => c.id),
          start,
          effEnd,
          googleIncremental
        )
      } catch (e) {
        console.warn('[calendar-service] Google-Kalender fehlgeschlagen:', acc.id, e)
      }
      for (const r of rows) {
        out.push(rowToView(acc, r, 'google'))
      }
    }
  }

  out.sort((a, b) => a.startIso.localeCompare(b.startIso))
  return out
}

export async function listMicrosoftCalendars(
  accountId: string,
  opts?: { forceRefresh?: boolean }
): Promise<CalendarGraphCalendarRow[]> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc) return []
  if (acc.provider === 'google') {
    return googleListCalendars(accountId, opts)
  }
  return graphListCalendars(accountId)
}

const M365_GROUP_CALENDAR_PAGE_DEFAULT = 10
const M365_GROUP_CALENDAR_PAGE_MAX = 25

/** Microsoft-365-Gruppenkalender (Unified Groups), paginiert. */
export async function listMicrosoft365GroupCalendars(
  accountId: string,
  opts?: { offset?: number; limit?: number }
): Promise<CalendarM365GroupCalendarsPage> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc || acc.provider !== 'microsoft') {
    return {
      calendars: [],
      totalGroups: 0,
      offset: 0,
      limit: M365_GROUP_CALENDAR_PAGE_DEFAULT,
      hasMore: false
    }
  }
  const offset = Math.max(0, opts?.offset ?? 0)
  const limit = Math.min(
    M365_GROUP_CALENDAR_PAGE_MAX,
    Math.max(1, opts?.limit ?? M365_GROUP_CALENDAR_PAGE_DEFAULT)
  )
  return graphListM365GroupCalendarPage(accountId, offset, limit)
}

export async function patchMicrosoftCalendarColor(input: CalendarPatchCalendarColorInput): Promise<void> {
  await graphPatchCalendarColor(input.accountId, input.graphCalendarId, input.color)
}

export async function createTeamsMeetingForAccount(
  accountId: string,
  input: CreateTeamsCalendarEventInput
): Promise<CreateTeamsCalendarEventResult> {
  return graphCreateTeamsCalendarEvent(accountId, input)
}

export async function createOnlineMeetingWithTemplateForAccount(
  accountId: string,
  input: {
    subject: string
    startIso: string
    endIso: string
    meetingTemplateId: string
  }
): Promise<CreateOnlineMeetingWithTemplateResult> {
  return graphCreateOnlineMeetingWithTemplate(accountId, input)
}

export async function getCalendarEventForAccount(input: CalendarGetEventInput): Promise<CalendarGetEventResult> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (!acc) {
    throw new Error('Konto nicht gefunden.')
  }
  const graphEventId = input.graphEventId.trim()
  const graphCalendarId = input.graphCalendarId?.trim() || null
  let detail: CalendarGetEventResult
  if (acc.provider === 'google') {
    if (!graphCalendarId) {
      throw new Error('Google: Kalender-ID fehlt (graphCalendarId).')
    }
    detail = await googleGetCalendarEventDetail(input.accountId, graphCalendarId, graphEventId)
  } else if (acc.provider !== 'microsoft') {
    throw new Error('Kalender-Termin-Details werden fuer dieses Konto nicht unterstuetzt.')
  } else {
    detail = await runGraphMailboxRequest(input.accountId, 'getCalendarEvent', () =>
      graphGetCalendarEvent(input.accountId, graphEventId, graphCalendarId, acc.email)
    )
  }
  return detail
}

export async function createSimpleCalendarEventForAccount(
  input: CalendarSaveEventInput
): Promise<CalendarSaveEventResult> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (acc?.provider === 'google') {
    const r = await googleCreateEvent(input.accountId, input.graphCalendarId ?? null, {
      subject: input.subject,
      startIso: input.startIso,
      endIso: input.endIso,
      isAllDay: input.isAllDay,
      location: input.location,
      bodyHtml: input.bodyHtml,
      recurrence: input.recurrence ?? null,
      attendeeEmails: input.attendeeEmails,
      optionalAttendeeEmails: input.optionalAttendeeEmails,
      notifyAttendees: input.notifyAttendees ?? null,
      timeZone: input.timeZone ?? null,
      showAs: input.showAs ?? null,
      sensitivity: input.sensitivity ?? null
    })
    if (input.attachments?.length || input.referenceAttachments?.length) {
      await addCalendarEventAttachments(input.accountId, r.id, input.graphCalendarId ?? null, {
        files: input.attachments,
        references: input.referenceAttachments
      })
    }
    return { id: r.id, webLink: r.webLink }
  }
  const r = await graphCreateSimpleCalendarEvent(input.accountId, {
    subject: input.subject,
    startIso: input.startIso,
    endIso: input.endIso,
    isAllDay: input.isAllDay,
    location: input.location,
    bodyHtml: input.bodyHtml,
    graphCalendarId: input.graphCalendarId ?? null,
    categories: input.categories,
    attendeeEmails: input.attendeeEmails,
    teamsMeeting: input.teamsMeeting,
    recurrence: input.recurrence ?? null,
    reminderMinutesBeforeStart: input.reminderMinutesBeforeStart ?? null,
    timeZone: input.timeZone ?? null,
    showAs: input.showAs ?? null,
    sensitivity: input.sensitivity ?? null,
    hideAttendees: input.hideAttendees ?? null,
    responseRequested: input.responseRequested ?? null,
    allowForwarding: input.allowForwarding ?? null,
    chronellWebinarInvitation: input.chronellWebinarInvitation ?? null,
    optionalAttendeeEmails: input.optionalAttendeeEmails ?? null,
    notifyAttendees: input.notifyAttendees ?? null
  })
  if (input.attachments?.length || input.referenceAttachments?.length) {
    await addCalendarEventAttachments(input.accountId, r.id, input.graphCalendarId ?? null, {
      files: input.attachments,
      references: input.referenceAttachments
    })
  }
  return { id: r.id, webLink: r.webLink, joinUrl: r.joinUrl ?? null }
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function refreshMicrosoftCalendarEventMeetingFields(
  accountId: string,
  graphEventId: string,
  graphCalendarId?: string | null
): Promise<{ joinUrl: string | null; isOnlineMeeting: boolean }> {
  let detail = await graphGetCalendarEvent(accountId, graphEventId, graphCalendarId ?? null)
  // Join-URL kommt bei frisch aktivierter Teams-Besprechung oft erst nach kurzer Verzoegerung.
  if (detail.isOnlineMeeting && !detail.joinUrl?.trim()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleepMs(attempt === 0 ? 400 : 800)
      detail = await graphGetCalendarEvent(accountId, graphEventId, graphCalendarId ?? null)
      if (detail.joinUrl?.trim()) break
    }
  }
  patchCachedCalendarEventMeetingFields(accountId, graphEventId, graphCalendarId ?? null, {
    joinUrl: detail.joinUrl,
    isOnlineMeeting: detail.isOnlineMeeting
  })
  return { joinUrl: detail.joinUrl, isOnlineMeeting: detail.isOnlineMeeting }
}

export async function updateCalendarEventForAccount(input: CalendarUpdateEventInput): Promise<void> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (acc?.provider === 'google') {
    const calId = input.graphCalendarId?.trim()
    if (!calId) {
      throw new Error('Google: Kalender-ID fehlt (graphCalendarId).')
    }
    await googleUpdateEvent(input.accountId, calId, input.graphEventId, {
      subject: input.subject,
      startIso: input.startIso,
      endIso: input.endIso,
      isAllDay: input.isAllDay,
      location: input.location,
      bodyHtml: input.bodyHtml,
      attendeeEmails: input.attendeeEmails,
      optionalAttendeeEmails: input.optionalAttendeeEmails,
      notifyAttendees: input.notifyAttendees ?? null,
      recurrence: input.recurrence ?? null,
      timeZone: input.timeZone ?? null,
      showAs: input.showAs ?? null,
      sensitivity: input.sensitivity ?? null
    })
    if (input.attachments?.length || input.referenceAttachments?.length) {
      await addCalendarEventAttachments(input.accountId, input.graphEventId, calId, {
        files: input.attachments,
        references: input.referenceAttachments
      })
    }
    return
  }
  const { accountId, graphEventId, ...rest } = input
  const inlineAttachments = rest.attachments?.filter((a) => a.isInline) ?? []
  const regularAttachments = rest.attachments?.filter((a) => !a.isInline) ?? []
  const referenceAttachments = rest.referenceAttachments

  // Inline-Bilder (cid:) vor Body-PATCH — sonst fehlen Hero-Bilder in der Einladung.
  if (inlineAttachments.length > 0) {
    await addCalendarEventAttachments(accountId, graphEventId, rest.graphCalendarId ?? null, {
      files: inlineAttachments
    })
  }

  await graphUpdateCalendarEvent(accountId, graphEventId, {
    subject: rest.subject,
    startIso: rest.startIso,
    endIso: rest.endIso,
    isAllDay: rest.isAllDay,
    location: rest.location,
    bodyHtml: rest.bodyHtml,
    graphCalendarId: rest.graphCalendarId ?? null,
    categories: rest.categories,
    attendeeEmails: rest.attendeeEmails,
    teamsMeeting: rest.teamsMeeting,
    recurrence: rest.recurrence ?? null,
    reminderMinutesBeforeStart: rest.reminderMinutesBeforeStart ?? null,
    timeZone: rest.timeZone ?? null,
    showAs: rest.showAs ?? null,
    sensitivity: rest.sensitivity ?? null,
    hideAttendees: rest.hideAttendees ?? null,
    responseRequested: rest.responseRequested ?? null,
    allowForwarding: rest.allowForwarding ?? null,
    chronellWebinarInvitation: rest.chronellWebinarInvitation ?? null,
    optionalAttendeeEmails: rest.optionalAttendeeEmails ?? null,
    notifyAttendees: rest.notifyAttendees ?? null
  })
  if (regularAttachments.length > 0 || referenceAttachments?.length) {
    await addCalendarEventAttachments(accountId, graphEventId, rest.graphCalendarId ?? null, {
      files: regularAttachments,
      references: referenceAttachments
    })
  }
  if (acc?.provider === 'microsoft' && typeof input.teamsMeeting === 'boolean' && !input.isAllDay) {
    await refreshMicrosoftCalendarEventMeetingFields(
      accountId,
      graphEventId,
      input.graphCalendarId ?? null
    )
  }
}

export async function patchCalendarEventScheduleForAccount(input: CalendarPatchScheduleInput): Promise<void> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (acc?.provider === 'google') {
    const calId = input.graphCalendarId?.trim()
    if (!calId) {
      throw new Error('Google: Kalender-ID fehlt (graphCalendarId).')
    }
    await googlePatchEventTimes(input.accountId, calId, input.graphEventId, {
      startIso: input.startIso,
      endIso: input.endIso,
      isAllDay: input.isAllDay,
      notifyAttendees: input.notifyAttendees
    })
    return
  }
  await graphPatchCalendarEventTimes(input.accountId, input.graphEventId, {
    startIso: input.startIso,
    endIso: input.endIso,
    isAllDay: input.isAllDay
  }, input.graphCalendarId ?? null)
}

export async function deleteCalendarEventForAccount(input: CalendarDeleteEventInput): Promise<void> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (acc?.provider === 'google') {
    const calId = input.graphCalendarId?.trim()
    if (!calId) {
      throw new Error('Google: Kalender-ID fehlt (graphCalendarId).')
    }
    await googleDeleteEvent(input.accountId, calId, input.graphEventId)
    return
  }
  await graphDeleteCalendarEvent(input.accountId, input.graphEventId, input.graphCalendarId ?? null)
}

export async function respondToCalendarEventForAccount(
  input: CalendarRespondToEventInput
): Promise<CalendarRespondToEventResult> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (!acc || acc.provider !== 'microsoft') {
    return { ok: false, error: 'Teilnahmeantwort ist nur fuer Microsoft-Konten verfuegbar.' }
  }
  const graphEventId = input.graphEventId?.trim()
  if (!graphEventId) {
    return { ok: false, error: 'graphEventId fehlt.' }
  }
  try {
    const result = await respondToGraphCalendarEvent(input.accountId, graphEventId, input.response, {
      graphCalendarId: input.graphCalendarId ?? null,
      scope: input.scope === 'series' ? 'series' : 'this',
      comment: input.comment ?? null,
      sendResponse: input.sendResponse !== false
    })
    return {
      ok: true,
      selfPartStat: result.selfPartStat,
      respondedEventId: result.respondedEventId,
      scope: result.scope,
      ...(result.removedWithoutResponse ? { removedWithoutResponse: true } : {})
    }
  } catch (e) {
    return { ok: false, error: formatGraphErrorMessage(e) }
  }
}

export async function patchCalendarEventCategories(
  accountId: string,
  graphEventId: string,
  categories: string[],
  graphCalendarId?: string | null
): Promise<void> {
  await graphPatchEventCategories(accountId, graphEventId, categories, graphCalendarId)
}

export async function patchCalendarEventStatusForAccount(
  input: import('@shared/types').CalendarPatchEventStatusInput
): Promise<void> {
  const graphEventId = input.graphEventId?.trim()
  if (!graphEventId) throw new Error('graphEventId fehlt.')
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (!acc) throw new Error('Konto nicht gefunden.')

  if (acc.provider === 'google') {
    const calId = input.graphCalendarId?.trim()
    if (!calId) throw new Error('Google: Kalender-ID fehlt (graphCalendarId).')
    await googlePatchEventStatus(input.accountId, calId, graphEventId, {
      showAs: input.showAs ?? null,
      sensitivity: input.sensitivity ?? null
    })
    return
  }
  if (acc.provider !== 'microsoft') {
    throw new Error('Status aendern ist nur fuer Microsoft- und Google-Konten verfuegbar.')
  }
  await graphPatchEventStatus(input.accountId, graphEventId, {
    showAs: input.showAs ?? null,
    sensitivity: input.sensitivity ?? null,
    graphCalendarId: input.graphCalendarId ?? null
  })
}

export async function buildCalendarSuggestionFromMessage(
  messageId: number
): Promise<CalendarSuggestionFromMail> {
  const msg = (await ensureMessageBodyLoaded(messageId)) ?? getMessageById(messageId)
  if (!msg) throw new Error('Mail nicht gefunden.')

  let start: Date
  let end: Date

  try {
    const parsed = await parseMeetingInvitationFromMessage(messageId)
    const inv = parsed.invitation
    if (inv?.startIso && inv.endIso && !inv.isAllDay) {
      const invStart = new Date(inv.startIso)
      const invEnd = new Date(inv.endIso)
      if (!Number.isNaN(invStart.getTime()) && !Number.isNaN(invEnd.getTime()) && invEnd > invStart) {
        start = invStart
        end = invEnd
      } else {
        throw new Error('invalid invitation times')
      }
    } else {
      throw new Error('no invitation times')
    }
  } catch {
    const now = new Date()
    start = new Date(now.getTime() + 60 * 60 * 1000)
    start.setMinutes(0, 0, 0)
    end = new Date(start.getTime() + 60 * 60 * 1000)
  }

  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === msg.accountId)
  const excludeEmails = acc?.email?.trim() ? [acc.email.trim()] : []

  const attendees = meetingAttendeesFromMailParticipants(
    {
      fromAddr: msg.fromAddr,
      fromName: msg.fromName,
      toAddrs: msg.toAddrs,
      ccAddrs: msg.ccAddrs,
      bccAddrs: msg.bccAddrs
    },
    excludeEmails
  )

  const subjectRaw = msg.subject?.trim() ?? ''
  const meetingSubject =
    subjectRaw.length > 0 && !/^re:\s/i.test(subjectRaw) ? subjectRaw : subjectRaw || 'Besprechung'

  const bodyHtml = buildMailCalendarEventDescriptionHtml(msg)
  const mailAttachment = await buildMailEmlAttachment(messageId)

  return {
    accountId: msg.accountId,
    messageId: msg.id,
    subject: meetingSubject,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    bodyHtml,
    attendeeEmails: attendees.map((a) => a.address),
    mailAttachment
  }
}

export async function findLocalFreeSlotsForAccount(
  input: CalendarFindLocalFreeSlotsInput
): Promise<CalendarFreeSlot[]> {
  const events = listCalendarEventsInRange(input.rangeStartIso, input.rangeEndIso).filter(
    (ev) => ev.accountId === input.accountId
  )
  return findLocalFreeSlots(events, {
    durationMinutes: input.durationMinutes,
    rangeStartIso: input.rangeStartIso,
    rangeEndIso: input.rangeEndIso,
    workingHoursStart: input.workingHoursStart,
    workingHoursEnd: input.workingHoursEnd,
    maxResults: input.maxResults,
    notBeforeIso: input.notBeforeIso
  })
}

export async function getAttendeeScheduleForAccount(
  input: CalendarGetAttendeeScheduleInput
): Promise<CalendarAttendeeScheduleView[]> {
  const account = (await listAccounts()).find((a) => a.id === input.accountId)
  if (!account || account.provider !== 'microsoft') {
    throw new Error('Teilnehmer-Verfügbarkeit ist nur für Microsoft-365-Konten verfügbar.')
  }
  return graphGetAttendeeSchedule(input.accountId, input)
}

export async function findMeetingTimesForAccount(
  input: CalendarFindMeetingTimesInput
): Promise<CalendarFreeSlot[]> {
  const account = (await listAccounts()).find((a) => a.id === input.accountId)
  if (!account || account.provider !== 'microsoft') {
    throw new Error('Terminvorschläge für alle Teilnehmer sind nur für Microsoft-365-Konten verfügbar.')
  }
  return graphFindMeetingTimes(input.accountId, input)
}

