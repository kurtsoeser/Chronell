import type { CalendarPreviewPopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import type { SchedulingSlot } from '@shared/scheduling-types'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import type { CalendarEventView } from '@shared/types'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
export type ApplyCalendarPreviewPopoutStashHandlers = {
  setSchedulingOpen: (open: boolean) => void
  setSchedulingAccountId: (id: string) => void
  setSchedulingDurationMin: (min: number) => void
  setSchedulingMeetingTitle: (title: string) => void
  setSchedulingSlots: (slots: SchedulingSlot[]) => void
  setPreviewCalendarEvent: (ev: CalendarEventView | null) => void
  setPreviewCloudTask: (task: CloudTaskListItem | null) => void
  setPreviewCloudTaskPlannedFromTimeline: (planned: WorkItemPlannedSchedule | null) => void
  clearSelectedMessage: () => void
  selectMessageWithThreadPreview: (messageId: number) => Promise<void>
}

export async function applyCalendarPreviewPopoutStash(
  stash: CalendarPreviewPopoutStash,
  h: ApplyCalendarPreviewPopoutStashHandlers
): Promise<void> {
  h.setSchedulingOpen(false)
  if (stash.focus === 'scheduling') {
    h.setSchedulingSlots(stash.slots)
    h.setSchedulingAccountId(stash.accountId)
    h.setSchedulingDurationMin(stash.durationMin)
    h.setSchedulingMeetingTitle(stash.meetingTitle)
    h.setSchedulingOpen(true)
    h.setPreviewCalendarEvent(null)
    h.setPreviewCloudTask(null)
    h.setPreviewCloudTaskPlannedFromTimeline(null)
    h.clearSelectedMessage()
    return
  }
  if (stash.focus === 'mail') {
    h.setPreviewCalendarEvent(null)
    h.setPreviewCloudTask(null)
    h.setPreviewCloudTaskPlannedFromTimeline(null)
    await h.selectMessageWithThreadPreview(stash.messageId)
    return
  }
  if (stash.focus === 'task') {
    h.clearSelectedMessage()
    h.setPreviewCalendarEvent(null)
    const tasks = await window.mailClient.tasks.listTasks({
      accountId: stash.accountId,
      listId: stash.listId
    })
    const hit = tasks.find((t) => t.id === stash.taskId)
    if (hit) {
      const task: CloudTaskListItem = {
        ...hit,
        accountId: stash.accountId,
        listName: '',
        source: 'cloud'
      }
      h.setPreviewCloudTask(task)
      h.setPreviewCloudTaskPlannedFromTimeline(null)
    } else {
      h.setPreviewCloudTask(null)
    }
    return
  }
  if (stash.focus === 'event') {
    h.clearSelectedMessage()
    h.setPreviewCloudTask(null)
    h.setPreviewCloudTaskPlannedFromTimeline(null)
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - 6)
    const end = new Date(now)
    end.setMonth(end.getMonth() + 12)
    const events = await window.mailClient.calendar.listEvents({
      startIso: start.toISOString(),
      endIso: end.toISOString()
    })
    const ev = events.find(
      (row) => row.accountId === stash.accountId && row.graphEventId === stash.graphEventId
    )
    h.setPreviewCalendarEvent(ev ?? null)
    return
  }
  h.setPreviewCalendarEvent(null)
  h.setPreviewCloudTask(null)
  h.setPreviewCloudTaskPlannedFromTimeline(null)
  h.clearSelectedMessage()
}
