import type { CalendarApi } from '@fullcalendar/core'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import {
  CLOUD_TASK_SPAN_KIND_DUE,
  CLOUD_TASK_SPAN_KIND_PLANNED,
  cloudTaskEventId,
  cloudTasksToFullCalendarEvents,
  cloudTaskVisualSpan,
  dueIsoFromCloudTaskScheduleStart,
  type CloudTaskPersistTarget
} from '@/app/calendar/cloud-task-calendar'
import { removeCloudTaskCalendarEventsByTaskKey } from '@/app/calendar/calendar-fc-event-source'
import type { TaskItemWithContext } from '@/app/tasks/tasks-types'

export function applyOptimisticCloudTaskPersistToLayer(
  target: CloudTaskPersistTarget,
  task: TaskItemWithContext,
  items: readonly TaskItemWithContext[],
  plannedByKey: ReadonlyMap<string, WorkItemPlannedSchedule>,
  fcTimeZone: string
): { items: TaskItemWithContext[]; plannedByKey: Map<string, WorkItemPlannedSchedule> } {
  const key = target.taskKey
  const nextPlanned = new Map(plannedByKey)
  let nextTask = task

  if (target.kind === 'planned') {
    nextPlanned.set(key, {
      plannedStartIso: target.plannedStartIso,
      plannedEndIso: target.plannedEndIso
    })
    nextTask = {
      ...task,
      dueIso: dueIsoFromCloudTaskScheduleStart(target.plannedStartIso, fcTimeZone)
    }
  } else {
    nextPlanned.delete(key)
    nextTask = { ...task, dueIso: target.dueIso }
  }

  const nextItems = items.map((row) => {
    const rowKey = cloudTaskStableKey(row.accountId, row.listId, row.id)
    return rowKey === key ? nextTask : row
  })
  if (!nextItems.some((row) => cloudTaskStableKey(row.accountId, row.listId, row.id) === key)) {
    nextItems.push(nextTask)
  }

  return { items: nextItems, plannedByKey: nextPlanned }
}

/** Gleicht den sichtbaren FC-Termin nach Drag/Resize mit Layer-Daten ab. */
export function syncFullCalendarCloudTaskEventFromLayer(
  api: CalendarApi | null | undefined,
  task: TaskItemWithContext,
  planned: WorkItemPlannedSchedule | undefined,
  fcTimeZone: string,
  accountColorById: Record<string, string> = {}
): void {
  if (!api) return
  const taskKey = cloudTaskStableKey(task.accountId, task.listId, task.id)
  const span = cloudTaskVisualSpan(task, planned)
  const eventId = cloudTaskEventId(taskKey)

  if (!span) {
    removeCloudTaskCalendarEventsByTaskKey(api, taskKey)
    return
  }

  removeCloudTaskCalendarEventsByTaskKey(api, taskKey, eventId)

  const spanKind = span.allDay ? CLOUD_TASK_SPAN_KIND_DUE : CLOUD_TASK_SPAN_KIND_PLANNED
  let existing = api.getEventById(eventId)
  if (!existing) {
    const plannedMap = new Map<string, WorkItemPlannedSchedule>()
    if (planned) plannedMap.set(taskKey, planned)
    const input = cloudTasksToFullCalendarEvents([task], accountColorById, plannedMap)[0]
    if (input) {
      api.addEvent({ ...input, id: eventId })
    }
    return
  }

  existing.setAllDay(span.allDay)
  existing.setDates(span.fcStart, span.fcEnd, { allDay: span.allDay })
  existing.setExtendedProp('cloudTask', task)
  existing.setExtendedProp('cloudTaskSpanKind', spanKind)
}
