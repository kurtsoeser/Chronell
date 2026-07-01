import { useCallback, type RefObject } from 'react'
import type { TFunction } from 'i18next'
import { CalendarScheduleChangeDiscardedError } from '@/app/calendar/calendar-meeting-schedule-change'
import { clearMegaTimelineCache } from '@/app/work-items/apply-calendar-event-schedule-to-work-items'
import { persistWorkItemGanttSchedule } from '@/app/calendar/calendar-gantt-persist'
import { persistGanttTimelineScale } from '@/app/calendar/calendar-gantt-timeline-storage'
import type { GanttTimelineScale } from '@/app/calendar/calendar-gantt-scale'
import type { GanttBarInterval } from '@/app/calendar/calendar-gantt-layout'
import type { WorkItem } from '@shared/work-item'

export function useCalendarShellGanttHandlers(args: {
  fcTimeZone: string
  t: TFunction
  setTodoScheduleForMessage: (
    messageId: number,
    startIso: string,
    endIso: string,
    opts?: { skipSelectedRefresh?: boolean }
  ) => Promise<void>
  reloadVisibleRange: (opts?: { forceRefresh?: boolean; silent?: boolean }) => void
  timelineReloadRef: RefObject<(() => void) | null>
  setError: (msg: string | null) => void
  setGanttScale: (scale: GanttTimelineScale) => void
  setGanttSelectedKey: (key: string | null) => void
  applyTimelineWorkItemToPreview: (item: WorkItem) => void
}) {
  const {
    fcTimeZone,
    t,
    setTodoScheduleForMessage,
    reloadVisibleRange,
    timelineReloadRef,
    setError,
    setGanttScale,
    setGanttSelectedKey,
    applyTimelineWorkItemToPreview
  } = args

  const handleGanttScaleChange = useCallback(
    (scale: GanttTimelineScale): void => {
      setGanttScale(scale)
      persistGanttTimelineScale(scale)
    },
    [setGanttScale]
  )

  const handleGanttPersistSchedule = useCallback(
    async (item: WorkItem, interval: GanttBarInterval): Promise<void> => {
      try {
        await persistWorkItemGanttSchedule(item, interval, {
          fcTimeZone,
          setTodoScheduleForMessage,
          patchEventSchedule: window.mailClient.calendar.patchEventSchedule,
          t
        })
        setError(null)
        timelineReloadRef.current?.()
        clearMegaTimelineCache()
        reloadVisibleRange({ silent: true })
      } catch (e) {
        if (e instanceof CalendarScheduleChangeDiscardedError) {
          throw e
        }
        const raw = e instanceof Error ? e.message : String(e)
        setError(raw.startsWith('calendar.') ? t(raw) : raw)
        throw e
      }
    },
    [fcTimeZone, setTodoScheduleForMessage, reloadVisibleRange, timelineReloadRef, setError, t]
  )

  const handleGanttWorkItemSelect = useCallback(
    (item: WorkItem): void => {
      setGanttSelectedKey(item.stableKey)
      applyTimelineWorkItemToPreview(item)
    },
    [setGanttSelectedKey, applyTimelineWorkItemToPreview]
  )

  return { handleGanttScaleChange, handleGanttPersistSchedule, handleGanttWorkItemSelect }
}
