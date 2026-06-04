import type { EventInput } from '@fullcalendar/core'
import type { CalendarEventView } from '@shared/types'
import { resolveGraphEventDisplayHex } from '@/lib/calendar-event-display-hex'

function isGraphEventEditable(ev: CalendarEventView): boolean {
  return Boolean(
    ev.graphEventId &&
      ev.calendarCanEdit !== false &&
      (ev.source === 'microsoft' || ev.source === 'google')
  )
}

/** Graph-Termine → FullCalendar-Events (Farben wie im Kalender-Modul). */
export function graphCalendarEventsToFcInputs(
  events: readonly CalendarEventView[],
  defaultGraphCalendarIdByAccount: Record<string, string | null>,
  calendarDisplayHexByKey: Record<string, Record<string, string | null>>,
  opts?: { editable?: boolean }
): EventInput[] {
  const allowEdit = opts?.editable ?? false
  return events.map((ev) => {
    const resolvedDisplayHex = resolveGraphEventDisplayHex(
      ev,
      defaultGraphCalendarIdByAccount,
      calendarDisplayHexByKey
    )
    const canEdit = allowEdit && isGraphEventEditable(ev)
    return {
      id: ev.id,
      title: ev.title,
      start: ev.startIso,
      end: ev.endIso,
      allDay: ev.isAllDay,
      url: ev.joinUrl ?? ev.webLink ?? undefined,
      extendedProps: {
        accountColor: ev.accountColorClass,
        displayColorHex: resolvedDisplayHex,
        joinUrl: ev.joinUrl,
        calendarEvent: ev
      },
      editable: canEdit,
      startEditable: canEdit,
      durationEditable: canEdit
    }
  })
}
