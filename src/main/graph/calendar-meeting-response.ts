import type { MeetingAttendeePartStat, MeetingInvitationResponseKind, MeetingInvitationAttendeeView } from '@shared/types'
import { formatUtcIsoAsLocalDateTime, utcIsoFromWallDateTime } from '@shared/calendar-datetime'
import { graphWindowsZoneToIana, ianaToWindowsTimeZone } from '@shared/microsoft-timezones'
import { createGraphClient } from './client'
import { runGraphMailboxRequest } from './graph-account-request'
import { loadConfig } from '../config'
import { graphEventInstancePath } from './calendar-graph'
import { formatGraphErrorMessage, readGraphStatusCode } from './graph-request-errors'
import { GraphError } from '@microsoft/microsoft-graph-client'

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

/** Loest die Graph-Event-ID des eigenen Kalenders anhand der iCalUID auf (fuer Reschedule etc.). */
export async function resolveGraphEventId(accountId: string, iCalUid: string): Promise<string> {
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
  const eventPath = `/me/events/${eventId}`

  // Pruefen, ob der Organisator eine Antwort erwartet (sonst schlaegt decline/accept fehl).
  let responseRequested = true
  try {
    const meta = (await runGraphMailboxRequest(accountId, 'getMeetingResponseRequested', () =>
      client.api(eventPath).select('responseRequested').get()
    )) as { responseRequested?: boolean | null }
    responseRequested = meta.responseRequested !== false
  } catch {
    responseRequested = true
  }

  if (!responseRequested) {
    if (response === 'decline') {
      await declineEventWhenOrganizerWantsNoResponse(accountId, client, eventPath)
      return {
        selfPartStat: 'declined',
        selfProposedStartIso: null,
        selfProposedEndIso: null
      }
    }
    // Zusage/Vorbehalt ohne Organisator-Benachrichtigung
    const action = graphResponsePath(response)
    const body: { comment?: string; sendResponse: boolean } = { sendResponse: false }
    const trimmed = comment?.trim()
    if (trimmed) body.comment = trimmed
    try {
      await runGraphMailboxRequest(accountId, `meeting${action}Silent`, () =>
        client.api(`${eventPath}/${action}`).post(body)
      )
    } catch {
      // Ohne responseRequested reicht lokaler Status; Graph-Aktion ist optional.
    }
    return {
      selfPartStat: toSelfPartStat(response),
      selfProposedStartIso: null,
      selfProposedEndIso: null
    }
  }

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

  try {
    await runGraphMailboxRequest(accountId, `meeting${action}`, () =>
      client.api(`${eventPath}/${action}`).post(body)
    )
  } catch (e) {
    if (
      response === 'decline' &&
      (isOrganizerResponseNotRequestedError(e) || readGraphStatusCode(e) === 400)
    ) {
      try {
        await declineEventWhenOrganizerWantsNoResponse(accountId, client, eventPath)
        return {
          selfPartStat: 'declined',
          selfProposedStartIso: null,
          selfProposedEndIso: null
        }
      } catch {
        throw e
      }
    }
    throw e
  }

  return {
    selfPartStat: toSelfPartStat(response),
    selfProposedStartIso: response === 'propose' ? (proposedStartIso ?? null) : null,
    selfProposedEndIso: response === 'propose' ? (proposedEndIso ?? null) : null
  }
}

export type CalendarEventRsvpKind = 'accept' | 'decline' | 'tentative'
export type CalendarEventRsvpScope = 'this' | 'series'

