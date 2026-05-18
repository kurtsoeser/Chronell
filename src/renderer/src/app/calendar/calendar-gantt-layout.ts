import { addMinutes, parseISO, startOfDay } from 'date-fns'
import type { CalendarEventView } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { mailListItemTodoScheduleWindow } from '@/app/calendar/mail-todo-calendar'
import { msToGanttX } from '@/app/calendar/calendar-gantt-scale'
import {
  addLocalCalendarDays,
  isoToLocalDateOnly,
  localDayEndMsExclusiveFromIso,
  localDayStartMsFromDateOnly,
  localDayStartMsFromIso
} from '@/app/calendar/gantt-all-day-ms'

const DEFAULT_BLOCK_MINUTES = 30
const DEFAULT_BLOCK_MS = DEFAULT_BLOCK_MINUTES * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export const GANTT_ROW_HEIGHT = 32
export const GANTT_BAND_PADDING = 12
export const GANTT_LANE_GAP = 8
export const GANTT_ALL_DAY_LABEL_HEIGHT = 18

export type GanttBarLane = 'allDay' | 'timed'

export interface GanttBarInterval {
  startMs: number
  endMs: number
  allDay: boolean
}

export interface GanttPlacedBar {
  item: WorkItem
  interval: GanttBarInterval
  leftPx: number
  widthPx: number
  lane: GanttBarLane
  row: number
  editable: boolean
}

export interface GanttLayoutResult {
  bars: GanttPlacedBar[]
  allDayRowCount: number
  timedRowCount: number
}

function allDayIntervalFromDateOnly(startDateOnly: string, endDateOnly?: string): GanttBarInterval | null {
  const startMs = localDayStartMsFromDateOnly(startDateOnly)
  if (startMs == null) return null
  const endMs = endDateOnly
    ? localDayEndMsExclusiveFromIso(endDateOnly, startMs)
    : startMs + DAY_MS
  if (endMs <= startMs) return { startMs, endMs: startMs + DAY_MS, allDay: true }
  return { startMs, endMs, allDay: true }
}

export function workItemGanttInterval(item: WorkItem): GanttBarInterval | null {
  if (item.kind === 'calendar_event') {
    return calendarEventGanttInterval(item.event)
  }
  if (item.kind === 'mail_todo') {
    const window = mailListItemTodoScheduleWindow(item.mail)
    if (window) {
      return {
        startMs: window.startMs,
        endMs: window.endMs,
        allDay: window.allDay
      }
    }
    const received = item.mail.receivedAt ?? item.mail.sentAt
    if (received) {
      const s = parseISO(received).getTime()
      if (Number.isFinite(s)) {
        return { startMs: s, endMs: s + DEFAULT_BLOCK_MS, allDay: false }
      }
    }
    const due = item.dueAtIso?.trim()
    if (due) {
      const d0 = isoToLocalDateOnly(due)
      if (d0) return allDayIntervalFromDateOnly(d0, addLocalCalendarDays(d0, 1))
    }
    return null
  }
  const plannedStart = item.planned.plannedStartIso?.trim()
  const plannedEnd = item.planned.plannedEndIso?.trim()
  if (plannedStart) {
    const s = parseISO(plannedStart).getTime()
    if (!Number.isFinite(s)) return null
    if (plannedEnd) {
      const e = parseISO(plannedEnd).getTime()
      if (Number.isFinite(e) && e > s) {
        return { startMs: s, endMs: e, allDay: false }
      }
    }
    return { startMs: s, endMs: s + DEFAULT_BLOCK_MS, allDay: false }
  }
  const due = item.dueAtIso?.trim()
  if (due) {
    const d0 = isoToLocalDateOnly(due)
    if (d0) return allDayIntervalFromDateOnly(d0, addLocalCalendarDays(d0, 1))
  }
  return null
}

function calendarEventGanttInterval(event: CalendarEventView): GanttBarInterval | null {
  if (event.isAllDay) {
    const startMs = localDayStartMsFromIso(event.startIso)
    if (startMs == null) return null
    const endIso = event.endIso?.trim()
    const endMs = endIso
      ? localDayEndMsExclusiveFromIso(endIso, startMs)
      : startMs + DAY_MS
    if (endMs <= startMs) return { startMs, endMs: startMs + DAY_MS, allDay: true }
    return { startMs, endMs, allDay: true }
  }
  const s = parseISO(event.startIso).getTime()
  if (!Number.isFinite(s)) return null
  const e = event.endIso ? parseISO(event.endIso).getTime() : NaN
  if (!Number.isFinite(e) || e <= s) {
    return { startMs: s, endMs: s + DEFAULT_BLOCK_MS, allDay: false }
  }
  return { startMs: s, endMs: e, allDay: false }
}

export function workItemGanttEditable(item: WorkItem): boolean {
  if (item.kind === 'calendar_event') {
    const ev = item.event
    if (!ev.graphEventId) return false
    if (ev.calendarCanEdit === false) return false
    return ev.source === 'microsoft' || ev.source === 'google'
  }
  if (item.completed) return false
  return true
}

