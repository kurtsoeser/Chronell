import type { MeetingAttendeePartStat, MeetingInvitationView } from '@shared/types'
import { utcIsoFromWallDateTime } from '@shared/calendar-datetime'
import { graphWindowsZoneToIana } from '@shared/microsoft-timezones'
import { extractMeetingJoinUrl } from '@shared/extract-meeting-join-url'
import { createGraphClient } from './client'
import { runGraphMailboxRequest } from './graph-account-request'
import { loadConfig } from '../config'
import { enrichGraphMeetingInvitation } from './calendar-meeting-response'
import { mergeMeetingAttendees } from '@shared/merge-meeting-attendees'

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

interface GraphDateTimeTimeZone {
  dateTime?: string | null
  timeZone?: string | null
}

interface GraphAttendeeStatus {
  response?: string | null
}

interface GraphAttendeeRow {
  type?: string | null
  emailAddress?: { name?: string | null; address?: string | null } | null
  status?: GraphAttendeeStatus | null
}

interface GraphEventRow {
  subject?: string | null
  start?: GraphDateTimeTimeZone | null
  end?: GraphDateTimeTimeZone | null
  isAllDay?: boolean | null
  location?: { displayName?: string | null } | null
  organizer?: { emailAddress?: { name?: string | null; address?: string | null } } | null
  attendees?: GraphAttendeeRow[] | null
  onlineMeeting?: { joinUrl?: string | null } | null
  iCalUId?: string | null
  '@odata.type'?: string | null
}

interface GraphMeetingMessageRow {
  meetingMessageType?: string | null
  allowNewTimeProposals?: boolean | null
  event?: GraphEventRow | null
  '@odata.type'?: string | null
}

function isGraphEventMessage(odataType: string | null | undefined): boolean {
  return (odataType ?? '').toLowerCase().includes('eventmessage')
}

async function readMeetingMessage(
  client: ReturnType<typeof createGraphClient>,
  accountId: string,
  remoteMessageId: string
): Promise<GraphMeetingMessageRow | null> {
  try {
    return (await runGraphMailboxRequest(accountId, 'getMeetingMessageFull', () =>
      client.api(`/me/messages/${remoteMessageId}`).get()
    )) as GraphMeetingMessageRow
  } catch {
    return null
  }
}

async function readEventFromEventMessage(
  client: ReturnType<typeof createGraphClient>,
  accountId: string,
  remoteMessageId: string
): Promise<GraphEventRow | null> {
  try {
    const row = (await runGraphMailboxRequest(accountId, 'getMeetingMessageEventExpanded', () =>
      client
        .api(`/me/messages/${remoteMessageId}`)
        .expand('microsoft.graph.eventMessage/event')
        .get()
    )) as GraphMeetingMessageRow
    return row.event ?? null
  } catch {
    return null
  }
}

function graphDateTimeToIso(
  dateTime: string | null | undefined,
  graphTimeZone: string | null | undefined,
  isAllDay: boolean
): string | null {
  if (!dateTime?.trim()) return null
  const trimmed = dateTime.trim().replace(/\.\d+$/, '')
  const iso = utcIsoFromWallDateTime(trimmed, graphTimeZone, isAllDay, graphWindowsZoneToIana)
  if (iso) return iso
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function mapGraphPartStat(raw: string | null | undefined): MeetingAttendeePartStat {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'accepted':
      return 'accepted'
    case 'declined':
      return 'declined'
    case 'tentativelyaccepted':
    case 'tentative':
      return 'tentative'
    case 'notresponded':
    case 'none':
      return 'needs-action'
    default:
      return 'unknown'
  }
}

function meetingMethodFromGraphType(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'meetingrequest') return 'REQUEST'
  if (v === 'meetingcancelled') return 'CANCEL'
  if (v === 'meetingaccepted') return 'REPLY'
  if (v === 'meetingtentativelyaccepted') return 'REPLY'
  if (v === 'meetingdeclined') return 'REPLY'
  return null
}