/** RSVP auf einen Kalendertermin (Einmaltermin oder Serie) per Graph-Event-ID. */
export async function respondToGraphCalendarEvent(
  accountId: string,
  graphEventId: string,
  response: CalendarEventRsvpKind,
  options: {
    graphCalendarId?: string | null
    scope?: CalendarEventRsvpScope
    comment?: string | null
    sendResponse?: boolean
  } = {}
): Promise<{
  selfPartStat: MeetingAttendeePartStat
  respondedEventId: string
  scope: CalendarEventRsvpScope
  /** true: Termin wurde geloescht (kein RSVP moeglich, Organisator will keine Antwort). */
  removedWithoutResponse?: boolean
}> {
  const client = await getClientFor(accountId)
  const eventId = graphEventId.trim()
  if (!eventId) throw new Error('graphEventId fehlt.')

  const path = graphEventInstancePath(eventId, options.graphCalendarId)
  const meta = (await runGraphMailboxRequest(accountId, 'getEventRsvpMeta', () =>
    client
      .api(`${path}?$select=id,type,seriesMasterId,isOrganizer,responseRequested`)
      .get()
  )) as {
    id?: string | null
    type?: string | null
    seriesMasterId?: string | null
    isOrganizer?: boolean | null
    responseRequested?: boolean | null
  }

  if (meta.isOrganizer === true) {
    throw new Error(
      'Als Organisator bitte den Termin loeschen statt die Teilnahme zu verneinen.'
    )
  }

  const scope: CalendarEventRsvpScope = options.scope === 'series' ? 'series' : 'this'
  let targetId = (meta.id?.trim() || eventId).trim()
  if (scope === 'series') {
    const type = (meta.type ?? '').trim()
    const master = meta.seriesMasterId?.trim()
    if (type === 'seriesMaster') {
      targetId = meta.id?.trim() || eventId
    } else if (master) {
      targetId = master
    }
  }

  const targetPath = graphEventInstancePath(targetId, options.graphCalendarId)
  const responseRequested = meta.responseRequested !== false

  // Organisator will keine Antwort: decline/accept mit sendResponse:true schlaegt fehl.
  // Ablehnen → silent decline + Loeschen; Zusagen → silent accept/tentative.
  if (!responseRequested) {
    if (response === 'decline') {
      await declineEventWhenOrganizerWantsNoResponse(accountId, client, targetPath)
      return {
        selfPartStat: 'declined',
        respondedEventId: targetId,
        scope,
        removedWithoutResponse: true
      }
    }
    const action = graphResponsePath(response)
    const body: { comment?: string; sendResponse: boolean } = { sendResponse: false }
    const trimmed = options.comment?.trim()
    if (trimmed) body.comment = trimmed
    try {
      await runGraphMailboxRequest(accountId, `calendarEvent${action}Silent`, () =>
        client.api(`${targetPath}/${action}`).post(body)
      )
    } catch {
      // Termin bleibt im Kalender; Status ggf. erst nach Sync sichtbar.
    }
    return {
      selfPartStat: toSelfPartStat(response),
      respondedEventId: targetId,
      scope,
      removedWithoutResponse: false
    }
  }

  const action = graphResponsePath(response)
  const body: { comment?: string; sendResponse?: boolean } = {
    sendResponse: options.sendResponse !== false
  }
  const trimmed = options.comment?.trim()
  if (trimmed) body.comment = trimmed

  try {
    await runGraphMailboxRequest(accountId, `calendarEvent${action}`, () =>
      client.api(`${targetPath}/${action}`).post(body)
    )
  } catch (e) {
    // Fallback: responseRequested oft falsch; Graph verlangt dann sendResponse:false (oder Loeschen).
    if (
      response === 'decline' &&
      (isOrganizerResponseNotRequestedError(e) || readGraphStatusCode(e) === 400)
    ) {
      try {
        await declineEventWhenOrganizerWantsNoResponse(accountId, client, targetPath)
        return {
          selfPartStat: 'declined',
          respondedEventId: targetId,
          scope,
          removedWithoutResponse: true
        }
      } catch {
        throw e
      }
    }
    // Zusage/Vorbehalt: einmal silent retry
    if (
      (response === 'accept' || response === 'tentative') &&
      isOrganizerResponseNotRequestedError(e)
    ) {
      const silentBody: { comment?: string; sendResponse: boolean } = { sendResponse: false }
      if (trimmed) silentBody.comment = trimmed
      await runGraphMailboxRequest(accountId, `calendarEvent${action}SilentFallback`, () =>
        client.api(`${targetPath}/${action}`).post(silentBody)
      )
      return {
        selfPartStat: toSelfPartStat(response),
        respondedEventId: targetId,
        scope,
        removedWithoutResponse: false
      }
    }
    throw e
  }

  return {
    selfPartStat: toSelfPartStat(response),
    respondedEventId: targetId,
    scope
  }
}

