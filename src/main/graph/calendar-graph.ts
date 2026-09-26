import {
  calendarZonedPartsFromDateOnly,
  calendarZonedPartsFromUtcIso,
  formatUtcIsoAsLocalDateTime,
  utcIsoFromWallDateTime
} from '@shared/calendar-datetime'
import { prepareCalendarEventBodyHtml, mergeCalendarEventBodyPreservingTeamsMeetingBlob, extractRawTeamsOnlineMeetingBlob } from '@shared/calendar-event-body-html'
import {
  formatChronellWebinarDraftAttendees,
  formatChronellWebinarInvitationFlag,
  GRAPH_CHRONELL_WEBINAR_DRAFT_ATTENDEES_PROP_ID,
  GRAPH_CHRONELL_WEBINAR_INVITATION_PROP_ID,
  parseChronellWebinarDraftAttendees,
  parseChronellWebinarInvitationFlag
} from '@shared/chronell-webinar-calendar'
import { preferTeamsJoinUrl } from '@shared/teams-join-url'
import type {
  CalendarEventSensitivity,
  CalendarEventShowAs,
  CalendarGraphCalendarRow,
  CalendarM365GroupCalendarsPage,
  CalendarSaveEventRecurrence,
  MeetingAttendeePartStat
} from '@shared/types'
import {
  normalizeCalendarEventSensitivity,
  normalizeCalendarEventShowAs
} from '@shared/calendar-event-status'
import {
  buildMicrosoftGraphRecurrencePayload,
  parseMicrosoftGraphRecurrence
} from '../calendar-recurrence'
import {
  m365GroupCalendarRef,
  parseM365GroupIdFromCalendarRef
} from '@shared/microsoft-m365-group-calendar'
import { mapWithConcurrency } from '../map-with-concurrency'
import { createGraphClient } from './client'
import { runGraphMailboxRequest } from './graph-account-request'
import { loadConfig } from '../config'
import { graphWindowsZoneToIana, ianaToWindowsTimeZone } from '@shared/microsoft-timezones'
import { graphCalendarColorToDisplayHex, isGraphCalendarColorPreset } from '@shared/graph-calendar-colors'

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

interface GraphDateTimeTimeZone {
  dateTime: string
  timeZone: string
}

interface GraphEvent {
  id: string
  subject?: string | null
  start?: GraphDateTimeTimeZone | null
  end?: GraphDateTimeTimeZone | null
  isAllDay?: boolean | null
  location?: { displayName?: string | null } | null
  webLink?: string | null
  onlineMeeting?: { joinUrl?: string | null } | null
  isOnlineMeeting?: boolean | null
  onlineMeetingProvider?: string | null
  organizer?: { emailAddress?: { name?: string | null; address?: string | null } } | null
  categories?: string[] | null
  attendees?: GraphAttendee[] | null
  body?: { contentType?: string | null; content?: string | null } | null
  isReminderOn?: boolean | null
  reminderMinutesBeforeStart?: number | null
  isOrganizer?: boolean | null
  /** `singleInstance` | `occurrence` | `exception` | `seriesMaster` */
  type?: string | null
  seriesMasterId?: string | null
  showAs?: string | null
  sensitivity?: string | null
  /** Outlook „Teilnehmerliste ausblenden“. */
  hideAttendees?: boolean | null
  /** Zeitzone beim Anlegen (bleibt auch wenn start/end als UTC geliefert werden). */
  originalStartTimeZone?: string | null
  originalEndTimeZone?: string | null
  /** Nur mit `$expand=calendar(...)` in calendarView. */
  calendar?: { id?: string | null; color?: string | null; hexColor?: string | null } | null
}

interface GraphAttendee {
  type?: string | null
  emailAddress?: { name?: string | null; address?: string | null } | null
  status?: { response?: string | null; time?: string | null } | null
}

interface GraphEventCollection {
  value: GraphEvent[]
  '@odata.nextLink'?: string
}

export interface GraphCalendarEventRow {
  id: string
  subject: string | null
  startIso: string
  endIso: string
  isAllDay: boolean
  location: string | null
  webLink: string | null
  joinUrl: string | null
  organizer: string | null
  categories: string[]
  /** Aus `calendar.hexColor` / `calendar.color` (MS365), sonst null. */
  displayColorHex: string | null
  /** Graph-Kalender-ID, falls per `$expand=calendar` geliefert. */
  graphCalendarId: string | null
  /** false: Kalender/Konto erlaubt keine Aenderungen am Termin. */
  calendarCanEdit?: boolean
  /** Anzeigen als (Graph `showAs` / Google `transparency`). */
  showAs?: CalendarEventShowAs | null
  /** Vertraulichkeit (Graph `sensitivity` / Google `visibility`). */
  sensitivity?: CalendarEventSensitivity | null
  /** true: Serienmaster, Vorkommen oder Ausnahme. */
  isSeries?: boolean
}

/**
 * Graph liefert dateTime oft ohne Offset; die Bedeutung ist dann in `timeZone`
 * (Windows- oder IANA-Name). Wandelt in UTC-ISO fuer FullCalendar.
 * Ganztaegig: `YYYY-MM-DD` (Ende bei Graph exklusiv, wie bei FullCalendar).
 */
function graphDateTimeToIso(
  dateTime: string,
  graphTimeZone: string | null | undefined,
  isAllDay: boolean
): string | null {
  return utcIsoFromWallDateTime(dateTime, graphTimeZone, isAllDay, graphWindowsZoneToIana)
}

function rowFromGraph(e: GraphEvent): GraphCalendarEventRow | null {
  const start = e.start?.dateTime
  const end = e.end?.dateTime
  if (!start || !end) return null
  const allDay = !!e.isAllDay
  const startIso = graphDateTimeToIso(start, e.start?.timeZone, allDay)
  const endIso = graphDateTimeToIso(end, e.end?.timeZone, allDay)
  if (!startIso || !endIso) return null
  const categories = Array.isArray(e.categories)
    ? e.categories.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    : []
  const displayColorHex = graphCalendarColorToDisplayHex(
    e.calendar?.hexColor ?? undefined,
    e.calendar?.color ?? undefined
  )
  const graphCalendarId =
    typeof e.calendar?.id === 'string' && e.calendar.id.trim().length > 0 ? e.calendar.id.trim() : null
  return {
    id: e.id,
    subject: e.subject ?? null,
    startIso,
    endIso,
    isAllDay: allDay,
    location: e.location?.displayName ?? null,
    webLink: e.webLink ?? null,
    joinUrl: e.onlineMeeting?.joinUrl ?? null,
    organizer: e.organizer?.emailAddress?.address ?? e.organizer?.emailAddress?.name ?? null,
    categories,
    displayColorHex,
    graphCalendarId,
    showAs: normalizeCalendarEventShowAs(e.showAs) ?? 'busy',
    sensitivity: normalizeCalendarEventSensitivity(e.sensitivity) ?? 'normal',
    isSeries: (() => {
      const t = (e.type ?? '').trim()
      if (t === 'occurrence' || t === 'exception' || t === 'seriesMaster') return true
      return Boolean(e.seriesMasterId?.trim())
    })()
  }
}

const EVENT_SELECT_FIELDS =
  'id,subject,start,end,isAllDay,location,webLink,onlineMeeting,organizer,categories,showAs,sensitivity,type,seriesMasterId'

async function paginateCalendarViewWithOptionalCalendarExpand(
  accountId: string,
  pathWithDateTimeQuery: string
): Promise<GraphCalendarEventRow[]> {
  const client = await getClientFor(accountId)

  const paginate = async (expandCalendar: boolean): Promise<GraphCalendarEventRow[]> => {
    const expandPart = expandCalendar ? '&$expand=calendar($select=id,color,hexColor)' : ''
    const out: GraphCalendarEventRow[] = []
    let url: string | null =
      `${pathWithDateTimeQuery}&$select=${EVENT_SELECT_FIELDS}${expandPart}&$orderby=start/dateTime&$top=200`
    while (url) {
      const page = (await client.api(url).get()) as GraphEventCollection
      for (const ev of page.value) {
        const row = rowFromGraph(ev)
        if (row) out.push(row)
      }
      const next = page['@odata.nextLink']
      url = next ? next.replace(/^https?:\/\/[^/]+\/v[0-9.]+/, '') : null
    }
    return out
  }

  try {
    return await paginate(true)
  } catch (e) {
    console.warn('[calendar-graph] calendarView with $expand=calendar failed, retrying without expand', e)
    return paginate(false)
  }
}

export async function graphGetCalendar(
  accountId: string,
  calendarId: string
): Promise<{ id: string; color?: string | null; hexColor?: string | null }> {
  if (parseM365GroupIdFromCalendarRef(calendarId)) {
    throw new Error('Gruppenkalender: Metadaten nur ueber Gruppen-Endpunkt.')
  }
  const client = await getClientFor(accountId)
  const enc = encodeURIComponent(calendarId)
  return (await client.api(`/me/calendars/${enc}`).select('id,color,hexColor').get()) as {
    id: string
    color?: string | null
    hexColor?: string | null
  }
}

