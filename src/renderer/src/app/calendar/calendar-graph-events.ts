import type { CalendarApi } from '@fullcalendar/core'
import type { CalendarEventView } from '@shared/types'
import {
  removeDuplicateFullCalendarEventsById,
  removeGraphCalendarEventsByGraphEventId
} from '@/app/calendar/calendar-fc-event-source'

export function deduplicateCalendarEventsByGraphEventId(
  events: readonly CalendarEventView[]
): CalendarEventView[] {
  const map = new Map<string, CalendarEventView>()
  for (const ev of events) {
    const graphEventId = ev.graphEventId?.trim()
    const key = graphEventId ? `${ev.accountId}\u001f${graphEventId}` : ev.id
    map.set(key, ev)
  }
  return [...map.values()]
}

/** Entfernt FC-Duplikate (gleiche id oder gleicher Graph-Termin). */
export function purgeDuplicateGraphCalendarEventsOnApi(
  api: CalendarApi | null | undefined
): void {
  if (!api) return

  const dupIds: string[] = []
  const idCounts = new Map<string, number>()
  for (const ev of api.getEvents()) {
    if (!ev.id) continue
    idCounts.set(ev.id, (idCounts.get(ev.id) ?? 0) + 1)
  }
  for (const [id, count] of idCounts) {
    if (count > 1) dupIds.push(id)
  }
  if (dupIds.length > 0) {
    removeDuplicateFullCalendarEventsById(api, dupIds)
  }

  const byGraph = new Map<string, ReturnType<CalendarApi['getEvents']>>()
  for (const ev of api.getEvents()) {
    const cal = ev.extendedProps?.calendarEvent as CalendarEventView | undefined
    const graphEventId = cal?.graphEventId?.trim()
    if (!graphEventId || !cal?.accountId) continue
    const key = `${cal.accountId}\u001f${graphEventId}`
    const list = byGraph.get(key) ?? []
    list.push(ev)
    byGraph.set(key, list)
  }

  for (const [key, matches] of byGraph) {
    if (matches.length <= 1) continue
    const sep = key.indexOf('\u001f')
    const accountId = key.slice(0, sep)
    const graphEventId = key.slice(sep + 1)
    const keep = matches[matches.length - 1]
    removeGraphCalendarEventsByGraphEventId(
      api,
      accountId,
      graphEventId,
      keep?.id,
      calStartIso(keep)
    )
  }
}

function calStartIso(
  event: { start: Date | null; allDay: boolean } | undefined
): string | undefined {
  if (!event?.start) return undefined
  if (event.allDay) {
    const y = event.start.getFullYear()
    const m = String(event.start.getMonth() + 1).padStart(2, '0')
    const d = String(event.start.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return event.start.toISOString()
}
