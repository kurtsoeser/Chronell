import { useEffect } from 'react'
import { parseISO, startOfDay } from 'date-fns'
import type { RefObject } from 'react'
import type FullCalendar from '@fullcalendar/react'
import type { CalendarEventView } from '@shared/types'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'
import type { SetCalendarShellEventDialog } from '@/app/calendar/calendar-shell-event-dialog-state'
import { persistRightPreviewOpen } from '@/app/calendar/calendar-shell-storage'

export function useCalendarShellPendingFocus(args: {
  calendarRef: RefObject<FullCalendar | null>
  calendarPendingEventId: string | null
  calendarPendingGotoDateIso: string | null
  calendarPendingCreateOnDayIso: string | null
  clearSelectedMessage: () => void
  setError: (msg: string | null) => void
  setPreviewCloudTask: (t: CloudTaskListItem | null) => void
  setPreviewCloudTaskPlannedFromTimeline: (p: WorkItemPlannedSchedule | null) => void
  setPreviewCalendarEvent: (e: CalendarEventView | null) => void
  setRightPreviewOpen: (open: boolean) => void
  setEventDialog: SetCalendarShellEventDialog
}): void {
  const {
    calendarRef,
    calendarPendingEventId,
    calendarPendingGotoDateIso,
    calendarPendingCreateOnDayIso,
    clearSelectedMessage,
    setError,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    setPreviewCalendarEvent,
    setRightPreviewOpen,
    setEventDialog
  } = args

  useEffect(() => {
    const st = useCalendarPendingFocusStore.getState()
    const ev = st.peekPendingEvent()
    if (ev) {
      clearSelectedMessage()
      setError(null)
      setPreviewCloudTask(null)
      setPreviewCloudTaskPlannedFromTimeline(null)
      setPreviewCalendarEvent(ev)
      persistRightPreviewOpen(true)
      setRightPreviewOpen(true)

      const start = parseISO(ev.startIso)
      if (Number.isNaN(start.getTime())) {
        useCalendarPendingFocusStore.getState().clearPendingEvent()
        return
      }

      let raf = 0
      let cancelled = false
      const step = (): void => {
        if (cancelled) return
        const api = calendarRef.current?.getApi()
        if (api) {
          api.gotoDate(start)
          useCalendarPendingFocusStore.getState().clearPendingEvent()
          return
        }
        raf = window.requestAnimationFrame(step)
      }
      raf = window.requestAnimationFrame(step)
      return (): void => {
        cancelled = true
        window.cancelAnimationFrame(raf)
      }
    }

    const createOnDay = st.peekPendingCreateOnDay()
    if (createOnDay) {
      clearSelectedMessage()
      setError(null)
      setPreviewCloudTask(null)
      setPreviewCloudTaskPlannedFromTimeline(null)
      setPreviewCalendarEvent(null)

      const parsed = parseISO(createOnDay.dateIso)
      if (Number.isNaN(parsed.getTime())) {
        useCalendarPendingFocusStore.getState().clearPendingCreateOnDay()
        return
      }
      const dayStart = startOfDay(parsed)

      let rafC = 0
      let cancelledC = false
      const stepCreate = (): void => {
        if (cancelledC) return
        const api = calendarRef.current?.getApi()
        if (api) {
          api.gotoDate(dayStart)
          setEventDialog({
            mode: 'create',
            range: { start: dayStart, end: dayStart, allDay: true }
          })
          useCalendarPendingFocusStore.getState().clearPendingCreateOnDay()
          return
        }
        rafC = window.requestAnimationFrame(stepCreate)
      }
      rafC = window.requestAnimationFrame(stepCreate)
      return (): void => {
        cancelledC = true
        window.cancelAnimationFrame(rafC)
      }
    }

    const iso = st.peekPendingGotoDate()
    if (!iso) return

    const day = parseISO(iso)
    if (Number.isNaN(day.getTime())) {
      useCalendarPendingFocusStore.getState().clearPendingGotoDate()
      return
    }

    let raf2 = 0
    let cancelled2 = false
    const step2 = (): void => {
      if (cancelled2) return
      const api = calendarRef.current?.getApi()
      if (api) {
        api.gotoDate(day)
        useCalendarPendingFocusStore.getState().clearPendingGotoDate()
        return
      }
      raf2 = window.requestAnimationFrame(step2)
    }
    raf2 = window.requestAnimationFrame(step2)
    return (): void => {
      cancelled2 = true
      window.cancelAnimationFrame(raf2)
    }
  }, [
    calendarRef,
    clearSelectedMessage,
    calendarPendingEventId,
    calendarPendingGotoDateIso,
    calendarPendingCreateOnDayIso,
    setError,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    setPreviewCalendarEvent,
    setRightPreviewOpen,
    setEventDialog
  ])
}