export async function graphPatchCalendarColor(
  accountId: string,
  graphCalendarId: string,
  color: string
): Promise<void> {
  if (parseM365GroupIdFromCalendarRef(graphCalendarId)) {
    throw new Error('Gruppenkalender: Farbe kann in MailClient nicht geaendert werden.')
  }
  if (!isGraphCalendarColorPreset(color)) {
    throw new Error('Ungueltige Kalenderfarbe (nur Outlook-Presets).')
  }
  const client = await getClientFor(accountId)
  const enc = encodeURIComponent(graphCalendarId)
  await client.api(`/me/calendars/${enc}`).patch({ color })
}

export async function graphListCalendarView(
  accountId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<GraphCalendarEventRow[]> {
  const start = rangeStart.toISOString()
  const end = rangeEnd.toISOString()
  const path = `/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`
  return paginateCalendarViewWithOptionalCalendarExpand(accountId, path)
}

/** Termine in einem bestimmten Kalender (`GET /me/calendars/{id}/calendarView`). */
export async function graphListCalendarViewInCalendar(
  accountId: string,
  graphCalendarId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<GraphCalendarEventRow[]> {
  const groupId = parseM365GroupIdFromCalendarRef(graphCalendarId)
  if (groupId) {
    const start = rangeStart.toISOString()
    const end = rangeEnd.toISOString()
    const encG = encodeURIComponent(groupId)
    const path = `/groups/${encG}/calendar/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`
    const synthetic = m365GroupCalendarRef(groupId)
    let rows = await paginateCalendarViewWithOptionalCalendarExpand(accountId, path)
    try {
      const client = await getClientFor(accountId)
      const cal = (await client
        .api(`/groups/${encG}/calendar`)
        .select('id,color,hexColor')
        .get()) as { id?: string; color?: string | null; hexColor?: string | null }
      const overlayHex = graphCalendarColorToDisplayHex(cal.hexColor ?? undefined, cal.color ?? undefined)
      rows = rows.map((r) => ({
        ...r,
        graphCalendarId: synthetic,
        displayColorHex: r.displayColorHex ?? overlayHex ?? null
      }))
    } catch {
      rows = rows.map((r) => ({
        ...r,
        graphCalendarId: synthetic
      }))
    }
    return rows
  }

  const start = rangeStart.toISOString()
  const end = rangeEnd.toISOString()
  const encId = encodeURIComponent(graphCalendarId)
  const path = `/me/calendars/${encId}/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`

  let rows = await paginateCalendarViewWithOptionalCalendarExpand(accountId, path)
  try {
    const cal = await graphGetCalendar(accountId, graphCalendarId)
    const overlayHex = graphCalendarColorToDisplayHex(cal.hexColor, cal.color)
    rows = rows.map((r) => ({
      ...r,
      graphCalendarId: r.graphCalendarId ?? graphCalendarId,
      displayColorHex: r.displayColorHex ?? overlayHex ?? null
    }))
  } catch {
    rows = rows.map((r) => ({
      ...r,
      graphCalendarId: r.graphCalendarId ?? graphCalendarId
    }))
  }
  return rows
}

interface GraphCalendarListItem {
  id: string
  name?: string | null
  isDefaultCalendar?: boolean | null
  canEdit?: boolean | null
  color?: string | null
  hexColor?: string | null
}

interface GraphCalendarListResponse {
  value: GraphCalendarListItem[]
}

interface GraphDirectoryObject {
  id?: string
  displayName?: string | null
  ['@odata.type']?: string
  groupTypes?: string[]
}

interface GraphDirectoryCollection {
  value: GraphDirectoryObject[]
  '@odata.nextLink'?: string
}

const MAX_M365_GROUP_CALENDARS_LIST = 280
/** Graph MailboxConcurrency — konservativ 2 parallele Gruppenkalender-Metadaten-Abrufe. */
const M365_GROUP_CALENDAR_FETCH_CONCURRENCY = 2

/** Kurzzeit-Cache: `transitiveMemberOf` bei jeder Seite neu zu holen waere langsam. */
const m365UnifiedGroupListCache = new Map<string, { at: number; groups: GraphDirectoryObject[] }>()
const m365GroupMembershipWarnedAccounts = new Set<string>()
const M365_UNIFIED_GROUP_LIST_CACHE_MS = 5 * 60 * 1000

function isUnifiedMicrosoft365Group(o: GraphDirectoryObject): boolean {
  const odataType = o['@odata.type']
  if (odataType && odataType !== '#microsoft.graph.group') return false
  return Array.isArray(o.groupTypes) && o.groupTypes.includes('Unified')
}

function graphCollectionNextPath(nextLink: string | undefined): string | null {
  if (!nextLink) return null
  return nextLink.replace(/^https?:\/\/[^/]+\/v[0-9.]+/, '')
}

function formatGraphMembershipError(e: unknown): string {
  if (e && typeof e === 'object') {
    const ge = e as { statusCode?: number; code?: string; message?: string }
    const parts = [
      ge.statusCode != null ? `HTTP ${ge.statusCode}` : null,
      ge.code,
      ge.message
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  return String(e)
}

type M365GroupMembershipListMode = 'transitive' | 'direct'

/**
 * Graph verlangt bei OData-Cast + $select den Advanced-Query-Header (siehe user-list-transitivememberof).
 */
async function fetchM365GroupMembershipPages(
  client: Awaited<ReturnType<typeof getClientFor>>,
  mode: M365GroupMembershipListMode
): Promise<GraphDirectoryObject[]> {
  const base =
    mode === 'transitive'
      ? '/me/transitiveMemberOf/microsoft.graph.group'
      : '/me/memberOf/microsoft.graph.group'
  const members: GraphDirectoryObject[] = []
  let nextPath: string | null = null
  let first = true
  while (first || nextPath) {
    const page = first
      ? ((await client
          .api(base)
          .header('ConsistencyLevel', 'eventual')
          .query({ $count: 'true', $select: 'id,displayName,groupTypes', $top: '100' })
          .get()) as GraphDirectoryCollection)
      : ((await client.api(nextPath!).get()) as GraphDirectoryCollection)
    first = false
    for (const v of page.value ?? []) {
      if (isUnifiedMicrosoft365Group(v) && v.id) members.push(v)
    }
    nextPath = graphCollectionNextPath(page['@odata.nextLink'])
  }
  return members
}

/**
 * Alle Unified Groups des Nutzers (sortiert), Kalender-Metadaten noch nicht geladen.
 */
async function loadUnifiedGroupsSorted(accountId: string): Promise<GraphDirectoryObject[]> {
  const client = await getClientFor(accountId)
  let members: GraphDirectoryObject[]
  try {
    members = await fetchM365GroupMembershipPages(client, 'transitive')
  } catch (e) {
    try {
      members = await fetchM365GroupMembershipPages(client, 'direct')
      console.warn(
        '[calendar-graph] transitiveMemberOf fehlgeschlagen, nutze memberOf (nur direkte Mitgliedschaften):',
        formatGraphMembershipError(e)
      )
    } catch (e2) {
      if (!m365GroupMembershipWarnedAccounts.has(accountId)) {
        m365GroupMembershipWarnedAccounts.add(accountId)
        console.warn(
          '[calendar-graph] Gruppenkalender nicht geladen (Arbeits-/Schulkonto und GroupMember.Read.All mit Admin-Zustimmung noetig):',
          formatGraphMembershipError(e2)
        )
      }
      return []
    }
  }

  const unique = new Map<string, GraphDirectoryObject>()
  for (const m of members) {
    if (m.id) unique.set(m.id, m)
  }
  let groups = [...unique.values()].sort((a, b) =>
    (a.displayName ?? '').localeCompare(b.displayName ?? '', 'de')
  )
  if (groups.length > MAX_M365_GROUP_CALENDARS_LIST) {
    console.warn(
      `[calendar-graph] ${groups.length} Unified Groups — limitiere auf ${MAX_M365_GROUP_CALENDARS_LIST} Eintraege.`
    )
    groups = groups.slice(0, MAX_M365_GROUP_CALENDARS_LIST)
  }
  m365UnifiedGroupListCache.set(accountId, { at: Date.now(), groups })
  return groups
}

async function loadUnifiedGroupsSortedCached(accountId: string): Promise<GraphDirectoryObject[]> {
  const hit = m365UnifiedGroupListCache.get(accountId)
  const now = Date.now()
  if (hit && now - hit.at < M365_UNIFIED_GROUP_LIST_CACHE_MS) {
    return hit.groups
  }
  return loadUnifiedGroupsSorted(accountId)
}

async function fetchM365GroupCalendarRowsForSlice(
  accountId: string,
  slice: GraphDirectoryObject[]
): Promise<CalendarGraphCalendarRow[]> {
  if (slice.length === 0) return []
  const client = await getClientFor(accountId)
  const part = await mapWithConcurrency(slice, M365_GROUP_CALENDAR_FETCH_CONCURRENCY, async (g) => {
    const gid = g.id as string
    try {
      const cal = (await runGraphMailboxRequest(accountId, `group calendar meta ${gid}`, () =>
        client
          .api(`/groups/${encodeURIComponent(gid)}/calendar`)
          .select('id,name,color,hexColor')
          .get()
      )) as {
        id?: string
        name?: string | null
        color?: string | null
        hexColor?: string | null
      }
      const name = displayNameForM365GroupCalendar(g.displayName, cal.name)
      return {
        id: m365GroupCalendarRef(gid),
        name,
        isDefaultCalendar: false,
        canEdit: true,
        color: cal.color ?? undefined,
        hexColor: cal.hexColor ?? undefined,
        calendarKind: 'm365Group' as const
      } satisfies CalendarGraphCalendarRow
    } catch {
      return null
    }
  })
  return part.filter((r) => r != null) as CalendarGraphCalendarRow[]
}

/**
 * Microsoft-365-Gruppenkalender (Unified Groups), nur eine Seite — weniger Graph-Aufrufe.
 */
export async function graphListM365GroupCalendarPage(
  accountId: string,
  offset: number,
  limit: number
): Promise<CalendarM365GroupCalendarsPage> {
  const groups = await loadUnifiedGroupsSortedCached(accountId)
  const totalGroups = groups.length
  const o = Math.max(0, Math.floor(offset))
  const lim = Math.max(1, Math.floor(limit))
  const slice = groups.slice(o, o + lim)
  const calendars = await fetchM365GroupCalendarRowsForSlice(accountId, slice)
  return {
    calendars,
    totalGroups,
    offset: o,
    limit: lim,
    hasMore: o + lim < totalGroups
  }
}

/** Graph liefert fuer Gruppenkalender oft `name` = «Calendar»/«Kalender» — dann Gruppennamen zeigen. */
function displayNameForM365GroupCalendar(
  groupDisplayName: string | null | undefined,
  calendarName: string | null | undefined
): string {
  const g = groupDisplayName?.trim() ?? ''
  const cRaw = calendarName?.trim() ?? ''
  const cLower = cRaw.toLowerCase()
  const genericCal =
    cLower === 'calendar' ||
    cLower === 'kalender' ||
    cLower === 'calendrier' ||
    cLower === 'calendario' ||
    cLower === 'agenda'
  if (g.length > 0) {
    if (cRaw.length > 0 && !genericCal && cRaw !== g) {
      return `${g} — ${cRaw}`
    }
    return g
  }
  if (cRaw.length > 0) return cRaw
  return 'Gruppenkalender'
}

export async function graphListCalendars(accountId: string): Promise<CalendarGraphCalendarRow[]> {
  const client = await getClientFor(accountId)
  const res = (await client
    .api('/me/calendars')
    .select('id,name,isDefaultCalendar,canEdit,color,hexColor')
    .get()) as GraphCalendarListResponse
  const rows: CalendarGraphCalendarRow[] = []
  for (const c of res.value ?? []) {
    if (!c.id) continue
    /** Auch rein freigegebene Kalender (`canEdit: false`) — Termine kommen ueber `/me/calendars/{id}/calendarView`. */
    rows.push({
      id: c.id,
      name: (c.name?.trim() || 'Kalender') as string,
      isDefaultCalendar: !!c.isDefaultCalendar,
      canEdit: c.canEdit !== false,
      color: c.color ?? undefined,
      hexColor: c.hexColor ?? undefined
    })
  }
  rows.sort((a, b) => {
    if (a.isDefaultCalendar !== b.isDefaultCalendar) return a.isDefaultCalendar ? -1 : 1
    return a.name.localeCompare(b.name, 'de')
  })
  return rows
}

export interface CreateTeamsCalendarEventInput {
  subject: string
  startIso: string
  endIso: string
  bodyHtml?: string
  /** Windows-Zeitzonen-ID fuer Graph; optional, sonst aus App-Konfiguration. */
  timeZone?: string
  /** Graph-Kalender-ID; optional = Standardkalender (`POST /me/events`). */
  graphCalendarId?: string | null
  /** Einladungen (Graph `attendees`, max. 500 laut Microsoft). */
  attendeeEmails?: string[] | null
}

export interface CreateTeamsCalendarEventResult {
  id: string
  webLink: string | null
  joinUrl: string | null
}

type GraphEventWriteFields = {
  subject: string
  startIso: string
  endIso: string
  isAllDay: boolean
  location?: string | null
  bodyHtml?: string | null
  /** Wenn gesetzt: `POST /me/calendars/{id}/events`, sonst `POST /me/events`. */
  graphCalendarId?: string | null
  /** Outlook-Kategorien (max. 25); `undefined` = Feld beim Schreiben weglassen. */
  categories?: string[] | null
  /** Microsoft: Einladungen; beim PATCH nur mitsenden, wenn definiert (ersetzt gesamte Sammlung). */
  attendeeEmails?: string[] | null
  /** Microsoft: Teams-Besprechung (nur sinnvoll bei nicht ganztaegig). */
  teamsMeeting?: boolean | null
  /** Serientermin (POST Anlegen, oder PATCH Einzeltermin → Serie). */
  recurrence?: CalendarSaveEventRecurrence | null
  /** Microsoft: Erinnerung (`isReminderOn` / `reminderMinutesBeforeStart`). */
  reminderMinutesBeforeStart?: number | null
  /** IANA-Zeitzone fuer Start/Ende (timed events). */
  timeZone?: string | null
  /** Microsoft: Anzeigen als (`showAs`). */
  showAs?: CalendarEventShowAs | null
  /** Microsoft: Vertraulichkeit (`sensitivity`). */
  sensitivity?: CalendarEventSensitivity | null
  /** Microsoft: Teilnehmerliste ausblenden (`hideAttendees`). */
  hideAttendees?: boolean | null
  /** Microsoft: Antworten anfordern (`responseRequested`). */
  responseRequested?: boolean | null
  /** Microsoft: Weiterleitung zulassen (DoNotForward Extended Property, invertiert). */
  allowForwarding?: boolean | null
  /** Microsoft: Chronell-Webinar-Einladung (Extended Property). */
  chronellWebinarInvitation?: boolean | null
  /** Microsoft: optionale Teilnehmer (`attendees[].type = optional`). */
  optionalAttendeeEmails?: string[] | null
  /** Microsoft: Teilnehmer-Einladungen versenden (`false` = Entwurf speichern). */
  notifyAttendees?: boolean | null
}

/** Graph Event `attendees` Collection — Microsoft Docs: max. 500. */
const MAX_GRAPH_EVENT_ATTENDEES = 500

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function mergeUniqueEmails(
  ...lists: Array<string[] | null | undefined>
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const raw of list ?? []) {
      const a = raw.trim().toLowerCase()
      if (!a || !SIMPLE_EMAIL.test(a) || seen.has(a)) continue
      seen.add(a)
      out.push(a)
    }
  }
  return out
}

/** Outlook „Weiterleitung zulassen“ aus = Extended Property DoNotForward. */
export const GRAPH_DO_NOT_FORWARD_PROP_ID =
  'Boolean {00020329-0000-0000-C000-000000000046} Name DoNotForward'

export type GraphAttendeeType = 'required' | 'optional'

/**
 * Graph `attendees` mit Typ, dedupliziert (Lowercase), max. {@link MAX_GRAPH_EVENT_ATTENDEES}.
 * `seen` erlaubt kombinierte required+optional-Listen ohne Doppeladressierung.
 */
export function buildGraphAttendees(
  emails: string[] | null | undefined,
  type: GraphAttendeeType = 'required',
  seen: Set<string> = new Set()
): {
  emailAddress: { address: string; name: string }
  type: GraphAttendeeType
}[] {
  if (!emails?.length) return []
  const out: {
    emailAddress: { address: string; name: string }
    type: GraphAttendeeType
  }[] = []
  for (const raw of emails) {
    const a = raw.trim().toLowerCase()
    if (!a || !SIMPLE_EMAIL.test(a) || seen.has(a)) continue
    if (seen.size >= MAX_GRAPH_EVENT_ATTENDEES) {
      throw new Error(
        `Zu viele Teilnehmer (max. ${MAX_GRAPH_EVENT_ATTENDEES}). Bitte die Liste kürzen oder eine Verteilerliste nutzen.`
      )
    }
    seen.add(a)
    out.push({
      emailAddress: { address: a, name: a },
      type
    })
  }
  return out
}

/** Required + optional Teilnehmer (Required hat Vorrang bei Duplikaten). */
export function buildGraphAttendeesMixed(
  requiredEmails: string[] | null | undefined,
  optionalEmails: string[] | null | undefined
): {
  emailAddress: { address: string; name: string }
  type: GraphAttendeeType
}[] {
  const seen = new Set<string>()
  const required = buildGraphAttendees(requiredEmails, 'required', seen)
  const optional = buildGraphAttendees(optionalEmails, 'optional', seen)
  return [...required, ...optional]
}

export type GraphTeamsMeetingPatchFields = {
  isOnlineMeeting: boolean
  onlineMeetingProvider: 'teamsForBusiness' | 'unknown'
}

/**
 * Teams-Felder fuer PATCH.
 * Bei wantTeams immer `isOnlineMeeting: true` mitsenden — sonst kann ein Body-Update
 * ohne Meeting-Blob die Online-Besprechung stillschweigend deaktivieren, und wir
 * wuerden den Status nicht wiederherstellen (frueher: null wenn already online).
 */
export function graphTeamsMeetingPatchFields(
  wantTeams: boolean,
  currentlyOnline: boolean
): GraphTeamsMeetingPatchFields | null {
  if (wantTeams) {
    return { isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' }
  }
  if (currentlyOnline) {
    return { isOnlineMeeting: false, onlineMeetingProvider: 'unknown' }
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type GraphMeetingMetaForBodyPatch = {
  isOnlineMeeting: boolean
  onlineMeetingJoinUrl: string | null
  bodyRaw: string | null
  teamsBlob: string | null
}

async function fetchGraphEventMeetingMetaWithBlobRetries(
  client: ReturnType<typeof createGraphClient>,
  path: string,
  options: { wantTeams: boolean; maxAttempts?: number }
): Promise<GraphMeetingMetaForBodyPatch> {
  const maxAttempts = options.maxAttempts ?? 4
  let isOnlineMeeting = false
  let onlineMeetingJoinUrl: string | null = null
  let bodyRaw: string | null = null
  let teamsBlob: string | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(300 * attempt)
    const ev = (await client
      .api(`${path}?$select=isOnlineMeeting,onlineMeeting,body`)
      .get()) as GraphEvent
    isOnlineMeeting = !!ev.isOnlineMeeting
    onlineMeetingJoinUrl = ev.onlineMeeting?.joinUrl?.trim() || null
    bodyRaw = ev.body?.content?.trim() || null
    teamsBlob = extractRawTeamsOnlineMeetingBlob(bodyRaw)
    if (teamsBlob) break
    if (!options.wantTeams && !isOnlineMeeting && !onlineMeetingJoinUrl) break
  }

  return { isOnlineMeeting, onlineMeetingJoinUrl, bodyRaw, teamsBlob }
}

/**
 * Body fuer Graph-PATCH bei (potenziellen) Online-Meetings.
 * Ohne erkannten Meeting-Blob darf User-HTML den Termin nicht allein patchen —
 * sonst deaktiviert Outlook die Teams-Besprechung.
 */
export function resolveGraphEventBodyForTeamsUpdate(input: {
  wantTeams: boolean
  isOnlineMeeting: boolean
  onlineMeetingJoinUrl: string | null
  existingBodyRaw: string | null
  userBodyHtml: string | null
  defaultBodyContent: string
}): { bodyContent: string; omitBodyFromPrimaryPatch: boolean } {
  const teamsBlob = extractRawTeamsOnlineMeetingBlob(input.existingBodyRaw)
  const shouldPreserveTeamsMeeting =
    input.wantTeams ||
    input.isOnlineMeeting ||
    !!teamsBlob ||
    !!input.onlineMeetingJoinUrl?.trim()

  if (!shouldPreserveTeamsMeeting) {
    return { bodyContent: input.defaultBodyContent, omitBodyFromPrimaryPatch: false }
  }
  if (teamsBlob) {
    return {
      bodyContent: mergeCalendarEventBodyPreservingTeamsMeetingBlob(
        input.userBodyHtml,
        input.existingBodyRaw
      ),
      omitBodyFromPrimaryPatch: false
    }
  }
  if (input.wantTeams) {
    return { bodyContent: input.defaultBodyContent, omitBodyFromPrimaryPatch: true }
  }
  return {
    bodyContent: mergeCalendarEventBodyPreservingTeamsMeetingBlob(
      input.userBodyHtml,
      input.existingBodyRaw
    ),
    omitBodyFromPrimaryPatch: false
  }
}

async function resolveGraphEventJoinUrlAfterWrite(
  client: ReturnType<typeof createGraphClient>,
  eventPath: string,
  created: GraphEvent,
  wantTeams: boolean
): Promise<string | null> {
  // Kritischer Pfad: erste brauchbare Join-URL (auch langer meetup-join-Link).
  // Kurzen /meet/…-Link und Body holt der Renderer im Hintergrund nach.
  const joinFrom = (ev: GraphEvent): string | null =>
    ev.onlineMeeting?.joinUrl?.trim() || null

  const immediate = joinFrom(created)
  if (immediate) return immediate
  if (!wantTeams) return null

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 400 : 800)
    const fresh = (await client
      .api(`${eventPath}?$select=onlineMeeting,isOnlineMeeting`)
      .get()) as GraphEvent
    const url = joinFrom(fresh)
    if (url) return url
  }
  return null
}

/** Teilnehmer + Einladungs-Flags (unabhaengig von Teams-Besprechung). */
export function applyGraphMeetingInviteToPayload(
  payload: Record<string, unknown>,
  attendeeEmails: string[] | null | undefined,
  options?: {
    optionalAttendeeEmails?: string[] | null
    responseRequested?: boolean | null
  }
): void {
  const att = buildGraphAttendeesMixed(attendeeEmails, options?.optionalAttendeeEmails)
  if (att.length > 0) {
    payload.attendees = att
    payload.responseRequested =
      typeof options?.responseRequested === 'boolean' ? options.responseRequested : true
  } else if (typeof options?.responseRequested === 'boolean') {
    payload.responseRequested = options.responseRequested
  }
}

function applyGraphExtendedPropertiesToPayload(
  payload: Record<string, unknown>,
  options?: {
    allowForwarding?: boolean | null
    chronellWebinarInvitation?: boolean | null
    chronellWebinarDraftAttendees?: string | null
  }
): void {
  const props: Array<{ id: string; value: string }> = []
  if (typeof options?.allowForwarding === 'boolean') {
    props.push({
      id: GRAPH_DO_NOT_FORWARD_PROP_ID,
      value: options.allowForwarding ? 'false' : 'true'
    })
  }
  if (typeof options?.chronellWebinarInvitation === 'boolean') {
    props.push({
      id: GRAPH_CHRONELL_WEBINAR_INVITATION_PROP_ID,
      value: formatChronellWebinarInvitationFlag(options.chronellWebinarInvitation)
    })
  }
  if (options?.chronellWebinarDraftAttendees !== undefined) {
    props.push({
      id: GRAPH_CHRONELL_WEBINAR_DRAFT_ATTENDEES_PROP_ID,
      value: options.chronellWebinarDraftAttendees ?? ''
    })
  }
  if (props.length > 0) {
    payload.singleValueExtendedProperties = props
  }
}

type GraphAttendeeWritePlan = {
  patchAttendees: boolean
  attendeeEmails: string[]
  optionalAttendeeEmails: string[]
  draftAttendeesJson: string | undefined
}

/** Entwurf speichern vs. Einladungen an Graph-Teilnehmer senden. */
export function resolveGraphAttendeeWritePlan(input: GraphEventWriteFields): GraphAttendeeWritePlan {
  const hasAttendeeFields =
    input.attendeeEmails !== undefined || input.optionalAttendeeEmails !== undefined
  if (!hasAttendeeFields) {
    return {
      patchAttendees: false,
      attendeeEmails: [],
      optionalAttendeeEmails: [],
      draftAttendeesJson: undefined
    }
  }
  const attendeeEmails = input.attendeeEmails ?? []
  const optionalAttendeeEmails = input.optionalAttendeeEmails ?? []
  if (input.notifyAttendees === false) {
    return {
      patchAttendees: false,
      attendeeEmails,
      optionalAttendeeEmails,
      draftAttendeesJson: formatChronellWebinarDraftAttendees({
        required: attendeeEmails,
        optional: optionalAttendeeEmails
      })
    }
  }
  return {
    patchAttendees: true,
    attendeeEmails,
    optionalAttendeeEmails,
    draftAttendeesJson: ''
  }
}

function applyGraphAttendeeWritePlanToPayload(
  payload: Record<string, unknown>,
  input: GraphEventWriteFields,
  plan: GraphAttendeeWritePlan
): void {
  if (plan.patchAttendees) {
    applyGraphMeetingInviteToPayload(payload, plan.attendeeEmails, {
      optionalAttendeeEmails: plan.optionalAttendeeEmails,
      responseRequested: input.responseRequested
    })
  } else if (typeof input.responseRequested === 'boolean') {
    payload.responseRequested = input.responseRequested
  }
}

function applyGraphAllowForwardingToPayload(
  payload: Record<string, unknown>,
  allowForwarding: boolean | null | undefined
): void {
  applyGraphExtendedPropertiesToPayload(payload, { allowForwarding })
}

export type GraphCalendarEventType =
  | 'singleInstance'
  | 'occurrence'
  | 'exception'
  | 'seriesMaster'

export interface GraphCalendarEventDetail {
  subject: string | null
  attendeeEmails: string[]
  optionalAttendeeEmails: string[]
  joinUrl: string | null
  isOnlineMeeting: boolean
  bodyHtml: string | null
  location: string | null
  organizer: string | null
  isReminderOn: boolean
  reminderMinutesBeforeStart: number | null
  /** IANA-Zeitzone von Start/Ende (timed events). */
  timeZone: string | null
  startIso?: string | null
  endIso?: string | null
  isAllDay?: boolean
  webLink?: string | null
  isOrganizer?: boolean | null
  eventType?: GraphCalendarEventType | null
  seriesMasterId?: string | null
  showAs?: CalendarEventShowAs | null
  sensitivity?: CalendarEventSensitivity | null
  hideAttendees?: boolean | null
  responseRequested?: boolean | null
  allowForwarding?: boolean | null
  chronellWebinarInvitation?: boolean | null
  webinarInvitationsPending?: boolean | null
  recurrence?: CalendarSaveEventRecurrence | null
  selfPartStat?: MeetingAttendeePartStat | null
  selfResponseAtIso?: string | null
}

function applyGraphReminderToPayload(
  payload: Record<string, unknown>,
  reminderMinutesBeforeStart: number | null | undefined
): void {
  if (reminderMinutesBeforeStart === undefined) return
  if (reminderMinutesBeforeStart === null) {
    payload.isReminderOn = false
    return
  }
  payload.isReminderOn = true
  payload.reminderMinutesBeforeStart = Math.max(0, Math.min(10_080, Math.round(reminderMinutesBeforeStart)))
}

/** Graph `recurrence` fuer POST (Anlegen) oder PATCH (Einzeltermin → Serie). */
async function applyGraphRecurrenceToPayload(
  payload: Record<string, unknown>,
  input: GraphEventWriteFields
): Promise<void> {
  if (!input.recurrence) return
  const appCfg = await loadConfig()
  const iana = graphWindowsZoneToIana(
    input.timeZone?.trim() ||
      appCfg.calendarTimeZone?.trim() ||
      Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const graphWindowsTz = ianaToWindowsTimeZone(iana)
  const startLocal = input.isAllDay
    ? calendarZonedPartsFromDateOnly(input.startIso.trim().slice(0, 10), iana)
    : calendarZonedPartsFromUtcIso(input.startIso, iana)
  if (!startLocal) {
    throw new Error('Serientermin: Startdatum fuer Wiederholung ungueltig.')
  }
  // Graph: range.startDate MUSS dem Datum von event.start entsprechen (gleiche Wandzeit-Zone).
  const startField = payload.start as { dateTime?: string } | undefined
  const startDateFromEvent =
    typeof startField?.dateTime === 'string' && /^\d{4}-\d{2}-\d{2}/.test(startField.dateTime)
      ? startField.dateTime.slice(0, 10)
      : null
  const parts =
    startDateFromEvent && startDateFromEvent !== startLocal.dateOnly
      ? { ...startLocal, dateOnly: startDateFromEvent }
      : startLocal
  const recPayload = buildMicrosoftGraphRecurrencePayload(
    input.recurrence,
    parts,
    graphWindowsTz
  )
  Object.assign(payload, recPayload)
}

async function assertGraphEventIsSeriesMaster(
  client: ReturnType<typeof createGraphClient>,
  eventPath: string
): Promise<void> {
  const verified = (await client
    .api(`${eventPath}?$select=type,recurrence`)
    .get()) as GraphEvent & { recurrence?: unknown }
  const type = normalizeGraphEventType(verified.type)
  if (type !== 'seriesMaster' || verified.recurrence == null) {
    throw new Error(
      'Die Wiederholung wurde von Microsoft 365 nicht übernommen. Bitte erneut speichern oder den Termin in Outlook prüfen.'
    )
  }
}

function applyGraphShowAsSensitivityToPayload(
  payload: Record<string, unknown>,
  input: GraphEventWriteFields
): void {
  if (input.showAs) {
    payload.showAs = input.showAs
  }
  if (input.sensitivity) {
    payload.sensitivity = input.sensitivity
  }
}

function applyGraphHideAttendeesToPayload(
  payload: Record<string, unknown>,
  hideAttendees: boolean | null | undefined
): void {
  if (typeof hideAttendees === 'boolean') {
    payload.hideAttendees = hideAttendees
  }
}

export function normalizeGraphEventBodyHtml(
  body: { contentType?: string | null; content?: string | null } | null | undefined
): string | null {
  return prepareCalendarEventBodyHtml(body?.content)
}

/**
 * Graph GET ohne `Prefer: outlook.timezone` liefert start/end oft als UTC.
 * Die echte Zone steht in `originalStartTimeZone` (beim Speichern explizit setzen).
 * Nicht-UTC-Werte haben Vorrang vor Prefer-losen UTC-Antworten.
 */
function resolveGraphEventStoredTimeZoneIana(ev: GraphEvent): string | null {
  if (ev.isAllDay) return null
  const candidates = [ev.originalStartTimeZone, ev.originalEndTimeZone, ev.start?.timeZone]
  for (const raw of candidates) {
    const t = raw?.trim()
    if (!t || /^tzone:\/\//i.test(t) || /^UTC$/i.test(t)) continue
    return graphWindowsZoneToIana(t)
  }
  for (const raw of candidates) {
    const t = raw?.trim()
    if (!t || /^tzone:\/\//i.test(t)) continue
    return graphWindowsZoneToIana(t)
  }
  return null
}

async function graphEventDateFields(input: GraphEventWriteFields): Promise<{
  isAllDay: boolean
  start: GraphDateTimeTimeZone
  end: GraphDateTimeTimeZone
  /** Explizit mitschreiben — sonst bleibt original* bei korrupten UTC-Terminen haengen. */
  originalStartTimeZone?: string
  originalEndTimeZone?: string
}> {
  if (input.isAllDay) {
    const sd = input.startIso.trim().slice(0, 10)
    const ed = input.endIso.trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sd) || !/^\d{4}-\d{2}-\d{2}$/.test(ed)) {
      throw new Error('Ganztaegig: Start und Ende als JJJJ-MM-TT (Ende exklusiv) erwartet.')
    }
    return {
      isAllDay: true,
      start: { dateTime: `${sd}T00:00:00`, timeZone: 'UTC' },
      end: { dateTime: `${ed}T00:00:00`, timeZone: 'UTC' }
    }
  }
  const appCfg = await loadConfig()
  const iana = graphWindowsZoneToIana(
    input.timeZone?.trim() ||
      appCfg.calendarTimeZone?.trim() ||
      Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const graphWindowsTz = ianaToWindowsTimeZone(iana)
  const startLocal = formatUtcIsoAsLocalDateTime(input.startIso, iana)
  const endLocal = formatUtcIsoAsLocalDateTime(input.endIso, iana)
  if (!startLocal || !endLocal) {
    throw new Error('Ungueltige Start- oder Endzeit.')
  }
  return {
    isAllDay: false,
    start: { dateTime: startLocal, timeZone: graphWindowsTz },
    end: { dateTime: endLocal, timeZone: graphWindowsTz },
    originalStartTimeZone: graphWindowsTz,
    originalEndTimeZone: graphWindowsTz
  }
}

function normalizeGraphEventCategories(c: string[] | null | undefined): string[] | undefined {
  if (c === undefined) return undefined
  if (c === null) return []
  const u = Array.from(new Set(c.map((x) => x.trim()).filter((x) => x.length > 0)))
  return u.slice(0, 25)
}

function eventWritePayload(input: GraphEventWriteFields): Promise<{
  isAllDay: boolean
  start: GraphDateTimeTimeZone
  end: GraphDateTimeTimeZone
  originalStartTimeZone?: string
  originalEndTimeZone?: string
  subject: string
  body: { contentType: 'HTML'; content: string }
  location?: { displayName: string }
  categories?: string[]
}> {
  return graphEventDateFields(input).then((dates) => {
    const cats = normalizeGraphEventCategories(input.categories)
    return {
      subject: input.subject.trim() || '(Ohne Titel)',
      body: {
        contentType: 'HTML' as const,
        content: prepareCalendarEventBodyHtml(input.bodyHtml) ?? '<p></p>'
      },
      ...dates,
      ...(input.location?.trim()
        ? { location: { displayName: input.location.trim() } }
        : {}),
      ...(cats !== undefined ? { categories: cats } : {})
    }
  })
}

function eventPostPath(graphCalendarId?: string | null): string {
  const calId = graphCalendarId?.trim() ?? ''
  const groupId = parseM365GroupIdFromCalendarRef(calId)
  if (groupId) {
    return `/groups/${encodeURIComponent(groupId)}/events`
  }
  return calId ? `/me/calendars/${encodeURIComponent(calId)}/events` : '/me/events'
}

/**
 * GET/PATCH/DELETE fuer Termine.
 * Mit `graphCalendarId`: kalenderbezogener Pfad (wichtig fuer Abos, freigegebene und Group-Kalender).
 */
export function graphEventInstancePath(graphEventId: string, graphCalendarId?: string | null): string {
  const calId = graphCalendarId?.trim() ?? ''
  const gid = parseM365GroupIdFromCalendarRef(calId)
  if (gid) {
    return `/groups/${encodeURIComponent(gid)}/events/${encodeURIComponent(graphEventId)}`
  }
  if (calId) {
    return `/me/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(graphEventId)}`
  }
  return `/me/events/${encodeURIComponent(graphEventId)}`
}

export async function graphGetCalendarEvent(
  accountId: string,
  graphEventId: string,
  graphCalendarId?: string | null,
  accountEmail?: string | null
): Promise<GraphCalendarEventDetail> {
  const client = await getClientFor(accountId)
  const path = graphEventInstancePath(graphEventId, graphCalendarId)
  const sel = encodeURIComponent(
    'id,subject,body,attendees,isOnlineMeeting,onlineMeeting,onlineMeetingProvider,start,end,isAllDay,location,organizer,isReminderOn,reminderMinutesBeforeStart,webLink,isOrganizer,type,seriesMasterId,showAs,sensitivity,hideAttendees,responseRequested,recurrence,responseStatus,originalStartTimeZone,originalEndTimeZone'
  )
  const expand = encodeURIComponent(
    `singleValueExtendedProperties($filter=id eq '${GRAPH_DO_NOT_FORWARD_PROP_ID}' or id eq '${GRAPH_CHRONELL_WEBINAR_INVITATION_PROP_ID}' or id eq '${GRAPH_CHRONELL_WEBINAR_DRAFT_ATTENDEES_PROP_ID}')`
  )
  const ev = (await client.api(`${path}?$select=${sel}&$expand=${expand}`).get()) as GraphEvent & {
    recurrence?: unknown
    responseRequested?: boolean | null
    responseStatus?: { response?: string | null; time?: string | null } | null
    singleValueExtendedProperties?: Array<{ id?: string | null; value?: string | null }> | null
  }
  const requiredEmails: string[] = []
  const optionalEmails: string[] = []
  const seen = new Set<string>()
  for (const at of ev.attendees ?? []) {
    const addr = at.emailAddress?.address?.trim().toLowerCase()
    if (!addr || !SIMPLE_EMAIL.test(addr) || seen.has(addr)) continue
    seen.add(addr)
    if ((at.type ?? '').trim().toLowerCase() === 'optional') {
      optionalEmails.push(addr)
    } else {
      requiredEmails.push(addr)
    }
  }
  const doNotForward = (ev.singleValueExtendedProperties ?? []).find(
    (p) => (p.id ?? '').trim() === GRAPH_DO_NOT_FORWARD_PROP_ID
  )
  const doNotForwardOn = (doNotForward?.value ?? '').trim().toLowerCase() === 'true'
  const chronellWebinar = (ev.singleValueExtendedProperties ?? []).find(
    (p) => (p.id ?? '').trim() === GRAPH_CHRONELL_WEBINAR_INVITATION_PROP_ID
  )
  const chronellDraftAttendees = (ev.singleValueExtendedProperties ?? []).find(
    (p) => (p.id ?? '').trim() === GRAPH_CHRONELL_WEBINAR_DRAFT_ATTENDEES_PROP_ID
  )
  const draftAttendees = parseChronellWebinarDraftAttendees(chronellDraftAttendees?.value)
  const organizer =
    ev.organizer?.emailAddress?.address?.trim() ||
    ev.organizer?.emailAddress?.name?.trim() ||
    null
  const reminderMinutes =
    typeof ev.reminderMinutesBeforeStart === 'number' && Number.isFinite(ev.reminderMinutesBeforeStart)
      ? Math.max(0, Math.round(ev.reminderMinutesBeforeStart))
      : null
  const allDay = !!ev.isAllDay
  const startIso = ev.start?.dateTime
    ? graphDateTimeToIso(ev.start.dateTime, ev.start?.timeZone, allDay)
    : null
  const endIso = ev.end?.dateTime
    ? graphDateTimeToIso(ev.end.dateTime, ev.end?.timeZone, allDay)
    : null
  const eventType = normalizeGraphEventType(ev.type)
  let recurrence = parseMicrosoftGraphRecurrence(ev.recurrence)
  const seriesMasterId = ev.seriesMasterId?.trim() || null
  if (
    !recurrence &&
    seriesMasterId &&
    (eventType === 'occurrence' || eventType === 'exception')
  ) {
    try {
      const masterPath = graphEventInstancePath(seriesMasterId, graphCalendarId)
      const master = (await client
        .api(`${masterPath}?$select=recurrence`)
        .get()) as { recurrence?: unknown }
      recurrence = parseMicrosoftGraphRecurrence(master.recurrence)
    } catch {
      /* Master nicht lesbar — Formular bleibt ohne Serienmuster */
    }
  }
  let selfPartStat = graphResponseStatusToPartStat(ev.responseStatus?.response)
  let selfResponseAtIso = graphResponseStatusTimeToIso(ev.responseStatus?.time)
  if (!selfPartStat || selfPartStat === 'needs-action') {
    const self = accountEmail?.trim().toLowerCase() ?? ''
    if (self) {
      const hit = (ev.attendees ?? []).find(
        (a) => (a.emailAddress?.address ?? '').trim().toLowerCase() === self
      )
      const fromAttendee = graphResponseStatusToPartStat(hit?.status?.response)
      if (fromAttendee && fromAttendee !== 'needs-action') {
        selfPartStat = fromAttendee
        selfResponseAtIso =
          graphResponseStatusTimeToIso(hit?.status?.time) ?? selfResponseAtIso
      }
    }
  }
  const totalCap = MAX_GRAPH_EVENT_ATTENDEES
  // Draft (noch nicht gesendet) mit Graph-Liste mergen — sonst verdecken alte Drafts
  // neu in Outlook ergaenzte Teilnehmer.
  const resolvedRequired = mergeUniqueEmails(
    draftAttendees?.required,
    requiredEmails
  ).slice(0, totalCap)
  const resolvedOptional = mergeUniqueEmails(
    draftAttendees?.optional,
    optionalEmails
  )
    .filter((e) => !resolvedRequired.includes(e))
    .slice(0, Math.max(0, totalCap - resolvedRequired.length))
  return {
    subject: ev.subject ?? null,
    attendeeEmails: resolvedRequired,
    optionalAttendeeEmails: resolvedOptional,
    joinUrl: preferTeamsJoinUrl({
      joinUrl: ev.onlineMeeting?.joinUrl?.trim() || null,
      bodyHtml: normalizeGraphEventBodyHtml(ev.body ?? null)
    }),
    isOnlineMeeting: !!ev.isOnlineMeeting,
    bodyHtml: normalizeGraphEventBodyHtml(ev.body ?? null),
    location: ev.location?.displayName?.trim() || null,
    organizer,
    isReminderOn: !!ev.isReminderOn,
    reminderMinutesBeforeStart: reminderMinutes,
    timeZone: resolveGraphEventStoredTimeZoneIana(ev),
    startIso,
    endIso,
    isAllDay: allDay,
    webLink: ev.webLink?.trim() || null,
    isOrganizer: typeof ev.isOrganizer === 'boolean' ? ev.isOrganizer : null,
    eventType,
    seriesMasterId,
    showAs: normalizeCalendarEventShowAs(ev.showAs) ?? 'busy',
    sensitivity: normalizeCalendarEventSensitivity(ev.sensitivity) ?? 'normal',
    hideAttendees: !!ev.hideAttendees,
    responseRequested: typeof ev.responseRequested === 'boolean' ? ev.responseRequested : true,
    allowForwarding: doNotForward ? !doNotForwardOn : true,
    chronellWebinarInvitation: parseChronellWebinarInvitationFlag(chronellWebinar?.value),
    webinarInvitationsPending: draftAttendees != null,
    recurrence,
    selfPartStat,
    selfResponseAtIso
  }
}

function normalizeGraphEventType(raw: string | null | undefined): GraphCalendarEventType | null {
  const v = (raw ?? '').trim()
  switch (v) {
    case 'singleInstance':
    case 'occurrence':
    case 'exception':
    case 'seriesMaster':
      return v
    default:
      return null
  }
}

function graphResponseStatusToPartStat(raw: string | null | undefined): MeetingAttendeePartStat | null {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'accepted':
      return 'accepted'
    case 'declined':
      return 'declined'
    case 'tentativelyaccepted':
    case 'tentative':
      return 'tentative'
    case 'organizer':
      return null
    case 'notresponded':
    case 'none':
      return 'needs-action'
    default:
      return null
  }
}

function graphResponseStatusTimeToIso(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t) return null
  if (t.startsWith('0001-01-01')) return null
  const ms = Date.parse(t)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

/**
 * Kalendereintrag anlegen (optional Teams-Besprechung und Teilnehmer).
 */
export async function graphCreateSimpleCalendarEvent(
  accountId: string,
  input: GraphEventWriteFields
): Promise<CreateTeamsCalendarEventResult> {
  const client = await getClientFor(accountId)
  const core = await eventWritePayload(input)
  const payload: Record<string, unknown> = {
    subject: core.subject,
    body: core.body,
    start: core.start,
    end: core.end,
    isAllDay: core.isAllDay,
    ...(core.location ? { location: core.location } : {}),
    ...(core.categories !== undefined ? { categories: core.categories } : {}),
    ...(core.originalStartTimeZone
      ? {
          originalStartTimeZone: core.originalStartTimeZone,
          originalEndTimeZone: core.originalEndTimeZone ?? core.originalStartTimeZone
        }
      : {})
  }
  const wantTeams = !!input.teamsMeeting && !core.isAllDay
  if (wantTeams) {
    payload.isOnlineMeeting = true
    payload.onlineMeetingProvider = 'teamsForBusiness'
  }
  const attendeePlan = resolveGraphAttendeeWritePlan(input)
  applyGraphAttendeeWritePlanToPayload(payload, input, attendeePlan)
  applyGraphHideAttendeesToPayload(payload, input.hideAttendees)
  applyGraphExtendedPropertiesToPayload(payload, {
    allowForwarding: input.allowForwarding,
    chronellWebinarInvitation: input.chronellWebinarInvitation,
    ...(attendeePlan.draftAttendeesJson !== undefined
      ? { chronellWebinarDraftAttendees: attendeePlan.draftAttendeesJson }
      : {})
  })
  applyGraphReminderToPayload(payload, input.reminderMinutesBeforeStart)
  await applyGraphRecurrenceToPayload(payload, input)
  applyGraphShowAsSensitivityToPayload(payload, input)
  const created = (await client.api(eventPostPath(input.graphCalendarId)).post(payload)) as GraphEvent
  const eventPath = graphEventInstancePath(created.id, input.graphCalendarId)
  if (input.recurrence) {
    await assertGraphEventIsSeriesMaster(client, eventPath)
  }

  // Teams: Graph haengt den Meeting-Blob oft ans Body-Ende. Webinar braucht den Blob im Slot —
  // sonst fehlen Umfrage/Hinweise in Outlook und der offizielle Block liegt unter der Karte.
  if (wantTeams) {
    const meetingMeta = await fetchGraphEventMeetingMetaWithBlobRetries(client, eventPath, {
      wantTeams: true,
      maxAttempts: 6
    })
    if (meetingMeta.teamsBlob || meetingMeta.bodyRaw) {
      const bodyContent = mergeCalendarEventBodyPreservingTeamsMeetingBlob(
        input.bodyHtml,
        meetingMeta.bodyRaw
      )
      await client.api(eventPath).patch({
        body: { contentType: 'HTML', content: bodyContent },
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness'
      })
    }
  }

  const joinUrl = await resolveGraphEventJoinUrlAfterWrite(client, eventPath, created, wantTeams)
  return {
    id: created.id,
    webLink: created.webLink ?? null,
    joinUrl
  }
}

export async function graphUpdateCalendarEvent(
  accountId: string,
  graphEventId: string,
  input: GraphEventWriteFields
): Promise<void> {
  const client = await getClientFor(accountId)
  const core = await eventWritePayload(input)
  const path = graphEventInstancePath(graphEventId, input.graphCalendarId)

  const wantTeams = !!input.teamsMeeting && !core.isAllDay
  let meetingMeta = await fetchGraphEventMeetingMetaWithBlobRetries(client, path, {
    wantTeams
  })
  const bodyResolution = resolveGraphEventBodyForTeamsUpdate({
    wantTeams,
    isOnlineMeeting: meetingMeta.isOnlineMeeting,
    onlineMeetingJoinUrl: meetingMeta.onlineMeetingJoinUrl,
    existingBodyRaw: meetingMeta.bodyRaw,
    userBodyHtml: input.bodyHtml ?? null,
    defaultBodyContent: core.body.content
  })
  let bodyContent = bodyResolution.bodyContent
  const omitBodyFromPrimaryPatch = bodyResolution.omitBodyFromPrimaryPatch
  const deferInviteFields = omitBodyFromPrimaryPatch && wantTeams
  const attendeePlan = resolveGraphAttendeeWritePlan(input)

  const payload: Record<string, unknown> = {
    subject: core.subject,
    ...(omitBodyFromPrimaryPatch
      ? {}
      : { body: { contentType: 'HTML', content: bodyContent } }),
    start: core.start,
    end: core.end,
    isAllDay: core.isAllDay,
    ...(core.originalStartTimeZone
      ? {
          originalStartTimeZone: core.originalStartTimeZone,
          originalEndTimeZone: core.originalEndTimeZone ?? core.originalStartTimeZone
        }
      : {})
  }
  if (core.location) {
    payload.location = core.location
  }
  if (core.categories !== undefined) {
    payload.categories = core.categories
  }
  if (!deferInviteFields) {
    applyGraphAttendeeWritePlanToPayload(payload, input, attendeePlan)
    applyGraphHideAttendeesToPayload(payload, input.hideAttendees)
    applyGraphExtendedPropertiesToPayload(payload, {
      allowForwarding: input.allowForwarding,
      chronellWebinarInvitation: input.chronellWebinarInvitation,
      ...(attendeePlan.draftAttendeesJson !== undefined
        ? { chronellWebinarDraftAttendees: attendeePlan.draftAttendeesJson }
        : {})
    })
  }
  applyGraphReminderToPayload(payload, input.reminderMinutesBeforeStart)
  applyGraphShowAsSensitivityToPayload(payload, input)
  if (typeof input.teamsMeeting === 'boolean') {
    if (core.isAllDay && !input.teamsMeeting) {
      payload.isOnlineMeeting = false
      payload.onlineMeetingProvider = 'unknown'
    } else if (!core.isAllDay) {
      const teamsPatch = graphTeamsMeetingPatchFields(
        input.teamsMeeting,
        meetingMeta.isOnlineMeeting || !!meetingMeta.onlineMeetingJoinUrl?.trim()
      )
      if (teamsPatch) {
        payload.isOnlineMeeting = teamsPatch.isOnlineMeeting
        payload.onlineMeetingProvider = teamsPatch.onlineMeetingProvider
      }
    }
  }
  // Zuerst Felder ohne Serie — Einzeltermin → Serie separat (zuverlässiger bei Graph).
  await client.api(path).patch(payload)

  if (omitBodyFromPrimaryPatch && wantTeams) {
    meetingMeta = await fetchGraphEventMeetingMetaWithBlobRetries(client, path, {
      wantTeams: true,
      maxAttempts: 6
    })
    if (!meetingMeta.teamsBlob && !meetingMeta.isOnlineMeeting) {
      await client.api(path).patch({
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness'
      })
      meetingMeta = await fetchGraphEventMeetingMetaWithBlobRetries(client, path, {
        wantTeams: true,
        maxAttempts: 6
      })
    }
    bodyContent = meetingMeta.teamsBlob
      ? mergeCalendarEventBodyPreservingTeamsMeetingBlob(input.bodyHtml, meetingMeta.bodyRaw)
      : (prepareCalendarEventBodyHtml(input.bodyHtml) ?? '<p></p>')
    const bodyPatch: Record<string, unknown> = {
      body: { contentType: 'HTML', content: bodyContent },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness'
    }
    if (input.attendeeEmails !== undefined || input.optionalAttendeeEmails !== undefined) {
      applyGraphAttendeeWritePlanToPayload(bodyPatch, input, attendeePlan)
    } else if (typeof input.responseRequested === 'boolean') {
      bodyPatch.responseRequested = input.responseRequested
    }
    applyGraphHideAttendeesToPayload(bodyPatch, input.hideAttendees)
    applyGraphExtendedPropertiesToPayload(bodyPatch, {
      allowForwarding: input.allowForwarding,
      chronellWebinarInvitation: input.chronellWebinarInvitation,
      ...(attendeePlan.draftAttendeesJson !== undefined
        ? { chronellWebinarDraftAttendees: attendeePlan.draftAttendeesJson }
        : {})
    })
    await client.api(path).patch(bodyPatch)
  }

  if (input.recurrence) {
    const recurrencePatch: Record<string, unknown> = {
      start: core.start,
      end: core.end,
      isAllDay: core.isAllDay
    }
    await applyGraphRecurrenceToPayload(recurrencePatch, input)
    await client.api(path).patch({
      recurrence: recurrencePatch.recurrence
    })
    await assertGraphEventIsSeriesMaster(client, path)
  }
}

/** Nur Start/Ende/Ganztaegig patchen (Drag & Drop / Resize), ohne Body zu ueberschreiben. */
export async function graphPatchCalendarEventTimes(
  accountId: string,
  graphEventId: string,
  times: { startIso: string; endIso: string; isAllDay: boolean },
  graphCalendarId?: string | null
): Promise<void> {
  const client = await getClientFor(accountId)
  const dates = await graphEventDateFields({
    subject: '—',
    startIso: times.startIso,
    endIso: times.endIso,
    isAllDay: times.isAllDay,
    bodyHtml: null
  })
  const path = graphEventInstancePath(graphEventId, graphCalendarId)
  await client.api(path).patch({
    start: dates.start,
    end: dates.end,
    isAllDay: dates.isAllDay,
    ...(dates.originalStartTimeZone
      ? {
          originalStartTimeZone: dates.originalStartTimeZone,
          originalEndTimeZone: dates.originalEndTimeZone ?? dates.originalStartTimeZone
        }
      : {})
  })
}

export async function graphDeleteCalendarEvent(
  accountId: string,
  graphEventId: string,
  graphCalendarId?: string | null
): Promise<void> {
  const client = await getClientFor(accountId)
  const path = graphEventInstancePath(graphEventId, graphCalendarId)
  await client.api(path).delete()
}

/** Nur Outlook-Kategorien setzen (kein vollstaendiger Termin-Body noetig). */
export async function graphPatchEventCategories(
  accountId: string,
  graphEventId: string,
  categories: string[],
  graphCalendarId?: string | null
): Promise<void> {
  const client = await getClientFor(accountId)
  const capped = Array.from(
    new Set(categories.map((c) => c.trim()).filter((c) => c.length > 0))
  ).slice(0, 25)
  const path = graphEventInstancePath(graphEventId, graphCalendarId)
  await client.api(path).patch({ categories: capped })
}

/** Nur Anzeigen-als / Vertraulichkeit patchen. */
export async function graphPatchEventStatus(
  accountId: string,
  graphEventId: string,
  input: {
    showAs?: CalendarEventShowAs | null
    sensitivity?: CalendarEventSensitivity | null
    graphCalendarId?: string | null
  }
): Promise<void> {
  const payload: Record<string, unknown> = {}
  const showAs = normalizeCalendarEventShowAs(input.showAs ?? undefined)
  const sensitivity = normalizeCalendarEventSensitivity(input.sensitivity ?? undefined)
  if (showAs) payload.showAs = showAs
  if (sensitivity) payload.sensitivity = sensitivity
  if (Object.keys(payload).length === 0) return
  const client = await getClientFor(accountId)
  const path = graphEventInstancePath(graphEventId, input.graphCalendarId)
  await client.api(path).patch(payload)
}

/**
 * Legt einen Kalendereintrag mit Teams-Besprechung an (wie Outlook „Teams-Besprechung“).
 */
export async function graphCreateTeamsCalendarEvent(
  accountId: string,
  input: CreateTeamsCalendarEventInput
): Promise<CreateTeamsCalendarEventResult> {
  const client = await getClientFor(accountId)
  const appCfg = await loadConfig()
  const ianaRaw =
    input.timeZone?.trim() ||
    appCfg.calendarTimeZone?.trim() ||
    Intl.DateTimeFormat().resolvedOptions().timeZone
  const iana = graphWindowsZoneToIana(ianaRaw)
  const graphWindowsTz = ianaToWindowsTimeZone(iana)

  const startLocal = formatUtcIsoAsLocalDateTime(input.startIso, iana)
  const endLocal = formatUtcIsoAsLocalDateTime(input.endIso, iana)
  if (!startLocal || !endLocal) {
    throw new Error('Ungueltige Start- oder Endzeit (ISO erwartet).')
  }

  const payload: Record<string, unknown> = {
    subject: input.subject,
    body: {
      contentType: 'HTML',
      content: prepareCalendarEventBodyHtml(input.bodyHtml) ?? '<p></p>'
    },
    start: { dateTime: startLocal, timeZone: graphWindowsTz },
    end: { dateTime: endLocal, timeZone: graphWindowsTz },
    originalStartTimeZone: graphWindowsTz,
    originalEndTimeZone: graphWindowsTz,
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness'
  }
  applyGraphMeetingInviteToPayload(payload, input.attendeeEmails)

  const created = (await client.api(eventPostPath(input.graphCalendarId)).post(payload)) as GraphEvent
  const eventPath = graphEventInstancePath(created.id, input.graphCalendarId)
  const joinUrl = await resolveGraphEventJoinUrlAfterWrite(client, eventPath, created, true)
  return {
    id: created.id,
    webLink: created.webLink ?? null,
    joinUrl
  }
}

type GraphScheduleStatus =
  | 'free'
  | 'busy'
  | 'tentative'
  | 'oof'
  | 'workingElsewhere'
  | 'unknown'

function mapGraphScheduleStatus(raw: string | null | undefined): GraphScheduleStatus {
  switch (raw?.toLowerCase()) {
    case 'free':
      return 'free'
    case 'busy':
      return 'busy'
    case 'tentative':
      return 'tentative'
    case 'oof':
      return 'oof'
    case 'workingelsewhere':
      return 'workingElsewhere'
    default:
      return 'unknown'
  }
}

interface GraphScheduleItem {
  start?: GraphDateTimeTimeZone | null
  end?: GraphDateTimeTimeZone | null
  status?: string | null
}

interface GraphScheduleInfo {
  scheduleId?: string | null
  availabilityView?: string | null
  scheduleItems?: GraphScheduleItem[] | null
}

interface GraphScheduleCollection {
  value?: GraphScheduleInfo[] | null
}

function graphDateTimeToUtcIso(dt: GraphDateTimeTimeZone | null | undefined): string | null {
  if (!dt?.dateTime?.trim()) return null
  const tz = dt.timeZone?.trim() || 'UTC'
  try {
    if (tz === 'UTC' || tz === 'Etc/UTC') {
      const ms = Date.parse(`${dt.dateTime.trim()}Z`)
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null
    }
    const iana = graphWindowsZoneToIana(tz) ?? tz
    return utcIsoFromWallDateTime(dt.dateTime.trim(), iana, false, () => iana)
  } catch {
    const ms = Date.parse(dt.dateTime.trim())
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null
  }
}

export async function graphGetAttendeeSchedule(
  accountId: string,
  input: import('@shared/types').CalendarGetAttendeeScheduleInput
): Promise<import('@shared/types').CalendarAttendeeScheduleView[]> {
  const emails = Array.from(
    new Set(input.attendeeEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  ).slice(0, 20)
  if (emails.length === 0) return []

  const client = await getClientFor(accountId)
  const appCfg = await loadConfig()
  const iana =
    appCfg.calendarTimeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
  const graphWindowsTz = ianaToWindowsTimeZone(iana)
  const startLocal = formatUtcIsoAsLocalDateTime(input.startIso, iana)
  const endLocal = formatUtcIsoAsLocalDateTime(input.endIso, iana)
  if (!startLocal || !endLocal) {
    throw new Error('Ungueltige Start- oder Endzeit.')
  }

  const body = {
    schedules: emails,
    startTime: { dateTime: startLocal, timeZone: graphWindowsTz },
    endTime: { dateTime: endLocal, timeZone: graphWindowsTz },
    availabilityViewInterval: Math.max(15, Math.min(60, input.intervalMinutes ?? 30))
  }

  const res = (await runGraphMailboxRequest(accountId, 'calendar:getSchedule', () =>
    client.api('/me/calendar/getSchedule').post(body)
  )) as GraphScheduleCollection

  const out: import('@shared/types').CalendarAttendeeScheduleView[] = []
  for (const row of res.value ?? []) {
    const email = row.scheduleId?.trim() ?? ''
    if (!email) continue
    const items: import('@shared/types').CalendarAttendeeScheduleItem[] = []
    for (const item of row.scheduleItems ?? []) {
      const startIso = graphDateTimeToUtcIso(item.start)
      const endIso = graphDateTimeToUtcIso(item.end)
      if (!startIso || !endIso) continue
      items.push({
        startIso,
        endIso,
        status: mapGraphScheduleStatus(item.status)
      })
    }
    out.push({
      email,
      items,
      availabilityView: row.availabilityView ?? null
    })
  }
  return out
}

interface GraphMeetingTimeSuggestion {
  confidence?: number | null
  meetingTimeSlot?: {
    start?: GraphDateTimeTimeZone | null
    end?: GraphDateTimeTimeZone | null
  } | null
}

interface GraphFindMeetingTimesResult {
  meetingTimeSuggestions?: GraphMeetingTimeSuggestion[] | null
}

export async function graphFindMeetingTimes(
  accountId: string,
  input: import('@shared/types').CalendarFindMeetingTimesInput
): Promise<import('@shared/types').CalendarFreeSlot[]> {
  const emails = Array.from(
    new Set(input.attendeeEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  ).slice(0, 20)

  const client = await getClientFor(accountId)
  const appCfg = await loadConfig()
  const iana =
    appCfg.calendarTimeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
  const graphWindowsTz = ianaToWindowsTimeZone(iana)
  const startLocal = formatUtcIsoAsLocalDateTime(input.rangeStartIso, iana)
  const endLocal = formatUtcIsoAsLocalDateTime(input.rangeEndIso, iana)
  if (!startLocal || !endLocal) {
    throw new Error('Ungueltige Start- oder Endzeit.')
  }

  const durationMin = Math.max(15, Math.min(480, input.durationMinutes))
  const hours = Math.floor(durationMin / 60)
  const mins = durationMin % 60
  const meetingDuration =
    hours > 0 && mins > 0 ? `PT${hours}H${mins}M`
    : hours > 0 ? `PT${hours}H`
    : `PT${mins}M`

  const body: Record<string, unknown> = {
    timeConstraint: {
      timeslots: [
        {
          start: { dateTime: startLocal, timeZone: graphWindowsTz },
          end: { dateTime: endLocal, timeZone: graphWindowsTz }
        }
      ]
    },
    meetingDuration,
    maxCandidates: Math.max(1, Math.min(10, input.maxCandidates ?? 5))
  }

  if (emails.length > 0) {
    body.attendees = emails.map((address) => ({
      type: 'required',
      emailAddress: { address }
    }))
  }

  const res = (await runGraphMailboxRequest(accountId, 'calendar:findMeetingTimes', () =>
    client.api('/me/findMeetingTimes').post(body)
  )) as GraphFindMeetingTimesResult

  const slots: import('@shared/types').CalendarFreeSlot[] = []
  for (const suggestion of res.meetingTimeSuggestions ?? []) {
    const startIso = graphDateTimeToUtcIso(suggestion.meetingTimeSlot?.start)
    const endIso = graphDateTimeToUtcIso(suggestion.meetingTimeSlot?.end)
    if (!startIso || !endIso) continue
    slots.push({ startIso, endIso })
  }
  return slots
}