/**
 * Wenn der Organisator keine Antwort erwartet: zuerst decline mit sendResponse:false
 * (offizieller Graph-Weg), danach Termin aus dem eigenen Kalender entfernen.
 */
async function declineEventWhenOrganizerWantsNoResponse(
  accountId: string,
  client: Awaited<ReturnType<typeof getClientFor>>,
  eventPath: string
): Promise<void> {
  try {
    await runGraphMailboxRequest(accountId, 'calendarEventDeclineSilent', () =>
      client.api(`${eventPath}/decline`).post({ sendResponse: false })
    )
  } catch {
    // Manche Postfaecher akzeptieren auch silent decline nicht — dann nur loeschen.
  }
  await runGraphMailboxRequest(accountId, 'calendarEventDeleteNoResponse', () =>
    client.api(eventPath).delete()
  )
}

function normalizeGraphErrorText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc\u0060\u00b4]/g, "'")
    .replace(/\s+/g, ' ')
}

function collectGraphErrorTexts(e: unknown, into: string[], depth = 0): void {
  if (e == null || depth > 6) return
  if (typeof e === 'string') {
    into.push(e)
    return
  }
  if (typeof e !== 'object') return

  if (e instanceof Error) {
    if (e.message) into.push(e.message)
    const cause = (e as Error & { cause?: unknown }).cause
    if (cause) collectGraphErrorTexts(cause, into, depth + 1)
  }

  if (e instanceof GraphError) {
    if (typeof e.body === 'string') {
      into.push(e.body)
      try {
        const parsed = JSON.parse(e.body) as { error?: { message?: string; code?: string } }
        if (parsed.error?.message) into.push(parsed.error.message)
        if (parsed.error?.code) into.push(parsed.error.code)
      } catch {
        /* body ist Plaintext */
      }
    } else if (e.body && typeof e.body === 'object') {
      const err = (e.body as { error?: { message?: string; code?: string } }).error
      if (err?.message) into.push(err.message)
      if (err?.code) into.push(err.code)
    }
  }

  const o = e as { body?: unknown; code?: string; message?: string; error?: unknown }
  if (typeof o.message === 'string') into.push(o.message)
  if (typeof o.code === 'string') into.push(o.code)
  if (typeof o.body === 'string') into.push(o.body)
  if (o.body && typeof o.body === 'object') {
    const err = (o.body as { error?: { message?: string; code?: string } }).error
    if (err?.message) into.push(err.message)
    if (err?.code) into.push(err.code)
  }
  if (o.error) collectGraphErrorTexts(o.error, into, depth + 1)
}

/** Erkennung: Organisator hat „Antwort anfordern“ deaktiviert. */
export function isOrganizerResponseNotRequestedError(e: unknown): boolean {
  const texts: string[] = []
  collectGraphErrorTexts(e, texts)
  try {
    texts.push(formatGraphErrorMessage(e))
  } catch {
    /* ignore */
  }
  const joined = normalizeGraphErrorText(texts.join(' '))
  if (!joined.trim()) return false
  return (
    joined.includes("hasn't requested a response") ||
    joined.includes('has not requested a response') ||
    joined.includes('organizer has not requested') ||
    joined.includes('organizer hasn\'t requested') ||
    (joined.includes('requested a response') && joined.includes('organizer')) ||
    (joined.includes("can't be completed") &&
      joined.includes('organizer') &&
      joined.includes('response')) ||
    (joined.includes('response') && joined.includes('not requested'))
  )
}
