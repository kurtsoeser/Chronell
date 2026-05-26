import type { EventContentArg } from '@fullcalendar/core'
import type { CalendarEventView, TaskItemRow, UserNoteListItem } from '@shared/types'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import { QUICK_CREATE_PLACEHOLDER_EVENT_ID } from '@/app/calendar/calendar-quick-create-placeholder'
import { CALENDAR_KIND_CLOUD_TASK } from '@/app/calendar/cloud-task-calendar'
import { CALENDAR_KIND_MAIL_TODO } from '@/app/calendar/mail-todo-calendar'
import { CALENDAR_KIND_USER_NOTE } from '@/app/calendar/notes-calendar'
import {
  formatFcEventTimeRangeText,
  isDayGridMonthFcView
} from '@/app/calendar/calendar-fc-event-time-range'
import { isMultiMonthFcView, multiMonthFcEventContent } from '@/app/calendar/calendar-fc-multimonth'
import { appendCalendarEventIconSvg } from '@/lib/calendar-event-icon-markup'
import { calendarEventIconIsExplicit } from '@/lib/calendar-event-icons'

const DAY_GRID_MONTH_ICON_PX = 11

export type CalendarFcEntryKind = 'appointment' | 'mail' | 'task' | 'note'

export type CalendarFcEventContentLabels = {
  appointment: string
  mail: string
  task: string
  note: string
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Lucide-ähnliche Pfade (24×24). */
const KIND_ICON_PATH: Record<CalendarFcEntryKind, string> = {
  appointment:
    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 2-8 5.7a2 2 0 0 1-2.1 0L4 6',
  task: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  note: 'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5zM5 21V5h10v6h6v10H5z'
}

export function resolveCalendarFcEntryKind(arg: EventContentArg): CalendarFcEntryKind {
  const kind = arg.event.extendedProps.calendarKind as string | undefined
  if (kind === CALENDAR_KIND_MAIL_TODO) return 'mail'
  if (kind === CALENDAR_KIND_CLOUD_TASK) return 'task'
  if (kind === CALENDAR_KIND_USER_NOTE) return 'note'
  return 'appointment'
}

function createKindIcon(
  kind: CalendarFcEntryKind,
  label: string,
  className = 'fc-cal-event-kind-icon'
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('class', className)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', label)
  svg.setAttribute('focusable', 'false')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', KIND_ICON_PATH[kind])
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(path)
  return svg
}

/** Einheitlicher Event-Inhalt: Zeit, Titel, Art-Icon rechts oben. */
export function calendarFcEventContent(
  arg: EventContentArg,
  labels: CalendarFcEventContentLabels
): { domNodes: Node[] } {
  if (arg.event.id === QUICK_CREATE_PLACEHOLDER_EVENT_ID || arg.isMirror) {
    return { domNodes: [] }
  }
  if (isMultiMonthFcView(arg.view.type)) {
    return multiMonthFcEventContent(arg)
  }
  const entryKind = resolveCalendarFcEntryKind(arg)
  const cloudTask = arg.event.extendedProps.cloudTask as TaskItemRow | undefined
  const taskCompleted = entryKind === 'task' && cloudTask?.completed === true
  const monthLayout = isDayGridMonthFcView(arg.view.type)

  const root = document.createElement('div')
  root.className = taskCompleted
    ? 'fc-cal-event-custom fc-cal-event-custom--completed'
    : 'fc-cal-event-custom'
  if (monthLayout) {
    root.classList.add('fc-cal-event-custom--month')
  }

  const body = document.createElement('div')
  body.className = 'fc-cal-event-custom-body'

  const timeLabel = monthLayout
    ? formatFcEventTimeRangeText(arg)
    : arg.timeText?.trim() || null
  if (timeLabel) {
    const timeEl = document.createElement('div')
    timeEl.className = taskCompleted
      ? 'fc-cal-event-custom-time fc-cal-event-custom-time--completed'
      : 'fc-cal-event-custom-time'
    timeEl.textContent = timeLabel
    body.appendChild(timeEl)
  }

  const titleEl = document.createElement('div')
  titleEl.className = taskCompleted
    ? 'fc-cal-event-custom-title fc-cal-event-custom-title--completed'
    : 'fc-cal-event-custom-title'
  titleEl.textContent = arg.event.title ?? ''

  const titleRow = document.createElement('div')
  titleRow.className = 'fc-cal-event-custom-title-row'
  const iconHost = monthLayout ? titleRow : root
  const iconClass = monthLayout
    ? 'fc-cal-event-kind-icon fc-cal-event-kind-icon--inline'
    : 'fc-cal-event-kind-icon'

  const calEv = arg.event.extendedProps.calendarEvent as CalendarEventView | undefined
  const userNote = arg.event.extendedProps.userNote as UserNoteListItem | undefined
  const eventIconId = calEv?.icon
  const taskIconId = cloudTask?.iconId
  const taskIconColor = resolveEntityIconColor(cloudTask?.iconColor)
  const noteIconId = userNote?.iconId
  const noteIconColor = resolveEntityIconColor(userNote?.iconColor)
  const iconSize = monthLayout ? DAY_GRID_MONTH_ICON_PX : 14
  if (calendarEventIconIsExplicit(eventIconId)) {
    appendCalendarEventIconSvg(iconHost, eventIconId, iconClass, undefined, iconSize)
  } else if (entryKind === 'task' && calendarEventIconIsExplicit(taskIconId)) {
    appendCalendarEventIconSvg(iconHost, taskIconId, iconClass, taskIconColor, iconSize)
  } else if (entryKind === 'note' && calendarEventIconIsExplicit(noteIconId)) {
    appendCalendarEventIconSvg(iconHost, noteIconId, iconClass, noteIconColor, iconSize)
  } else {
    iconHost.appendChild(createKindIcon(entryKind, labels[entryKind], iconClass))
  }

  titleRow.appendChild(titleEl)
  body.appendChild(monthLayout ? titleRow : titleEl)
  root.appendChild(body)

  return { domNodes: [root] }
}
