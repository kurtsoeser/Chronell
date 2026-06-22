import { addMinutes, set } from 'date-fns'
import type { CalendarEventView } from './types'

export const DEFAULT_WORKING_HOURS = { startHour: 8, endHour: 18 } as const

export interface CalendarFreeSlot {
  startIso: string
  endIso: string
}

export interface FindLocalFreeSlotsOptions {
  durationMinutes: number
  rangeStartIso: string
  rangeEndIso: string
  workingHoursStart?: number
  workingHoursEnd?: number
  maxResults?: number
  /** Ab dieser Zeit suchen (z. B. jetzt). */
  notBeforeIso?: string | null
}

function parseMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : Number.NaN
}

function snapUpToQuarterHour(d: Date): Date {
  const ms = d.getTime()
  const quarter = 15 * 60_000
  return new Date(Math.ceil(ms / quarter) * quarter)
}

function dayWorkingWindow(
  day: Date,
  startHour: number,
  endHour: number
): { startMs: number; endMs: number } {
  const start = set(day, { hours: startHour, minutes: 0, seconds: 0, milliseconds: 0 })
  const end = set(day, { hours: endHour, minutes: 0, seconds: 0, milliseconds: 0 })
  return { startMs: start.getTime(), endMs: end.getTime() }
}

function eventBusyIntervals(
  events: CalendarEventView[],
  windowStartMs: number,
  windowEndMs: number
): Array<{ startMs: number; endMs: number }> {
  const out: Array<{ startMs: number; endMs: number }> = []
  for (const ev of events) {
    if (ev.isAllDay) continue
    const s = parseMs(ev.startIso)
    const e = parseMs(ev.endIso)
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue
    if (s >= windowEndMs || e <= windowStartMs) continue
    out.push({
      startMs: Math.max(s, windowStartMs),
      endMs: Math.min(e, windowEndMs)
    })
  }
  out.sort((a, b) => a.startMs - b.startMs)
  return out
}

function mergeBusyIntervals(
  intervals: Array<{ startMs: number; endMs: number }>
): Array<{ startMs: number; endMs: number }> {
  if (intervals.length === 0) return []
  const merged: Array<{ startMs: number; endMs: number }> = [intervals[0]!]
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i]!
    const last = merged[merged.length - 1]!
    if (cur.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, cur.endMs)
    } else {
      merged.push(cur)
    }
  }
  return merged
}

export function calendarSlotHasConflict(
  events: CalendarEventView[],
  startIso: string,
  endIso: string,
  options?: { ignoreGraphEventIds?: string[] }
): boolean {
  const invStart = parseMs(startIso)
  const invEnd = parseMs(endIso)
  if (!Number.isFinite(invStart) || !Number.isFinite(invEnd)) return false
  const ignore = new Set(options?.ignoreGraphEventIds ?? [])
  for (const ev of events) {
    if (ev.graphEventId && ignore.has(ev.graphEventId)) continue
    const s = parseMs(ev.startIso)
    const e = parseMs(ev.endIso)
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue
    if (s < invEnd && e > invStart) return true
  }
  return false
}

export function findLocalFreeSlots(
  events: CalendarEventView[],
  options: FindLocalFreeSlotsOptions
): CalendarFreeSlot[] {
  const {
    durationMinutes,
    rangeStartIso,
    rangeEndIso,
    workingHoursStart = DEFAULT_WORKING_HOURS.startHour,
    workingHoursEnd = DEFAULT_WORKING_HOURS.endHour,
    maxResults = 20,
    notBeforeIso = null
  } = options

  const durationMs = durationMinutes * 60_000
  if (durationMs <= 0) return []

  const rangeStartMs = parseMs(rangeStartIso)
  const rangeEndMs = parseMs(rangeEndIso)
  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs) || rangeEndMs <= rangeStartMs) {
    return []
  }

  let notBeforeMs = notBeforeIso ? parseMs(notBeforeIso) : rangeStartMs
  if (!Number.isFinite(notBeforeMs)) notBeforeMs = rangeStartMs

  const slots: CalendarFreeSlot[] = []
  let dayCursor = new Date(rangeStartMs)
  dayCursor.setHours(0, 0, 0, 0)

  while (dayCursor.getTime() < rangeEndMs && slots.length < maxResults) {
    const { startMs: workStartMs, endMs: workEndMs } = dayWorkingWindow(
      dayCursor,
      workingHoursStart,
      workingHoursEnd
    )
    const windowStartMs = Math.max(workStartMs, rangeStartMs, notBeforeMs)
    const windowEndMs = Math.min(workEndMs, rangeEndMs)
    if (windowEndMs - windowStartMs >= durationMs) {
      const busy = mergeBusyIntervals(
        eventBusyIntervals(events, windowStartMs, windowEndMs)
      )
      let cursorMs = snapUpToQuarterHour(new Date(windowStartMs)).getTime()
      if (cursorMs < windowStartMs) cursorMs = windowStartMs

      for (const block of busy) {
        while (cursorMs + durationMs <= block.startMs && slots.length < maxResults) {
          if (cursorMs >= windowStartMs) {
            slots.push({
              startIso: new Date(cursorMs).toISOString(),
              endIso: new Date(cursorMs + durationMs).toISOString()
            })
          }
          cursorMs += 15 * 60_000
        }
        cursorMs = Math.max(cursorMs, block.endMs)
        cursorMs = snapUpToQuarterHour(new Date(cursorMs)).getTime()
      }

      while (cursorMs + durationMs <= windowEndMs && slots.length < maxResults) {
        slots.push({
          startIso: new Date(cursorMs).toISOString(),
          endIso: new Date(cursorMs + durationMs).toISOString()
        })
        cursorMs += 15 * 60_000
      }
    }
    dayCursor = addMinutes(dayCursor, 24 * 60)
  }

  return slots
}

/** Erster freier Slot ab `notBeforeIso` (typisch: jetzt). */
export function findNextLocalFreeSlot(
  events: CalendarEventView[],
  options: Omit<FindLocalFreeSlotsOptions, 'maxResults'>
): CalendarFreeSlot | null {
  return findLocalFreeSlots(events, { ...options, maxResults: 1 })[0] ?? null
}

/** Erster Slot an einem Tag in einem Stundenfenster (z. B. Nachmittag 12–18). */
export function findLocalFreeSlotInDayWindow(
  events: CalendarEventView[],
  day: Date,
  options: {
    durationMinutes: number
    windowStartHour: number
    windowEndHour: number
    notBeforeIso?: string | null
  }
): CalendarFreeSlot | null {
  const dayStart = set(day, {
    hours: options.windowStartHour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0
  })
  const dayEnd = set(day, {
    hours: options.windowEndHour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0
  })
  return findLocalFreeSlots(events, {
    durationMinutes: options.durationMinutes,
    rangeStartIso: dayStart.toISOString(),
    rangeEndIso: dayEnd.toISOString(),
    workingHoursStart: options.windowStartHour,
    workingHoursEnd: options.windowEndHour,
    notBeforeIso: options.notBeforeIso ?? null,
    maxResults: 1
  })[0] ?? null
}
