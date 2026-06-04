import type { CalendarEventView } from '@shared/types'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import type { WorkItem, WorkItemPlannedSchedule } from '@shared/work-item'
import { create } from 'zustand'
import { useMailStore } from '@/stores/mail'

interface LayoutStudioPreviewState {
  calendarEvent: CalendarEventView | null
  cloudTask: CloudTaskListItem | null
  cloudTaskPlanned: WorkItemPlannedSchedule | null
  applyWorkItem: (item: WorkItem) => void
  setCalendarEvent: (event: CalendarEventView | null) => void
  clearContextPreview: () => void
}

export const useLayoutStudioPreviewStore = create<LayoutStudioPreviewState>((set) => ({
  calendarEvent: null,
  cloudTask: null,
  cloudTaskPlanned: null,

  applyWorkItem(item): void {
    if (item.kind === 'cloud_task') {
      useMailStore.getState().clearSelectedMessage()
      const task: CloudTaskListItem = {
        ...item.task,
        accountId: item.accountId,
        listName: item.listName,
        source: 'cloud'
      }
      set({
        calendarEvent: null,
        cloudTask: task,
        cloudTaskPlanned: item.planned ?? null
      })
      return
    }
    if (item.kind === 'mail_todo') {
      set({ calendarEvent: null, cloudTask: null, cloudTaskPlanned: null })
      void useMailStore.getState().openMessageInFolder(item.messageId)
      return
    }
    useMailStore.getState().clearSelectedMessage()
    set({
      calendarEvent: item.event,
      cloudTask: null,
      cloudTaskPlanned: null
    })
  },

  setCalendarEvent(event): void {
    set({ calendarEvent: event, cloudTask: null, cloudTaskPlanned: null })
  },

  clearContextPreview(): void {
    set({ calendarEvent: null, cloudTask: null, cloudTaskPlanned: null })
  }
}))
