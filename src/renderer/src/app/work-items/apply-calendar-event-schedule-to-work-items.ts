import type { CalendarEventView } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { calendarEventStableKey } from '@shared/work-item-keys'
import { useMegaTimelineCacheStore } from '@/stores/mega-timeline-cache'

export function applyCalendarEventScheduleToWorkItems(
  items: readonly WorkItem[],
  updated: CalendarEventView
): WorkItem[] {
  const graphEventId = updated.graphEventId?.trim()
  if (!graphEventId) return [...items]

  const stableKey = calendarEventStableKey(
    updated.accountId,
    updated.graphCalendarId,
    graphEventId
  )

  return items.map((item) => {
    if (item.kind !== 'calendar_event') return item
    if (item.stableKey !== stableKey) return item
    return {
      ...item,
      title: updated.title,
      event: updated,
      planned: {
        plannedStartIso: updated.startIso,
        plannedEndIso: updated.endIso
      }
    }
  })
}

export function clearMegaTimelineCache(): void {
  useMegaTimelineCacheStore.getState().clear()
}