function buildInvitationFromGraphEvent(
  message: GraphMeetingMessageRow,
  accountEmail: string | null,
  joinUrlFallback: string | null,
  graphMeta: Awaited<ReturnType<typeof enrichGraphMeetingInvitation>> | null
): MeetingInvitationView | null {
  const ev = message.event
  if (!ev) return null

  const isAllDay = ev.isAllDay === true
  const startIso = graphDateTimeToIso(ev.start?.dateTime, ev.start?.timeZone, isAllDay)
  const endIso = graphDateTimeToIso(ev.end?.dateTime, ev.end?.timeZone, isAllDay)
  if (!startIso || !endIso) return null

  const organizerEmail = ev.organizer?.emailAddress?.address?.trim().toLowerCase() ?? null
  const organizerName = ev.organizer?.emailAddress?.name?.trim() || null
  const joinUrl =
    ev.onlineMeeting?.joinUrl?.trim() ||
    joinUrlFallback ||
    extractMeetingJoinUrl(ev.location?.displayName ?? '')

  const attendeesFromEvent = (ev.attendees ?? [])
    .map((a) => {
      const email = a.emailAddress?.address?.trim().toLowerCase()
      if (!email) return null
      return {
        email,
        name: a.emailAddress?.name?.trim() || null,
        partStat: mapGraphPartStat(a.status?.response)
      }
    })
    .filter((a): a is NonNullable<typeof a> => a != null)

  const selfEmail = (accountEmail ?? '').trim().toLowerCase()
  const selfFromAttendees = selfEmail
    ? attendeesFromEvent.find((a) => a.email === selfEmail)?.partStat ?? null
    : null

  const selfPartStat = graphMeta?.selfPartStat ?? selfFromAttendees
  const attendees = mergeMeetingAttendees(
    attendeesFromEvent,
    graphMeta?.attendees,
    accountEmail,
    selfPartStat
  )

  const meetingType = message.meetingMessageType?.toLowerCase() ?? null
  const isCancelled = meetingType === 'meetingcancelled'
  const isOpenRequest = !meetingType || meetingType === 'meetingrequest'

  return {
    uid: ev.iCalUId?.trim() || null,
    method: meetingMethodFromGraphType(message.meetingMessageType),
    sequence: 0,
    status: isCancelled ? 'CANCELLED' : null,
    summary: ev.subject?.trim() || 'Termin',
    startIso,
    endIso,
    isAllDay,
    location: ev.location?.displayName?.trim() || null,
    descriptionPlain: null,
    bodyHtml: null,
    organizer: organizerEmail ? { email: organizerEmail, name: organizerName } : null,
    attendees,
    joinUrl,
    selfPartStat,
    isCancelled,
    canRespond: isOpenRequest && !isCancelled && Boolean(ev.iCalUId?.trim()),
    respondUnsupportedReason: isCancelled
      ? 'Der Termin wurde abgesagt.'
      : !isOpenRequest
        ? 'Antwort nur bei offenen Einladungen moeglich.'
        : null,
    allowNewTimeProposals: graphMeta?.allowNewTimeProposals ?? true,
    selfProposedStartIso: graphMeta?.selfProposedStartIso ?? null,
    selfProposedEndIso: graphMeta?.selfProposedEndIso ?? null
  }
}

/** Liest Meeting-Einladung aus Graph eventMessage (ohne .ics-Anhang). */
export async function fetchMeetingInvitationFromGraphMessage(
  accountId: string,
  remoteMessageId: string,
  accountEmail: string | null,
  joinUrlFallback: string | null
): Promise<MeetingInvitationView | null> {
  const client = await getClientFor(accountId)
  const msg = await readMeetingMessage(client, accountId, remoteMessageId)
  if (!msg || !isGraphEventMessage(msg['@odata.type'])) {
    return null
  }

  const row: GraphMeetingMessageRow = {
    meetingMessageType: msg.meetingMessageType ?? null,
    allowNewTimeProposals: msg.allowNewTimeProposals ?? null,
    event: msg.event ?? (await readEventFromEventMessage(client, accountId, remoteMessageId))
  }

  if (!row.event) {
    return null
  }

  let graphMeta: Awaited<ReturnType<typeof enrichGraphMeetingInvitation>> | null = null
  const uid = row.event.iCalUId?.trim()
  if (uid) {
    try {
      graphMeta = await enrichGraphMeetingInvitation(accountId, uid, accountEmail, null)
    } catch {
      graphMeta = null
    }
  }

  return buildInvitationFromGraphEvent(row, accountEmail, joinUrlFallback, graphMeta)
}
