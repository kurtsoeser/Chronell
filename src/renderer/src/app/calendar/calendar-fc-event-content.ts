import type { EventContentArg } from '@fullcalendar/core'
import type { CalendarEventView, TaskItemRow, UserNoteListItem } from '@shared/types'
import { calendarEventSensitivityIsPrivate } from '@shared/calendar-event-status'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import { QUICK_CREATE_PLACEHOLDER_EVENT_ID } from '@/app/calendar/calendar-quick-create-placeholder'
import { CALENDAR_KIND_CLOUD_TASK } from '@/app/calendar/cloud-task-calendar'
import { CALENDAR_KIND_MAIL_TODO } from '@/app/calendar/mail-todo-calendar'
import { CALENDAR_KIND_USER_NOTE } from '@/app/calendar/notes-calendar'
import {
  formatFcEventTimeRangeText,
  isDayGridMonthFcView,
  isTimeGridFcView
} from '@/app/calendar/calendar-fc-event-time-range'
import { isMultiMonthFcView, multiMonthFcEventContent } from '@/app/calendar/calendar-fc-multimonth'
import { appendCalendarEventIconSvg } from '@/lib/calendar-event-icon-markup'
import { calendarEventIconIsExplicit } from '@/lib/calendar-event-icons'

const SVG_NS = 'http://www.w3.org/2000/svg'

const DAY_GRID_MONTH_ICON_PX = 9
const TIME_GRID_ICON_PX = 10

/** Lucide Video-Icon Pfad (24×24) – für Teams-Meeting-Marker */
const TEAMS_VIDEO_PATH =
  'M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z'

/** Lucide Lock-Icon Pfad (24×24) – private Termine */
const PRIVATE_LOCK_PATH =
  'M7 11V7a5 5 0 0 1 10 0v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z'

/** Lucide CircleHelp – Mit Vorbehalt (circle + question paths) */
const TENTATIVE_HELP_PATHS = ['M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01']

/** Lucide ExternalLink – Woanders arbeiten */
const WORKING_ELSEWHERE_PATHS = [
  'M15 3h6v6',
  'M10 14 21 3',
  'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'
]

/** Lucide Repeat2 – Serientermin */
const SERIES_REPEAT_PATHS = [
  'm2 9 3-3 3 3',
  'M13 18H7a2 2 0 0 1-2-2V6',
  'm22 15-3 3-3-3',
  'M11 6h6a2 2 0 0 1 2 2v10'
]

function createStrokeIcon(args: {
  className: string
  ariaLabel: string
  paths: string[]
  circle?: { cx: number; cy: number; r: number }
}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('class', args.className)
  svg.setAttribute('aria-label', args.ariaLabel)
  svg.setAttribute('focusable', 'false')
  if (args.circle) {
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('cx', String(args.circle.cx))
    circle.setAttribute('cy', String(args.circle.cy))
    circle.setAttribute('r', String(args.circle.r))
    circle.setAttribute('fill', 'none')
    circle.setAttribute('stroke', 'currentColor')
    circle.setAttribute('stroke-width', '2')
    svg.appendChild(circle)
  }
  for (const d of args.paths) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '2')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(path)
  }
  return svg
}

function createTeamsIcon(): SVGSVGElement {
  return createStrokeIcon({
    className: 'fc-cal-event-teams-icon',
    ariaLabel: 'Teams Meeting',
    paths: [TEAMS_VIDEO_PATH]
  })
}

function createPrivateLockIcon(): SVGSVGElement {
  return createStrokeIcon({
    className: 'fc-cal-event-private-icon',
    ariaLabel: 'Private',
    paths: [PRIVATE_LOCK_PATH]
  })
}

function createTentativeIcon(): SVGSVGElement {
  return createStrokeIcon({
    className: 'fc-cal-event-tentative-icon',
    ariaLabel: 'Tentative',
    paths: TENTATIVE_HELP_PATHS,
    circle: { cx: 12, cy: 12, r: 10 }
  })
}

function createWorkingElsewhereIcon(): SVGSVGElement {
  return createStrokeIcon({
    className: 'fc-cal-event-elsewhere-icon',
    ariaLabel: 'Working elsewhere',
    paths: WORKING_ELSEWHERE_PATHS
  })
}

function createSeriesIcon(): SVGSVGElement {
  return createStrokeIcon({
    className: 'fc-cal-event-series-icon',
    ariaLabel: 'Recurring',
    paths: SERIES_REPEAT_PATHS
  })
}

export type CalendarFcEntryKind = 'appointment' | 'mail' | 'task' | 'note'

export type CalendarFcEventContentLabels = {
  appointment: string
  mail: string
  task: string
  note: string
}

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

