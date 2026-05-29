import type { MeetingAttendeePartStat, MeetingInvitationResponseKind, MeetingInvitationAttendeeView } from '@shared/types'
import { formatUtcIsoAsLocalDateTime, utcIsoFromWallDateTime } from '@shared/calendar-datetime'
import { graphWindowsZoneToIana, ianaToWindowsTimeZone } from '@shared/microsoft-timezones'
import { createGraphClient } from './client'
import { runGraphMailboxRequest } from './graph-account-request'
import { loadConfig } from '../config'

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''")
}

interface GraphDateTimeTimeZone {
  dateTime?: string | null
  timeZone?: string | null
}

interface GraphTimeSlot {
  start?: GraphDateTimeTimeZone | null
  end?: GraphDateTimeTimeZone | null
}

interface GraphAttendeeStatus {
  response?: string | null
  time?: string | null
}

interface GraphAttendeeRow {
  type?: string | null
  emailAddress?: { name?: string | null; address?: string | null } | null
  status?: GraphAttendeeStatus | null
  proposedNewTime?: GraphTimeSlot | null
}

interface GraphEventRow {
  id?: string | null
  allowNewTimeProposals?: boolean | null
  attendees?: GraphAttendeeRow[] | null
}

interface GraphEventCollection {
  value?: GraphEventRow[] | null
}

interface GraphMessageRow {
  allowNewTimeProposals?: boolean | null
  meetingMessageType?: string | null
}

export interface GraphMeetingInvitationEnrichment {
  allowNewTimeProposals: boolean
  selfPartStat: MeetingAttendeePartStat | null
  selfProposedStartIso: string | null
  selfProposedEndIso: string | null
  attendees: MeetingInvitationAttendeeView[]
}

function mapGraphAttendees(
  rows: GraphAttendeeRow[] | null | undefined
): MeetingInvitationAttendeeView[] {
  const out: MeetingInvitationAttendeeView[] = []
  for (const row of rows ?? []) {
    const email = row.emailAddress?.address?.trim().toLowerCase()
    if (!email) continue
    out.push({
      email,
      name: row.emailAddress?.name?.trim() || null,
      partStat: graphPartStatToView(row.status?.response)
    })
  }
  return out
}

