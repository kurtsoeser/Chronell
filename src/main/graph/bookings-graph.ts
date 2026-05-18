import type {
  BookingsAppointmentRow,
  BookingsBusinessDetail,
  BookingsBusinessRow,
  BookingsServiceRow,
  BookingsStaffMemberRow
} from '@shared/bookings-types'
import { resolveBookingsPublicUrl } from '@shared/bookings-public-url'
import { loadConfig } from '../config'
import { createGraphClient } from './client'
import { formatGraphErrorMessage, readGraphStatusCode } from './graph-request-errors'

interface GraphCollection<T> {
  value?: T[]
  '@odata.nextLink'?: string
}

interface GraphDateTimeTimeZone {
  dateTime?: string | null
  timeZone?: string | null
}

interface GraphBookingBusiness {
  id: string
  displayName?: string | null
  email?: string | null
  phone?: string | null
  webSiteUrl?: string | null
  publicUrl?: string | null
  isPublished?: boolean | null
}

interface GraphBookingService {
  id: string
  displayName?: string | null
  defaultDuration?: string | null
  defaultPrice?: number | null
  isHiddenFromCustomers?: boolean | null
  webUrl?: string | null
}

interface GraphBookingStaffMember {
  id: string
  displayName?: string | null
  emailAddress?: string | null
  role?: string | null
}

interface GraphBookingAppointment {
  id: string
  /** calendarView liefert start/end; appointments-Liste startDateTime/endDateTime. */
  start?: GraphDateTimeTimeZone | null
  end?: GraphDateTimeTimeZone | null
  startDateTime?: GraphDateTimeTimeZone | null
  endDateTime?: GraphDateTimeTimeZone | null
  customerName?: string | null
  customerEmailAddress?: string | null
  serviceName?: string | null
  staffMemberIds?: string[] | null
  isCancelled?: boolean | null
}

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function stripGraphHost(nextLink: string): string {
  return nextLink.replace(/^https?:\/\/[^/]+\/v[0-9.]+/, '')
}

/** Bookings-IDs sind oft E-Mail-Adressen; nicht encodeURIComponent — Graph-Client kodiert sonst doppelt (404). */
function normalizeBookingBusinessId(businessId: string): string {
  let id = businessId.trim()
  try {
    if (id.includes('%')) id = decodeURIComponent(id)
  } catch {
    // ignore
  }
  return id
}

function bookingBusinessPath(businessId: string, suffix: string): string {
  const id = normalizeBookingBusinessId(businessId)
  return `/solutions/bookingBusinesses/${id}/${suffix}`
}

function graphCalendarViewRangeParams(startIso: string, endIso: string): string {
  const start = encodeURIComponent(startIso)
  const end = encodeURIComponent(endIso)
  return `?start=${start}&end=${end}`
}

async function paginateGraph<T>(client: ReturnType<typeof createGraphClient>, path: string): Promise<T[]> {
  const out: T[] = []
  let url: string | null = path
  while (url) {
    const page = (await client.api(url).get()) as GraphCollection<T>
    if (page.value?.length) out.push(...page.value)
    const next = page['@odata.nextLink']
    url = next ? stripGraphHost(next) : null
  }
  return out
}

