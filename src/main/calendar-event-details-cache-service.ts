import type { CalendarGetEventInput, CalendarGetEventResult } from '@shared/types'
import { getCalendarEventForAccount } from './calendar-service'
import {
  deleteCalendarEventDetails,
  getCalendarEventDetailsFromCache,
  isCalendarEventDetailsFresh,
  upsertCalendarEventDetails
} from './db/calendar-event-details-repo'
import { isAppOnline } from './network-status'

export const CALENDAR_EVENT_DETAILS_STALE_MS = 24 * 60 * 60_000

const inflightByEventKey = new Map<string, Promise<CalendarGetEventResult>>()

function eventDetailsKey(accountId: string, graphEventId: string): string {
  return `${accountId}\0${graphEventId}`
}

function fetchCalendarEventDetails(
  accountId: string,
  graphEventId: string,
  graphCalendarId: string | null
): Promise<CalendarGetEventResult> {
  const key = eventDetailsKey(accountId, graphEventId)
  const existing = inflightByEventKey.get(key)
  if (existing) return existing

  const pending = getCalendarEventForAccount({
    accountId,
    graphEventId,
    graphCalendarId
  })
    .then((detail) => {
      upsertCalendarEventDetails(accountId, graphEventId, graphCalendarId, detail)
      return detail
    })
    .finally(() => {
      if (inflightByEventKey.get(key) === pending) {
        inflightByEventKey.delete(key)
      }
    })

  inflightByEventKey.set(key, pending)
  return pending
}

export async function getCalendarEventCached(
  input: CalendarGetEventInput,
  opts?: { forceRefresh?: boolean }
): Promise<CalendarGetEventResult> {
  const accountId = input.accountId.trim()
  const graphEventId = input.graphEventId.trim()
  const graphCalendarId = input.graphCalendarId?.trim() || null
  const force = opts?.forceRefresh === true

  const cached = getCalendarEventDetailsFromCache(accountId, graphEventId)
  const fresh = isCalendarEventDetailsFresh(accountId, graphEventId, CALENDAR_EVENT_DETAILS_STALE_MS)

  if (!force && cached && fresh) {
    // Auch bei „frischem“ Cache im Hintergrund gegen Graph/Google abgleichen —
    // sonst bleiben z. B. in Outlook ergaenzte Teilnehmer bis zu 24h unsichtbar.
    if (isAppOnline()) {
      void fetchCalendarEventDetails(accountId, graphEventId, graphCalendarId).catch((e) =>
        console.warn('[calendar-event-details] Hintergrund-Refresh:', graphEventId, e)
      )
    }
    return cached
  }

  if (!force && cached && !fresh && isAppOnline()) {
    void fetchCalendarEventDetails(accountId, graphEventId, graphCalendarId).catch((e) =>
      console.warn('[calendar-event-details] Hintergrund-Refresh:', graphEventId, e)
    )
    return cached
  }

  if (!force && cached && !isAppOnline()) {
    return cached
  }

  return fetchCalendarEventDetails(accountId, graphEventId, graphCalendarId)
}

export { deleteCalendarEventDetails }
