import type { CalendarApi } from '@fullcalendar/core'
import type { MailListItem } from '@shared/types'
import { removeMailTodoCalendarEventsByMessageId } from '@/app/calendar/calendar-fc-event-source'
import {
  mailTodoFullCalendarEventId,
  mailTodoItemsToFullCalendarEvents
} from '@/app/calendar/mail-todo-calendar'

export function applyOptimisticMailTodoScheduleToItems(
  items: readonly MailListItem[],
  messageId: number,
  range: { startIso: string; endIso: string }
): MailListItem[] {
  return items.map((item) =>
    item.id === messageId
      ? {
          ...item,
          todoStartAt: range.startIso,
          todoEndAt: range.endIso,
          todoDueAt: range.endIso
        }
      : item
  )
}

/** Gleicht den sichtbaren FC-Termin nach Drag/Resize mit Mail-ToDo-Daten ab (inkl. Ganztag → Uhrzeit). */
export function syncFullCalendarMailTodoEventFromLayer(
  api: CalendarApi | null | undefined,
  mail: MailListItem,
  accountColorById: Record<string, string>
): void {
  if (!api) return
  const eventId = mailTodoFullCalendarEventId(mail)
  const inputs = mailTodoItemsToFullCalendarEvents([mail], accountColorById)
  const input = inputs[0]

  if (!input) {
    removeMailTodoCalendarEventsByMessageId(api, mail.id)
    return
  }

  removeMailTodoCalendarEventsByMessageId(api, mail.id, eventId)

  const existing = api.getEventById(eventId)
  if (!existing) return

  const allDay = Boolean(input.allDay)
  const start = typeof input.start === 'string' ? input.start : String(input.start)
  const end =
    input.end == null
      ? start
      : typeof input.end === 'string'
        ? input.end
        : String(input.end)

  existing.setAllDay(allDay)
  existing.setDates(start, end, { allDay })
  existing.setExtendedProp('mailMessage', mail)
}
