import type { WorkItem } from '@shared/work-item'
import {
  setCalendarEventDismissed,
  setCalendarEventForceOpen
} from '@/app/calendar/calendar-event-dismiss-storage'
import { isCalendarEventEffectivelyDone } from '@/app/calendar/calendar-event-completion'
import { messageIdsToUnflagWhenCloudTaskCompletes } from '@/app/work-items/work-item-links'

/** Cloud-Aufgabe erledigen und verknüpfte Mail-ToDos ent-flaggen. */
export async function completeCloudWorkItem(item: Extract<WorkItem, { kind: 'cloud_task' }>): Promise<void> {
  await window.mailClient.tasks.patchTask({
    accountId: item.accountId,
    listId: item.listId,
    taskId: item.taskId,
    completed: true
  })
  for (const messageId of messageIdsToUnflagWhenCloudTaskCompletes(item)) {
    try {
      await window.mailClient.mail.completeTodoForMessage(messageId)
    } catch {
      // einzelne Mail ueberspringen
    }
  }
}

export async function toggleWorkItemCompleted(item: WorkItem): Promise<void> {
  if (item.kind === 'calendar_event') {
    const done = isCalendarEventEffectivelyDone(item)
    if (done) {
      setCalendarEventDismissed(item.stableKey, false)
      setCalendarEventForceOpen(item.stableKey, true)
    } else {
      setCalendarEventDismissed(item.stableKey, true)
      setCalendarEventForceOpen(item.stableKey, false)
    }
    return
  }
  if (item.kind === 'mail_todo') {
    if (!item.completed) {
      await window.mailClient.mail.completeTodoForMessage(item.messageId)
    }
    return
  }
  if (item.completed) {
    await window.mailClient.tasks.patchTask({
      accountId: item.accountId,
      listId: item.listId,
      taskId: item.taskId,
      completed: false
    })
    return
  }
  await completeCloudWorkItem(item)
}