function layoutLaneBars(
  candidates: Array<{
    item: WorkItem
    interval: GanttBarInterval
    leftPx: number
    widthPx: number
    editable: boolean
  }>,
  lane: GanttBarLane
): GanttPlacedBar[] {
  const sorted = [...candidates].sort((a, b) => a.leftPx - b.leftPx || b.widthPx - a.widthPx)
  const rowEnds: number[] = []
  const placed: GanttPlacedBar[] = []

  for (const c of sorted) {
    const barEnd = c.leftPx + c.widthPx
    let row = 0
    for (; row < rowEnds.length; row++) {
      if (c.leftPx >= rowEnds[row]! + 4) break
    }
    if (row === rowEnds.length) rowEnds.push(barEnd)
    else rowEnds[row] = barEnd
    placed.push({ ...c, lane, row })
  }

  return placed
}

export function layoutGanttBars(
  items: WorkItem[],
  rangeStartMs: number,
  rangeEndMs: number,
  widthPx: number,
  minBarWidthPx = 6
): GanttLayoutResult {
  const rangeSpan = rangeEndMs - rangeStartMs
  if (rangeSpan <= 0 || widthPx <= 0) {
    return { bars: [], allDayRowCount: 0, timedRowCount: 0 }
  }

  const allDayCandidates: Array<{
    item: WorkItem
    interval: GanttBarInterval
    leftPx: number
    widthPx: number
    editable: boolean
  }> = []
  const timedCandidates: typeof allDayCandidates = []

  for (const item of items) {
    const interval = workItemGanttInterval(item)
    if (!interval) continue
    const visStart = Math.max(interval.startMs, rangeStartMs)
    const visEnd = Math.min(interval.endMs, rangeEndMs)
    if (visEnd <= visStart) continue
    const leftPx = msToGanttX(visStart, rangeStartMs, rangeEndMs, widthPx)
    const rightPx = msToGanttX(visEnd, rangeStartMs, rangeEndMs, widthPx)
    const barW = Math.max(minBarWidthPx, rightPx - leftPx)
    const candidate = {
      item,
      interval,
      leftPx,
      widthPx: barW,
      editable: workItemGanttEditable(item)
    }
    if (interval.allDay) allDayCandidates.push(candidate)
    else timedCandidates.push(candidate)
  }

  const allDayBars = layoutLaneBars(allDayCandidates, 'allDay')
  const timedBars = layoutLaneBars(timedCandidates, 'timed')
  const allDayRowCount = allDayBars.reduce((m, b) => Math.max(m, b.row + 1), 0)
  const timedRowCount = timedBars.reduce((m, b) => Math.max(m, b.row + 1), 0)

  return {
    bars: [...allDayBars, ...timedBars],
    allDayRowCount,
    timedRowCount
  }
}

export function ganttBarAreaHeightPx(allDayRowCount: number, timedRowCount: number): number {
  const minTimedRows = 1
  const timedRows = timedRowCount > 0 ? timedRowCount : minTimedRows
  const allDayBand =
    allDayRowCount > 0
      ? GANTT_ALL_DAY_LABEL_HEIGHT + allDayRowCount * GANTT_ROW_HEIGHT + GANTT_LANE_GAP
      : 0
  const timedBand = timedRows * GANTT_ROW_HEIGHT
  return Math.max(120, GANTT_BAND_PADDING * 2 + allDayBand + timedBand)
}

export function ganttBarTopPx(bar: GanttPlacedBar, allDayRowCount: number): number {
  if (bar.lane === 'allDay') {
    return GANTT_BAND_PADDING + GANTT_ALL_DAY_LABEL_HEIGHT + bar.row * GANTT_ROW_HEIGHT
  }
  const timedTop =
    allDayRowCount > 0
      ? GANTT_BAND_PADDING +
        GANTT_ALL_DAY_LABEL_HEIGHT +
        allDayRowCount * GANTT_ROW_HEIGHT +
        GANTT_LANE_GAP
      : GANTT_BAND_PADDING
  return timedTop + bar.row * GANTT_ROW_HEIGHT
}

export function ganttTimedBandTopPx(allDayRowCount: number): number {
  if (allDayRowCount <= 0) return GANTT_BAND_PADDING
  return (
    GANTT_BAND_PADDING +
    GANTT_ALL_DAY_LABEL_HEIGHT +
    allDayRowCount * GANTT_ROW_HEIGHT +
    GANTT_LANE_GAP
  )
}

export function intervalFromGanttDrag(
  startMs: number,
  endMs: number,
  allDay: boolean,
  snapMs: number
): GanttBarInterval {
  if (allDay) {
    const s = startOfDay(new Date(startMs)).getTime()
    const endDayStart = startOfDay(new Date(Math.max(startMs, endMs - 1))).getTime()
    const e = Math.max(s + DAY_MS, endDayStart + DAY_MS)
    return { startMs: s, endMs: e, allDay: true }
  }
  if (snapMs > 0) {
    const snappedStart = Math.round(startMs / snapMs) * snapMs
    const snappedEnd = Math.round(endMs / snapMs) * snapMs
    const minEnd = snappedStart + snapMs
    return {
      startMs: snappedStart,
      endMs: Math.max(minEnd, snappedEnd),
      allDay: false
    }
  }
  if (endMs <= startMs) {
    return { startMs, endMs: startMs + DEFAULT_BLOCK_MS, allDay: false }
  }
  return { startMs, endMs, allDay: false }
}

export function addMinutesToMs(ms: number, minutes: number): number {
  return addMinutes(new Date(ms), minutes).getTime()
}
