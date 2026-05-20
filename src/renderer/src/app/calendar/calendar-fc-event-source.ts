import type { CalendarApi } from '@fullcalendar/core'
import type { CalendarEventView, MailListItem } from '@shared/types'
import { CALENDAR_KIND_MAIL_TODO } from '@/app/calendar/mail-todo-calendar'

function eventMatchesGraphCalendarEvent(
  event: { id: string; extendedProps: Record<string, unknown> },
  accountId: string,
  graphEventId: string
): boolean {
  const cal = event.extendedProps?.calendarEvent as CalendarEventView | undefined
  if (cal?.accountId === accountId && cal.graphEventId?.trim() === graphEventId) return true
  return event.id === `${accountId}:${graphEventId}`
}

function eventStartIso(event: { start: Date | null; allDay: boolean }): string | null {
  const start = event.start
  if (!start) return null
  if (event.allDay) {
    const y = start.getFullYear()
    const m = String(start.getMonth() + 1).padStart(2, '0')
    const d = String(start.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return start.toISOString()
}

function pickGraphCalendarEventToKeep(
  matches: Array<{ id: string; allDay: boolean; start: Date | null }>,
  keepEventId?: string,
  expectedStartIso?: string
): (typeof matches)[number] | undefined {
  if (keepEventId) {
    const withId = matches.filter((e) => e.id === keepEventId)
    if (expectedStartIso) {
      const atNewTime = withId.find((e) => eventStartIso(e) === expectedStartIso)
      if (atNewTime) return atNewTime
    }
    const timed = withId.filter((e) => !e.allDay)
    return timed[timed.length - 1] ?? withId[withId.length - 1]
  }
  const timed = matches.filter((e) => !e.allDay)
  return timed[timed.length - 1] ?? matches[matches.length - 1]
}

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

/**
 * Entfernt alle Kalender-Einträge eines Graph-Termins (Drag-Kopie + veraltete Quelle).
 * `keepEventId` bleibt als einziges Event erhalten, bevorzugt mit `expectedStartIso`.
 */
export function removeGraphCalendarEventsByGraphEventId(
  api: CalendarApi,
  accountId: string,
  graphEventId: string,
  keepEventId?: string,
  expectedStartIso?: string
): void {
  const gid = graphEventId.trim()
  if (!gid) return
  const matches = api.getEvents().filter((e) => eventMatchesGraphCalendarEvent(e, accountId, gid))
  if (matches.length === 0) return

  const keep = pickGraphCalendarEventToKeep(matches, keepEventId, expectedStartIso)
  if (!keep) return

  for (const ev of matches) {
    if (ev !== keep) ev.remove()
  }
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
    const timed = matches.filter((e) => !e.allDay)
    const keep = timed[timed.length - 1] ?? matches[matches.length - 1]
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

export function scheduleRemoveGraphCalendarEventsByGraphEventId(
  api: CalendarApi | null | undefined,
  accountId: string,
  graphEventId: string,
  keepEventId?: string,
  expectedStartIso?: string
): void {
  if (!api || !graphEventId.trim()) return
  const run = (): void =>
    removeGraphCalendarEventsByGraphEventId(
      api,
      accountId,
      graphEventId,
      keepEventId,
      expectedStartIso
    )
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
