import type { TaskItemRow } from '@shared/types'
import type { TaskListFilter } from '@/app/tasks/task-list-arrange'
import {
  isCloudTaskListItem,
  isMailTodoListItem,
  tasksListItemKey,
  type CloudTaskListItem,
  type MailTodoListItem,
  type TasksListItem
} from '@/app/tasks/tasks-types'

export function taskLeavesVisibleListAfterToggle(
  nextCompleted: boolean,
  filter: TaskListFilter
): boolean {
  if (filter === 'open' && nextCompleted) return true
  if (filter === 'completed' && !nextCompleted) return true
  if (filter === 'overdue' && nextCompleted) return true
  return false
}

export function withTaskCompletedFlag<T extends TasksListItem>(task: T, completed: boolean): T {
  if (isMailTodoListItem(task)) {
    const doneAt = completed ? new Date().toISOString() : null
    return {
      ...task,
      completed,
      mail: { ...task.mail, todoCompletedAt: doneAt }
    } as T
  }
  return { ...task, completed } as T
}

export interface RunOptimisticTaskToggleParams {
  task: TasksListItem
  filter: TaskListFilter
  markExiting: (key: string, onRemove: () => void) => void
  onCloudOptimistic: (item: CloudTaskListItem, completed: boolean) => void
  onMailOptimistic: (item: MailTodoListItem, completed: boolean) => void
  onMailRemove: (messageId: number) => void
  onCloudRevert: (item: CloudTaskListItem, previous: boolean) => void
  onMailRevert: (item: MailTodoListItem) => void
  patchCloudRemote: (item: CloudTaskListItem, completed: boolean) => Promise<TaskItemRow>
  completeMailRemote: (messageId: number) => Promise<void>
  reopenMailRemote: (messageId: number) => Promise<void>
  onCloudSyncError: () => void
  onMailSyncError: () => void
}

/**
 * Optimistisches Abhaken: UI sofort, API im Hintergrund; bei Filter „Offen“ Ausblend-Animation.
 */
export function runOptimisticTaskToggle(params: RunOptimisticTaskToggleParams): void {
  const { task } = params
  const key = tasksListItemKey(task)
  const nextCompleted = !task.completed
  const leavesList = taskLeavesVisibleListAfterToggle(nextCompleted, params.filter)

  const applyOptimistic = (): void => {
    if (isMailTodoListItem(task)) {
      if (leavesList && nextCompleted) {
        params.onMailRemove(task.messageId)
      } else {
        params.onMailOptimistic(task, nextCompleted)
      }
      return
    }
    if (isCloudTaskListItem(task)) {
      params.onCloudOptimistic(task, nextCompleted)
    }
  }

  const sync = (): void => {
    void (async (): Promise<void> => {
      try {
        if (isMailTodoListItem(task)) {
          if (nextCompleted) {
            await params.completeMailRemote(task.messageId)
          } else {
            await params.reopenMailRemote(task.messageId)
          }
          return
        }
        if (isCloudTaskListItem(task)) {
          await params.patchCloudRemote(task, nextCompleted)
        }
      } catch {
        if (isMailTodoListItem(task)) {
          params.onMailRevert(task)
          params.onMailSyncError()
          return
        }
        if (isCloudTaskListItem(task)) {
          params.onCloudRevert(task, task.completed)
          params.onCloudSyncError()
        }
      }
    })()
  }

  if (leavesList) {
    params.markExiting(key, () => {
      applyOptimistic()
      sync()
    })
    return
  }

  applyOptimistic()
  sync()
}
