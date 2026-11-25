/**
 * HTTP-Client für lokales #kurtrocks Events OS Studio (Vite/API Proxy).
 * Port analog chronell-writeback: 127.0.0.1:7733
 */
import type {
  EventsOsEventHit,
  EventsOsInboxKind,
  EventsOsSearchResult,
  EventsOsSendMailResult,
  EventsOsWebinarPrefill,
  EventsOsCalendarDraftInput,
  EventsOsCalendarDraftResult,
  EventsOsWritebackInput
} from '../../shared/types/events-os'

export const EVENTS_OS_STUDIO_BASE =
  process.env.CHRONELL_EVENTS_OS_URL?.trim() || 'http://127.0.0.1:7733'

async function studioFetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${EVENTS_OS_STUDIO_BASE}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {})
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Events OS Studio nicht erreichbar (${EVENTS_OS_STUDIO_BASE}). Bitte Studio starten (npm run dev im Ordner studio).\n${msg}`
    )
  }
  const text = await res.text()
  let data: unknown = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text.slice(0, 400) }
  }
  if (!res.ok) {
    const errObj = data as { error?: string }
    throw new Error(
      errObj.error || `Events OS HTTP ${res.status}: ${text.slice(0, 400)}`
    )
  }
  return data as T
}

export async function fetchEventsOsWebinarPrefill(
  eventId: string
): Promise<EventsOsWebinarPrefill> {
  const id = encodeURIComponent(String(eventId || '').trim())
  return studioFetchJson<EventsOsWebinarPrefill>(
    `/api/chronell/webinar-prefill?eventId=${id}`
  )
}

export async function postCalendarDraftToEventsOs(
  input: EventsOsCalendarDraftInput
): Promise<EventsOsCalendarDraftResult> {
  return studioFetchJson<EventsOsCalendarDraftResult>('/api/calendar-event-draft', {
    method: 'POST',
    body: JSON.stringify({
      graphEventId: input.graphEventId,
      subject: input.subject,
      startIso: input.startIso,
      endIso: input.endIso,
      isAllDay: Boolean(input.isAllDay),
      joinUrl: input.joinUrl || undefined,
      webLink: input.webLink || undefined,
      location: input.location || undefined,
      categories: input.categories || [],
      lifecycleStatus: 'terminabstimmung'
    })
  })
}

export async function postEventsOsWriteback(
  input: EventsOsWritebackInput
): Promise<{ ok: boolean; error?: string }> {
  return studioFetchJson('/api/chronell-writeback', {
    method: 'POST',
    body: JSON.stringify({
      eventId: input.eventId,
      meetingUrl: input.meetingUrl || undefined,
      surveyUrl: input.surveyUrl || undefined,
      graphEventId: input.graphEventId || undefined
    })
  })
}

export async function searchEventsOsEvents(
  query: string,
  limit = 25
): Promise<EventsOsSearchResult> {
  const q = encodeURIComponent(String(query || '').trim())
  const lim = encodeURIComponent(String(Math.min(Math.max(limit, 1), 50)))
  return studioFetchJson<EventsOsSearchResult>(
    `/api/chronell/events?q=${q}&limit=${lim}`
  )
}

export type StudioFromChronellAttachment = {
  fileName?: string
  mimeType?: string
  contentBase64: string
}

export type StudioFromChronellPayload = {
  eventId: string
  kind?: EventsOsInboxKind
  subject?: string
  body?: string
  from?: string
  to?: string
  messageId?: string
  receivedAt?: string | null
  title?: string
  personName?: string
  personEmail?: string
  attachments?: StudioFromChronellAttachment[]
}

export async function postMailToEventsOs(
  payload: StudioFromChronellPayload
): Promise<EventsOsSendMailResult> {
  return studioFetchJson<EventsOsSendMailResult>(
    '/api/event-inbox/from-chronell',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  )
}

export function formatEventsOsHitLabel(hit: EventsOsEventHit): string {
  const date = hit.date
    ? new Date(hit.date).toLocaleDateString('de-AT', { dateStyle: 'medium' })
    : ''
  const cats = hit.category?.length ? hit.category.join(', ') : ''
  return [hit.title, date, cats].filter(Boolean).join(' · ')
}
