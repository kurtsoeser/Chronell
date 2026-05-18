import type { CalendarEventWorkItem, WorkItem } from '@shared/work-item'
import {
  isCalendarEventDismissed,
  isCalendarEventForceOpen,
  readTimelineAutoDismissEndedEvents
} from '@/app/calendar/calendar-event-dismiss-storage'

export function calendarEventEndMs(item: CalendarEventWorkItem): number {
  const endIso = item.planned.plannedEndIso ?? item.event.endIso
  return Date.parse(endIso)
}

export function isCalendarEventEnded(item: CalendarEventWorkItem, nowMs: number): boolean {
  const endMs = calendarEventEndMs(item)
  return Number.isFinite(endMs) && endMs < nowMs
}

/** Manuell abgehakt oder (optional) automatisch nach Terminende. */
export function isCalendarEventEffectivelyDone(
  item: CalendarEventWorkItem,
  nowMs = Date.now(),
  autoDismissEnded = readTimelineAutoDismissEndedEvents()
): boolean {
  if (isCalendarEventForceOpen(item.stableKey)) return false
  if (isCalendarEventDismissed(item.stableKey)) return true
  if (autoDismissEnded && isCalendarEventEnded(item, nowMs)) return true
  return false
}

export function applyCalendarCompletionState(
  items: WorkItem[],
  nowMs = Date.now()
): WorkItem[] {
  const autoDismiss = readTimelineAutoDismissEndedEvents()
  return items.map((item) => {
    if (item.kind !== 'calendar_event') return item
    const completed = isCalendarEventEffectivelyDone(item, nowMs, autoDismiss)
    if (item.completed === completed) return item
    return { ...item, completed }
  })
}
