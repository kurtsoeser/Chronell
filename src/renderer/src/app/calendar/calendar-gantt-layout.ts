import { addDays, addMinutes, parseISO } from 'date-fns'
import type { CalendarEventView } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { mailListItemTodoScheduleWindow } from '@/app/calendar/mail-todo-calendar'
import { endMsExclusiveForGantt, msToGanttX } from '@/app/calendar/calendar-gantt-scale'

const DEFAULT_BLOCK_MINUTES = 30
const DEFAULT_BLOCK_MS = DEFAULT_BLOCK_MINUTES * 60 * 1000

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
  row: number
  editable: boolean
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
      const d0 = due.slice(0, 10)
      const startMs = new Date(`${d0}T00:00:00.000Z`).getTime()
      const endMs = new Date(`${addDays(new Date(`${d0}T12:00:00.000Z`), 1).toISOString().slice(0, 10)}T00:00:00.000Z`).getTime()
      if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
        return { startMs, endMs, allDay: true }
      }
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
    const d0 = due.slice(0, 10)
    const startMs = new Date(`${d0}T00:00:00.000Z`).getTime()
    const endMs = new Date(`${addDays(new Date(`${d0}T12:00:00.000Z`), 1).toISOString().slice(0, 10)}T00:00:00.000Z`).getTime()
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return { startMs, endMs, allDay: true }
    }
  }
  return null
}

function calendarEventGanttInterval(event: CalendarEventView): GanttBarInterval | null {
  const s = parseISO(event.startIso).getTime()
  if (!Number.isFinite(s)) return null
  if (event.isAllDay) {
    const endRaw = event.endIso?.trim() || addDays(new Date(s), 1).toISOString().slice(0, 10)
    const endMs = new Date(endRaw.length <= 10 ? `${endRaw}T00:00:00.000Z` : endRaw).getTime()
    if (!Number.isFinite(endMs) || endMs <= s) {
      return { startMs: s, endMs: s + 24 * 60 * 60 * 1000, allDay: true }
    }
    return { startMs: s, endMs, allDay: true }
  }
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

export function layoutGanttBars(
  items: WorkItem[],
  rangeStartMs: number,
  rangeEndMs: number,
  widthPx: number,
  minBarWidthPx = 6
): GanttPlacedBar[] {
  const rangeSpan = rangeEndMs - rangeStartMs
  if (rangeSpan <= 0 || widthPx <= 0) return []

  const candidates: Array<{
    item: WorkItem
    interval: GanttBarInterval
    leftPx: number
    widthPx: number
    editable: boolean
  }> = []

  for (const item of items) {
    const interval = workItemGanttInterval(item)
    if (!interval) continue
    const visStart = Math.max(interval.startMs, rangeStartMs)
    const visEnd = Math.min(
      endMsExclusiveForGantt(new Date(interval.endMs), interval.allDay),
      rangeEndMs
    )
    if (visEnd <= visStart) continue
    const leftPx = msToGanttX(visStart, rangeStartMs, rangeEndMs, widthPx)
    const rightPx = msToGanttX(visEnd, rangeStartMs, rangeEndMs, widthPx)
    const barW = Math.max(minBarWidthPx, rightPx - leftPx)
    candidates.push({
      item,
      interval,
      leftPx,
      widthPx: barW,
      editable: workItemGanttEditable(item)
    })
  }

  candidates.sort((a, b) => a.leftPx - b.leftPx || b.widthPx - a.widthPx)

  const rowEnds: number[] = []
  const placed: GanttPlacedBar[] = []

  for (const c of candidates) {
    const barEnd = c.leftPx + c.widthPx
    let row = 0
    for (; row < rowEnds.length; row++) {
      if (c.leftPx >= rowEnds[row]! + 4) break
    }
    if (row === rowEnds.length) rowEnds.push(barEnd)
    else rowEnds[row] = barEnd
    placed.push({ ...c, row })
  }

  return placed
}

export function ganttBarAreaHeightPx(rowCount: number): number {
  const rowH = 32
  const pad = 12
  return Math.max(120, pad * 2 + Math.max(1, rowCount) * rowH)
}

export function intervalFromGanttDrag(
  startMs: number,
  endMs: number,
  allDay: boolean,
  snapMs: number
): GanttBarInterval {
  if (allDay) {
    const dayMs = 24 * 60 * 60 * 1000
    const s = Math.floor(startMs / dayMs) * dayMs
    const e = Math.max(s + dayMs, Math.ceil(endMs / dayMs) * dayMs)
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
