import { useMemo } from 'react'
import type { EventInput, EventSourceInput } from '@fullcalendar/core'
import type { CalendarEventView, UserNoteListItem } from '@shared/types'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import { shouldSkipHeavyCalendarLayersForMultiMonth } from '@/app/calendar/calendar-fc-multimonth'
import { quickCreateRangeToFcPlaceholder } from '@/app/calendar/calendar-quick-create-placeholder'
import { schedulingSlotsToFcEvents } from '@/app/calendar/scheduling-fc-placeholders'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import type { SchedulingSlot } from '@shared/scheduling-types'

export function useCalendarShellFcEventSources(args: {
  activeViewId: string
  graphCalendarSourceRev: number
  graphFcEventsForFc: EventInput[]
  mailTodoOverlay: boolean
  cloudTaskOverlay: boolean
  userNoteOverlay: boolean
  mailTodoFcEvents: EventInput[]
  cloudTaskFcEvents: EventInput[]
  userNoteFcEvents: EventInput[]
  calendarEventSearchQuery: string
  quickCreate: { anchor: { x: number; y: number }; range: CalendarCreateRange } | null
  schedulingOpen: boolean
  schedulingSlots: SchedulingSlot[]
}): EventSourceInput[] {
  const {
    activeViewId,
    graphCalendarSourceRev,
    graphFcEventsForFc,
    mailTodoOverlay,
    cloudTaskOverlay,
    userNoteOverlay,
    mailTodoFcEvents,
    cloudTaskFcEvents,
    userNoteFcEvents,
    calendarEventSearchQuery,
    quickCreate,
    schedulingOpen,
    schedulingSlots
  } = args

  const filterCalendarSearchEvents = useMemo(() => {
    const q = calendarEventSearchQuery.trim().toLowerCase()
    return (evs: EventInput[]): EventInput[] => {
      if (!q) return evs
      return evs.filter((ev) => {
        if (
          String(ev.title ?? '')
            .toLowerCase()
            .includes(q)
        )
          return true
        const cal = ev.extendedProps?.calendarEvent as CalendarEventView | undefined
        const loc = (cal?.location ?? '').trim().toLowerCase()
        if (loc.includes(q)) return true
        const task = (ev.extendedProps as { cloudTask?: CloudTaskListItem } | undefined)?.cloudTask
        if ((task?.title ?? '').trim().toLowerCase().includes(q)) return true
        const note = (ev.extendedProps as { userNote?: UserNoteListItem } | undefined)?.userNote
        return (note?.title ?? note?.body ?? '').trim().toLowerCase().includes(q)
      })
    }
  }, [calendarEventSearchQuery])

  const mailTodoFcEventsDisplayed = useMemo(
    () => filterCalendarSearchEvents(mailTodoFcEvents),
    [mailTodoFcEvents, filterCalendarSearchEvents]
  )
  const cloudTaskFcEventsDisplayed = useMemo(
    () => filterCalendarSearchEvents(cloudTaskFcEvents),
    [cloudTaskFcEvents, filterCalendarSearchEvents]
  )
  const userNoteFcEventsDisplayed = useMemo(
    () => filterCalendarSearchEvents(userNoteFcEvents),
    [userNoteFcEvents, filterCalendarSearchEvents]
  )

  const quickCreatePlaceholderEvents = useMemo((): EventInput[] => {
    if (!quickCreate) return []
    return [quickCreateRangeToFcPlaceholder(quickCreate.range)]
  }, [quickCreate])

  const schedulingPlaceholderEvents = useMemo((): EventInput[] => {
    if (!schedulingOpen) return []
    return schedulingSlotsToFcEvents(schedulingSlots)
  }, [schedulingOpen, schedulingSlots])

  return useMemo((): EventSourceInput[] => {
    const skipHeavyLayers = shouldSkipHeavyCalendarLayersForMultiMonth(activeViewId)
    const sources: EventSourceInput[] = [
      { id: `graph-calendar-${graphCalendarSourceRev}`, events: graphFcEventsForFc }
    ]
    if (mailTodoOverlay && !skipHeavyLayers) {
      sources.push({ id: 'mail-todo', events: mailTodoFcEventsDisplayed })
    }
    if (cloudTaskOverlay && !skipHeavyLayers) {
      sources.push({ id: 'cloud-task', events: cloudTaskFcEventsDisplayed })
    }
    if (userNoteOverlay && !skipHeavyLayers) {
      sources.push({ id: 'user-note', events: userNoteFcEventsDisplayed })
    }
    if (quickCreate) {
      sources.push({ id: 'quick-create-placeholder', events: quickCreatePlaceholderEvents })
    }
    if (schedulingOpen && schedulingPlaceholderEvents.length > 0) {
      sources.push({ id: 'scheduling-slots', events: schedulingPlaceholderEvents })
    }
    return sources
  }, [
    graphFcEventsForFc,
    graphCalendarSourceRev,
    mailTodoFcEventsDisplayed,
    cloudTaskFcEventsDisplayed,
    userNoteFcEventsDisplayed,
    mailTodoOverlay,
    cloudTaskOverlay,
    userNoteOverlay,
    activeViewId,
    quickCreate,
    quickCreatePlaceholderEvents,
    schedulingOpen,
    schedulingPlaceholderEvents
  ])
}