/** Einheitlicher Event-Inhalt: Monat/Woche = Icon vor Uhrzeit (eine Zeile) + Titel darunter. */
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
  const timeGridLayout = isTimeGridFcView(arg.view.type)
  const inlineIconLayout = monthLayout || timeGridLayout

  const calEvForTeams = arg.event.extendedProps.calendarEvent as CalendarEventView | undefined
  const isTeamsMeeting = Boolean(calEvForTeams?.joinUrl)
  const isPrivate = calendarEventSensitivityIsPrivate(calEvForTeams?.sensitivity)
  const isTentative = calEvForTeams?.showAs === 'tentative'
  const isWorkingElsewhere = calEvForTeams?.showAs === 'workingElsewhere'
  const isSeries = calEvForTeams?.isSeries === true

  const root = document.createElement('div')
  root.className = taskCompleted
    ? 'fc-cal-event-custom fc-cal-event-custom--completed'
    : 'fc-cal-event-custom'
  if (monthLayout) root.classList.add('fc-cal-event-custom--month')
  if (timeGridLayout) root.classList.add('fc-cal-event-custom--timegrid')
  if (calEvForTeams?.showAs === 'free') root.classList.add('fc-cal-event-custom--free')
  if (isPrivate) root.classList.add('fc-cal-event-custom--private')
  if (isTentative) root.classList.add('fc-cal-event-custom--tentative')
  if (isWorkingElsewhere) root.classList.add('fc-cal-event-custom--elsewhere')
  if (isSeries) root.classList.add('fc-cal-event-custom--series')

  const body = document.createElement('div')
  body.className = 'fc-cal-event-custom-body'

  const titleEl = document.createElement('div')
  titleEl.className = taskCompleted
    ? 'fc-cal-event-custom-title fc-cal-event-custom-title--completed'
    : 'fc-cal-event-custom-title'

  const statusIcons: SVGSVGElement[] = []
  if (isSeries) statusIcons.push(createSeriesIcon())
  if (isTentative) statusIcons.push(createTentativeIcon())
  if (isWorkingElsewhere) statusIcons.push(createWorkingElsewhereIcon())
  if (isPrivate) statusIcons.push(createPrivateLockIcon())
  if (isTeamsMeeting) statusIcons.push(createTeamsIcon())

  if (statusIcons.length > 0) {
    const titleInner = document.createElement('span')
    titleInner.className = 'fc-cal-event-custom-title-text'
    titleInner.textContent = arg.event.title ?? ''
    titleEl.appendChild(titleInner)
    for (const icon of statusIcons) titleEl.appendChild(icon)
  } else {
    titleEl.textContent = arg.event.title ?? ''
  }

  const iconClass = inlineIconLayout
    ? 'fc-cal-event-kind-icon fc-cal-event-kind-icon--inline'
    : 'fc-cal-event-kind-icon'
  const iconSize = monthLayout ? DAY_GRID_MONTH_ICON_PX : timeGridLayout ? TIME_GRID_ICON_PX : 14

  const appendEntryIcon = (host: HTMLElement): void => {
    const calEv = arg.event.extendedProps.calendarEvent as CalendarEventView | undefined
    const userNote = arg.event.extendedProps.userNote as UserNoteListItem | undefined
    const eventIconId = calEv?.icon
    const taskIconId = cloudTask?.iconId
    const taskIconColor = resolveEntityIconColor(cloudTask?.iconColor)
    const noteIconId = userNote?.iconId
    const noteIconColor = resolveEntityIconColor(userNote?.iconColor)
    if (calendarEventIconIsExplicit(eventIconId)) {
      appendCalendarEventIconSvg(host, eventIconId, iconClass, undefined, iconSize)
    } else if (entryKind === 'task' && calendarEventIconIsExplicit(taskIconId)) {
      appendCalendarEventIconSvg(host, taskIconId, iconClass, taskIconColor, iconSize)
    } else if (entryKind === 'note' && calendarEventIconIsExplicit(noteIconId)) {
      appendCalendarEventIconSvg(host, noteIconId, iconClass, noteIconColor, iconSize)
    } else {
      host.appendChild(createKindIcon(entryKind, labels[entryKind], iconClass))
    }
  }

  const timeLabel = monthLayout
    ? formatFcEventTimeRangeText(arg)
    : arg.timeText?.trim() || null

  if (inlineIconLayout) {
    if (timeLabel) {
      const timeRow = document.createElement('div')
      timeRow.className = 'fc-cal-event-custom-time-row'
      appendEntryIcon(timeRow)
      const timeEl = document.createElement('div')
      timeEl.className = taskCompleted
        ? 'fc-cal-event-custom-time fc-cal-event-custom-time--completed'
        : 'fc-cal-event-custom-time'
      timeEl.textContent = timeLabel
      timeRow.appendChild(timeEl)
      body.appendChild(timeRow)
      body.appendChild(titleEl)
    } else {
      const titleRow = document.createElement('div')
      titleRow.className = 'fc-cal-event-custom-title-row'
      appendEntryIcon(titleRow)
      titleRow.appendChild(titleEl)
      body.appendChild(titleRow)
    }
  } else {
    if (timeLabel) {
      const timeEl = document.createElement('div')
      timeEl.className = taskCompleted
        ? 'fc-cal-event-custom-time fc-cal-event-custom-time--completed'
        : 'fc-cal-event-custom-time'
      timeEl.textContent = timeLabel
      body.appendChild(timeEl)
    }
    body.appendChild(titleEl)
    appendEntryIcon(root)
  }

  root.appendChild(body)

  return { domNodes: [root] }
}
