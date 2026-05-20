import { format } from 'date-fns'
import type { WorkItem } from '@shared/work-item'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import type { GanttBarInterval } from '@/app/calendar/calendar-gantt-layout'
import { fullCalendarEventToPatchSchedule } from '@/app/calendar/calendar-shell-view-helpers'
import {
  CalendarScheduleChangeDiscardedError,
  patchScheduleInputWithMeetingNotify,
  resolveMeetingScheduleChange
} from '@/app/calendar/calendar-meeting-schedule-change'
import type { TFunction } from 'i18next'

export interface GanttPersistDeps {
  fcTimeZone: string
  setTodoScheduleForMessage: (
    messageId: number,
    startIso: string,
    endIso: string,
    opts?: { skipSelectedRefresh?: boolean }
  ) => Promise<void>
  patchEventSchedule: typeof window.mailClient.calendar.patchEventSchedule
  t: TFunction
}

function intervalToSchedule(interval: GanttBarInterval): {
  startIso: string
  endIso: string
  isAllDay: boolean
} {
  if (interval.allDay) {
    const startIso = format(new Date(interval.startMs), 'yyyy-MM-dd')
    const endIso = format(new Date(interval.endMs), 'yyyy-MM-dd')
    return { startIso, endIso, isAllDay: true }
  }
  return {
    startIso: new Date(interval.startMs).toISOString(),
    endIso: new Date(interval.endMs).toISOString(),
    isAllDay: false
  }
}

/** Speichert verschobene/resizierte Balken (gleiche Regeln wie FullCalendar-DnD). */
export async function persistWorkItemGanttSchedule(
  item: WorkItem,
  interval: GanttBarInterval,
  deps: GanttPersistDeps
): Promise<void> {
  const sched = intervalToSchedule(interval)

  if (item.kind === 'mail_todo') {
    await deps.setTodoScheduleForMessage(item.messageId, sched.startIso, sched.endIso, {
      skipSelectedRefresh: true
    })
    return
  }

  if (item.kind === 'cloud_task') {
    await applyCloudTaskPersistTarget(
      {
        kind: 'planned',
        taskKey: item.stableKey,
        plannedStartIso: sched.startIso,
        plannedEndIso: sched.endIso
      },
      {
        accountId: item.accountId,
        listId: item.listId,
        id: item.taskId
      },
      deps.fcTimeZone
    )
    return
  }

  const ev = item.event
  if (!ev.graphEventId) {
    throw new Error('calendar.errors.scheduleParseFailed')
  }
  if (ev.calendarCanEdit === false) {
    throw new Error('calendar.errors.calendarReadOnlyEdit')
  }
  const patch = fullCalendarEventToPatchSchedule({
    start: new Date(sched.startIso),
    end: new Date(sched.endIso),
    allDay: sched.isAllDay
  })
  if (!patch) {
    throw new Error('calendar.errors.scheduleParseFailed')
  }
  const scheduleResolution = await resolveMeetingScheduleChange(ev, deps.t)
  if (scheduleResolution.action === 'discard') {
    throw new CalendarScheduleChangeDiscardedError()
  }
  await deps.patchEventSchedule(
    patchScheduleInputWithMeetingNotify(
      {
        accountId: ev.accountId,
        graphEventId: ev.graphEventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        startIso: patch.startIso,
        endIso: patch.endIso,
        isAllDay: patch.isAllDay
      },
      scheduleResolution.notifyAttendees
    )
  )
}