function graphPartStatToView(raw: string | null | undefined): MeetingAttendeePartStat {
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

function graphTimeSlotToUtcIso(slot: GraphTimeSlot | null | undefined): {
  startIso: string | null
  endIso: string | null
} {
  const start = slot?.start
  const end = slot?.end
  if (!start?.dateTime?.trim() || !end?.dateTime?.trim()) {
    return { startIso: null, endIso: null }
  }
  const startIso = utcIsoFromWallDateTime(
    start.dateTime.trim(),
    start.timeZone,
    false,
    graphWindowsZoneToIana
  )
  const endIso = utcIsoFromWallDateTime(end.dateTime.trim(), end.timeZone, false, graphWindowsZoneToIana)
  return { startIso, endIso }
}

async function findGraphEventByICalUid(
  accountId: string,
  iCalUid: string
): Promise<GraphEventRow | null> {
  const client = await getClientFor(accountId)
  const filter = `iCalUId eq '${escapeODataString(iCalUid)}'`
  const res = (await runGraphMailboxRequest(accountId, 'findMeetingByICalUid', () =>
    client.api('/me/events').filter(filter).select('id').top(1).get()
  )) as GraphEventCollection
  const id = res.value?.[0]?.id?.trim()
  if (!id) return null
  return (await runGraphMailboxRequest(accountId, 'getMeetingEventMeta', () =>
    client.api(`/me/events/${id}`).select('id,allowNewTimeProposals,attendees').get()
  )) as GraphEventRow
}

async function readAllowNewTimeProposalsFromMessage(
  accountId: string,
  messageRemoteId: string
): Promise<boolean | null> {
  void accountId
  void messageRemoteId
  return null
}

function resolveSelfFromAttendees(
  attendees: GraphAttendeeRow[] | null | undefined,
  accountEmail: string | null
): Pick<GraphMeetingInvitationEnrichment, 'selfPartStat' | 'selfProposedStartIso' | 'selfProposedEndIso'> {
  const self = (accountEmail ?? '').trim().toLowerCase()
  if (!self) {
    return { selfPartStat: null, selfProposedStartIso: null, selfProposedEndIso: null }
  }
  const hit = (attendees ?? []).find(
    (a) => (a.emailAddress?.address ?? '').trim().toLowerCase() === self
  )
  if (!hit) {
    return { selfPartStat: null, selfProposedStartIso: null, selfProposedEndIso: null }
  }
  const proposed = graphTimeSlotToUtcIso(hit.proposedNewTime)
  return {
    selfPartStat: graphPartStatToView(hit.status?.response),
    selfProposedStartIso: proposed.startIso,
    selfProposedEndIso: proposed.endIso
  }
}

/** Liest Graph-Metadaten zu einer Meeting-Einladung (RSVP-Status, Vorschlag, allowNewTimeProposals). */
export async function enrichGraphMeetingInvitation(
  accountId: string,
  iCalUid: string,
  accountEmail: string | null,
  messageRemoteId: string | null
): Promise<GraphMeetingInvitationEnrichment> {
  const event = await findGraphEventByICalUid(accountId, iCalUid)
  const fromMessage =
    messageRemoteId != null
      ? await readAllowNewTimeProposalsFromMessage(accountId, messageRemoteId)
      : null

  const allowNewTimeProposals =
    fromMessage ??
    (typeof event?.allowNewTimeProposals === 'boolean' ? event.allowNewTimeProposals : true)

  const self = resolveSelfFromAttendees(event?.attendees, accountEmail)
  return {
    allowNewTimeProposals,
    attendees: mapGraphAttendees(event?.attendees),
    ...self
  }
}

async function resolveGraphEventId(accountId: string, iCalUid: string): Promise<string> {
  const event = await findGraphEventByICalUid(accountId, iCalUid)
  const id = event?.id?.trim()
  if (!id) {
    throw new Error(
      'Termin im Kalender nicht gefunden. Bitte kurz synchronisieren und erneut versuchen.'
    )
  }
  return id
}

function graphResponsePath(response: MeetingInvitationResponseKind): string {
  switch (response) {
    case 'accept':
      return 'accept'
    case 'decline':
      return 'decline'
    case 'tentative':
    case 'propose':
      return 'tentativelyAccept'
  }
}

function toSelfPartStat(response: MeetingInvitationResponseKind): MeetingAttendeePartStat {
  switch (response) {
    case 'accept':
      return 'accepted'
    case 'decline':
      return 'declined'
    case 'tentative':
    case 'propose':
      return 'tentative'
  }
}

async function resolveGraphWindowsTimeZone(): Promise<string> {
  const appCfg = await loadConfig()
  const iana =
    appCfg.calendarTimeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
  return ianaToWindowsTimeZone(iana)
}

function utcIsoToGraphDateTime(utcIso: string, graphWindowsTz: string): GraphDateTimeTimeZone {
  const iana = graphWindowsZoneToIana(graphWindowsTz)
  const local = formatUtcIsoAsLocalDateTime(utcIso, iana)
  if (!local) throw new Error('Ungueltige vorgeschlagene Zeit.')
  return { dateTime: local, timeZone: graphWindowsTz }
}

/** Sendet RSVP an Microsoft Graph (Accept / Decline / Tentative / Propose new time). */
export async function respondToGraphMeetingInvitation(
  accountId: string,
  iCalUid: string,
  response: MeetingInvitationResponseKind,
  comment: string | null,
  proposedStartIso?: string | null,
  proposedEndIso?: string | null,
  sendResponse = true
): Promise<{
  selfPartStat: MeetingAttendeePartStat
  selfProposedStartIso: string | null
  selfProposedEndIso: string | null
}> {
  const eventId = await resolveGraphEventId(accountId, iCalUid)
  const client = await getClientFor(accountId)
  const action = graphResponsePath(response)
  const body: {
    comment?: string
    sendResponse?: boolean
    proposedNewTime?: { start: GraphDateTimeTimeZone; end: GraphDateTimeTimeZone }
  } = {
    sendResponse
  }
  const trimmed = comment?.trim()
  if (trimmed) body.comment = trimmed

  if (response === 'propose') {
    const startIso = proposedStartIso?.trim()
    const endIso = proposedEndIso?.trim()
    if (!startIso || !endIso) {
      throw new Error('Bitte Start- und Endzeit fuer den Vorschlag angeben.')
    }
    if (Date.parse(endIso) <= Date.parse(startIso)) {
      throw new Error('Die Endzeit muss nach der Startzeit liegen.')
    }
    const graphWindowsTz = await resolveGraphWindowsTimeZone()
    body.proposedNewTime = {
      start: utcIsoToGraphDateTime(startIso, graphWindowsTz),
      end: utcIsoToGraphDateTime(endIso, graphWindowsTz)
    }
  }

  await runGraphMailboxRequest(accountId, `meeting${action}`, () =>
    client.api(`/me/events/${eventId}/${action}`).post(body)
  )

  return {
    selfPartStat: toSelfPartStat(response),
    selfProposedStartIso: response === 'propose' ? (proposedStartIso ?? null) : null,
    selfProposedEndIso: response === 'propose' ? (proposedEndIso ?? null) : null
  }
}
