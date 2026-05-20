import type { CalendarApi } from '@fullcalendar/core'
import type { CalendarEventView } from '@shared/types'
import {
  removeDuplicateFullCalendarEventsById,
  removeGraphCalendarEventsByGraphEventId,
  scheduleRemoveDuplicateFullCalendarEventsById,
  scheduleRemoveGraphCalendarEventsByGraphEventId
} from '@/app/calendar/calendar-fc-event-source'

/** Gleicht den sichtbaren FC-Termin nach Drag/Resize mit Graph-Kalenderdaten ab. */
export function syncFullCalendarGraphEventFromLayer(
  api: CalendarApi | null | undefined,
  ev: CalendarEventView
): void {
  if (!api) return
  const graphEventId = ev.graphEventId?.trim()
  if (!graphEventId) return

  const eventId = ev.id
  removeGraphCalendarEventsByGraphEventId(api, ev.accountId, graphEventId, eventId, ev.startIso)

  const existing = api.getEventById(eventId)
  if (!existing) return

  existing.setAllDay(ev.isAllDay)
  existing.setDates(ev.startIso, ev.endIso, { allDay: ev.isAllDay })
  existing.setExtendedProp('calendarEvent', ev)
}

/** Entfernt FC-Duplikate sofort und nochmals nach dem React-Commit. */
export function reconcileGraphCalendarEventOnCalendar(
  api: CalendarApi | null | undefined,
  ev: CalendarEventView
): void {
  if (!api) return
  const graphEventId = ev.graphEventId?.trim()
  if (!graphEventId) return
  syncFullCalendarGraphEventFromLayer(api, ev)
  removeGraphCalendarEventsByGraphEventId(api, ev.accountId, graphEventId, ev.id, ev.startIso)
  removeDuplicateFullCalendarEventsById(api, [ev.id])
  scheduleRemoveGraphCalendarEventsByGraphEventId(
    api,
    ev.accountId,
    graphEventId,
    ev.id,
    ev.startIso
  )
  scheduleRemoveDuplicateFullCalendarEventsById(api, [ev.id])
}
