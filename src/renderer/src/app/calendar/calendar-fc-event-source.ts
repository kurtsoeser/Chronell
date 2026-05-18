import type { CalendarApi } from '@fullcalendar/core'
import type { MailListItem } from '@shared/types'
import { CALENDAR_KIND_MAIL_TODO } from '@/app/calendar/mail-todo-calendar'

function eventMatchesTaskKey(
  event: { id: string; extendedProps: Record<string, unknown> },
  taskKey: string
): boolean {
  return event.extendedProps?.taskKey === taskKey
}

function eventMatchesMailTodoMessage(
  event: { extendedProps: Record<string, unknown> },
  messageId: number
): boolean {
  if (event.extendedProps?.calendarKind !== CALENDAR_KIND_MAIL_TODO) return false
  const msg = event.extendedProps?.mailMessage as MailListItem | undefined
  return msg?.id === messageId
}

/** Entfernt FullCalendar-Duplikate nach Drag/Resize (gleiche öffentliche Event-ID). */
export function removeDuplicateFullCalendarEventsById(
  api: CalendarApi,
  eventIds: readonly string[]
): void {
  for (const id of eventIds) {
    if (!id) continue
    const matches = api.getEvents().filter((e) => e.id === id)
    if (matches.length <= 1) continue
    const keep = matches.find((e) => !e.allDay) ?? matches[0]
    for (const ev of matches) {
      if (ev !== keep) ev.remove()
    }
  }
}

/**
 * Entfernt alle Kalender-Einträge einer Mail-ToDo-Message (z. B. Ganztags-Rest + Zeitslot nach Drag).
 * `keepEventId` bleibt erhalten; bevorzugt ein zeitgebundenes Event gegenüber Ganztag.
 */
export function removeMailTodoCalendarEventsByMessageId(
  api: CalendarApi,
  messageId: number,
  keepEventId?: string
): void {
  if (messageId <= 0) return
  const matches = api.getEvents().filter((e) => eventMatchesMailTodoMessage(e, messageId))
  if (matches.length === 0) return

  let keep: (typeof matches)[number] | undefined
  if (keepEventId) {
    const withId = matches.filter((e) => e.id === keepEventId)
    keep = withId.find((e) => !e.allDay) ?? withId[0]
  }
  if (!keep) keep = matches.find((e) => !e.allDay) ?? matches[matches.length - 1]

  for (const ev of matches) {
    if (ev !== keep) ev.remove()
  }
}

/**
 * Entfernt alle Kalender-Einträge einer Cloud-Aufgabe (Drag-Kopie + veraltete Quelle).
 * `keepEventId` bleibt als einziges Event erhalten, falls vorhanden.
 */
export function removeCloudTaskCalendarEventsByTaskKey(
  api: CalendarApi,
  taskKey: string,
  keepEventId?: string
): void {
  if (!taskKey.trim()) return
  const matches = api
    .getEvents()
    .filter((e) => e.id === keepEventId || eventMatchesTaskKey(e, taskKey))
  if (matches.length === 0) return

  let keep = keepEventId ? matches.find((e) => e.id === keepEventId) : undefined
  if (!keep) keep = matches[0]

  for (const ev of matches) {
    if (ev !== keep) ev.remove()
  }
}

/**
 * Entfernt Duplikate nach React-Commit (z. B. wenn zuvor `revert()` + neues `eventSources`).
 * Nur als Fallback — bei Erfolg kein `info.revert()` verwenden.
 */
export function scheduleRemoveDuplicateFullCalendarEventsById(
  api: CalendarApi | null | undefined,
  eventIds: readonly string[]
): void {
  if (!api || eventIds.length === 0) return
  const run = (): void => removeDuplicateFullCalendarEventsById(api, eventIds)
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}

export function scheduleRemoveCloudTaskCalendarEventsByTaskKey(
  api: CalendarApi | null | undefined,
  taskKey: string,
  keepEventId?: string
): void {
  if (!api || !taskKey.trim()) return
  const run = (): void => removeCloudTaskCalendarEventsByTaskKey(api, taskKey, keepEventId)
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}

export function scheduleRemoveMailTodoCalendarEventsByMessageId(
  api: CalendarApi | null | undefined,
  messageId: number,
  keepEventId?: string
): void {
  if (!api || messageId <= 0) return
  const run = (): void => removeMailTodoCalendarEventsByMessageId(api, messageId, keepEventId)
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}
