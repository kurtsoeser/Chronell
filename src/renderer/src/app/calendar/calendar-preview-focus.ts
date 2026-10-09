import type { EventApi } from '@fullcalendar/core'
import type { CalendarEventView, MailListItem } from '@shared/types'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import {
  calendarEventStableKey,
  cloudTaskStableKey,
  mailTodoStableKey
} from '@shared/work-item-keys'
import { CALENDAR_KIND_CLOUD_TASK } from '@/app/calendar/cloud-task-calendar'
import { CALENDAR_KIND_MAIL_TODO } from '@/app/calendar/mail-todo-calendar'

export function previewStableKeyFromCalendarEvent(ev: CalendarEventView): string {
  return calendarEventStableKey(
    ev.accountId,
    ev.graphCalendarId,
    (ev.graphEventId ?? ev.id).trim()
  )
}

export function previewStableKeyFromCloudTask(task: CloudTaskListItem): string {
  return cloudTaskStableKey(task.accountId, task.listId, task.id)
}

export function previewStableKeyFromMailMessageId(messageId: number): string {
  return mailTodoStableKey(messageId)
}

/** Stabiler Zeitlisten-Schlüssel für ein FullCalendar-Event (Vorschau-Fokus). */
export function previewStableKeyFromFcEvent(event: EventApi): string | null {
  const kind = event.extendedProps.calendarKind as string | undefined
  if (kind === CALENDAR_KIND_MAIL_TODO) {
    const m = event.extendedProps.mailMessage as MailListItem | undefined
    return m ? mailTodoStableKey(m.id) : null
  }
  if (kind === CALENDAR_KIND_CLOUD_TASK) {
    const task = event.extendedProps.cloudTask as CloudTaskListItem | undefined
    return task ? cloudTaskStableKey(task.accountId, task.listId, task.id) : null
  }
  const ev = event.extendedProps.calendarEvent as CalendarEventView | undefined
  if (ev) return previewStableKeyFromCalendarEvent(ev)
  return null
}