function isoFromGraphDt(dt: GraphDateTimeTimeZone | null | undefined): string | null {
  const raw = dt?.dateTime?.trim()
  if (!raw) return null
  const normalized = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

function parseDurationMinutes(isoDuration: string | null | undefined): number | null {
  if (!isoDuration?.trim()) return null
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(isoDuration.trim())
  if (!m) return null
  const h = m[1] ? Number(m[1]) : 0
  const min = m[2] ? Number(m[2]) : 0
  const total = h * 60 + min
  return total > 0 ? total : null
}

function mapBusiness(b: GraphBookingBusiness): BookingsBusinessRow {
  return {
    id: b.id,
    displayName: (b.displayName ?? '').trim() || b.id,
    email: b.email?.trim() || null,
    phone: b.phone?.trim() || null,
    webSiteUrl: b.webSiteUrl?.trim() || null,
    publicUrl: b.publicUrl?.trim() || null,
    isPublished: typeof b.isPublished === 'boolean' ? b.isPublished : null
  }
}

function mapStaffMember(s: GraphBookingStaffMember): BookingsStaffMemberRow {
  return {
    id: s.id,
    displayName: (s.displayName ?? '').trim() || s.id,
    emailAddress: s.emailAddress?.trim() || null,
    role: s.role?.trim() || null
  }
}

function mapService(s: GraphBookingService): BookingsServiceRow {
  return {
    id: s.id,
    displayName: (s.displayName ?? '').trim() || s.id,
    defaultDurationMinutes: parseDurationMinutes(s.defaultDuration),
    defaultPrice: typeof s.defaultPrice === 'number' ? s.defaultPrice : null,
    isHiddenFromCustomers: Boolean(s.isHiddenFromCustomers),
    bookingWebUrl: s.webUrl?.trim() || null
  }
}

function mapAppointment(a: GraphBookingAppointment): BookingsAppointmentRow | null {
  const startIso = isoFromGraphDt(a.start ?? a.startDateTime)
  const endIso = isoFromGraphDt(a.end ?? a.endDateTime)
  if (!startIso || !endIso) return null
  return {
    id: a.id,
    startIso,
    endIso,
    customerName: a.customerName?.trim() || null,
    customerEmail: a.customerEmailAddress?.trim() || null,
    serviceName: a.serviceName?.trim() || null,
    staffMemberIds: Array.isArray(a.staffMemberIds) ? a.staffMemberIds : [],
    isCancelled: Boolean(a.isCancelled)
  }
}

async function listBookingBusinessesFromGraph(
  client: ReturnType<typeof createGraphClient>
): Promise<GraphBookingBusiness[]> {
  const withSelect =
    '/solutions/bookingBusinesses?$select=id,displayName,email,phone,webSiteUrl,publicUrl,isPublished&$top=100'
  try {
    return await paginateGraph<GraphBookingBusiness>(client, withSelect)
  } catch (e) {
    if (readGraphStatusCode(e) === 400) {
      return paginateGraph<GraphBookingBusiness>(client, '/solutions/bookingBusinesses?$top=100')
    }
    throw e
  }
}

export async function graphGetBookingBusiness(
  accountId: string,
  businessId: string
): Promise<BookingsBusinessDetail> {
  const client = await getClientFor(accountId)
  const id = normalizeBookingBusinessId(businessId)
  const paths = [
    `/solutions/bookingBusinesses/${id}?$select=id,displayName,email,phone,webSiteUrl,publicUrl,isPublished`,
    `/solutions/bookingBusinesses/${encodeURIComponent(id)}?$select=id,displayName,email,phone,webSiteUrl,publicUrl,isPublished`
  ]
  let raw: GraphBookingBusiness | null = null
  for (const path of paths) {
    try {
      raw = (await client.api(path).get()) as GraphBookingBusiness
      break
    } catch (e) {
      if (readGraphStatusCode(e) !== 404) throw e
    }
  }
  if (!raw) {
    throw new Error('Buchungsseite nicht gefunden.')
  }
  const base = mapBusiness(raw)
  let services: BookingsServiceRow[] = []
  try {
    services = await graphListBookingServices(accountId, businessId)
  } catch {
    services = []
  }
  const resolved = resolveBookingsPublicUrl({
    publicUrl: base.publicUrl,
    businessId: base.id,
    serviceWebUrls: services.map((s) => s.bookingWebUrl)
  })
  return {
    ...base,
    resolvedPublicUrl: resolved.url,
    resolvedPublicUrlSource: resolved.source
  }
}

export async function graphListBookingBusinesses(accountId: string): Promise<BookingsBusinessRow[]> {
  try {
    const client = await getClientFor(accountId)
    const rows = await listBookingBusinessesFromGraph(client)
    return rows.map(mapBusiness).sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
  } catch (e) {
    console.error('[bookings-graph] listBookingBusinesses', e)
    throw new Error(
      formatGraphErrorMessage(e, 'Bookings-Unternehmen konnten nicht geladen werden.')
    )
  }
}

async function paginateBookingBusinessSubresource<T>(
  client: ReturnType<typeof createGraphClient>,
  businessId: string,
  suffixWithQuery: string
): Promise<T[]> {
  const id = normalizeBookingBusinessId(businessId)
  const pathVariants = [
    `/solutions/bookingBusinesses/${id}/${suffixWithQuery}`,
    `/solutions/bookingBusinesses/${encodeURIComponent(id)}/${suffixWithQuery}`
  ]
  let lastErr: unknown
  for (const path of pathVariants) {
    try {
      return await paginateGraph<T>(client, path)
    } catch (e) {
      lastErr = e
      if (readGraphStatusCode(e) !== 404) throw e
    }
  }
  throw lastErr
}

function filterAppointmentsInRange(
  rows: BookingsAppointmentRow[],
  startIso: string,
  endIso: string
): BookingsAppointmentRow[] {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return rows
  return rows.filter((r) => {
    const s = Date.parse(r.startIso)
    return Number.isFinite(s) && s >= startMs && s < endMs
  })
}

export async function graphListBookingStaffMembers(
  accountId: string,
  businessId: string
): Promise<BookingsStaffMemberRow[]> {
  try {
    const client = await getClientFor(accountId)
    let rows: GraphBookingStaffMember[]
    try {
      rows = await paginateBookingBusinessSubresource<GraphBookingStaffMember>(
        client,
        businessId,
        'staffMembers?$select=id,displayName,emailAddress,role&$top=100'
      )
    } catch (e) {
      if (readGraphStatusCode(e) === 404) {
        return []
      }
      if (readGraphStatusCode(e) === 400) {
        rows = await paginateBookingBusinessSubresource<GraphBookingStaffMember>(
          client,
          businessId,
          'staffMembers?$top=100'
        )
      } else {
        throw e
      }
    }
    return rows.map(mapStaffMember).sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
  } catch (e) {
    console.error('[bookings-graph] listBookingStaffMembers', businessId, e)
    throw new Error(formatGraphErrorMessage(e, 'Bookings-Mitarbeiter konnten nicht geladen werden.'))
  }
}

export async function graphListBookingServices(
  accountId: string,
  businessId: string
): Promise<BookingsServiceRow[]> {
  try {
    const client = await getClientFor(accountId)
    let rows: GraphBookingService[]
    try {
      rows = await paginateBookingBusinessSubresource<GraphBookingService>(
        client,
        businessId,
        'services?$select=id,displayName,defaultDuration,defaultPrice,isHiddenFromCustomers,webUrl&$top=100'
      )
    } catch (e) {
      if (readGraphStatusCode(e) === 404) {
        return []
      }
      if (readGraphStatusCode(e) === 400) {
        rows = await paginateBookingBusinessSubresource<GraphBookingService>(
          client,
          businessId,
          'services?$top=100'
        )
      } else {
        throw e
      }
    }
    return rows.map(mapService).sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
  } catch (e) {
    console.error('[bookings-graph] listBookingServices', businessId, e)
    throw new Error(formatGraphErrorMessage(e, 'Bookings-Leistungen konnten nicht geladen werden.'))
  }
}

export async function graphListBookingAppointments(
  accountId: string,
  businessId: string,
  startIso: string,
  endIso: string
): Promise<BookingsAppointmentRow[]> {
  try {
    const client = await getClientFor(accountId)
    const range = graphCalendarViewRangeParams(startIso, endIso)
    let rows: GraphBookingAppointment[] = []
    try {
      rows = await paginateBookingBusinessSubresource<GraphBookingAppointment>(
        client,
        businessId,
        `calendarView${range}`
      )
    } catch (e) {
      if (readGraphStatusCode(e) !== 404) throw e
      console.warn('[bookings-graph] calendarView 404, fallback appointments list', businessId)
      rows = await paginateBookingBusinessSubresource<GraphBookingAppointment>(
        client,
        businessId,
        'appointments?$top=200'
      )
    }
    const mapped = rows
      .map(mapAppointment)
      .filter((r): r is BookingsAppointmentRow => r != null)
      .filter((r) => !r.isCancelled)
    return filterAppointmentsInRange(mapped, startIso, endIso).sort((a, b) =>
      a.startIso.localeCompare(b.startIso)
    )
  } catch (e) {
    if (readGraphStatusCode(e) === 404) {
      console.warn('[bookings-graph] listBookingAppointments 404', businessId)
      return []
    }
    console.error('[bookings-graph] listBookingAppointments', businessId, e)
    throw new Error(formatGraphErrorMessage(e, 'Bookings-Termine konnten nicht geladen werden.'))
  }
}
