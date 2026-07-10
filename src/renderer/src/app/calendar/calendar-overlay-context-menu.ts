import type { TFunction } from 'i18next'
import type { MailListItem } from '@shared/types'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import type { ContextMenuItem } from '@/components/ContextMenu'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import { buildTasksListContextMenuItems } from '@/app/tasks/tasks-list-context-menu'
import { mailListItemToTaskListItem } from '@/app/tasks/tasks-mail-todos'
import type { WorkItemContextHandlers } from '@/app/work-items/work-item-context-menu'

export type CalendarOverlayKind = 'cloud_task' | 'mail_todo'

export type CalendarOverlayContextMenuOptions = {
  t: TFunction
  mailTodoListLabel: string
  plannedByTaskKey?: ReadonlyMap<string, WorkItemPlannedSchedule>
  workItemHandlers: WorkItemContextHandlers
  onEditCloudTask?: (task: CloudTaskListItem) => void
  onEditMailTodo?: (mail: MailListItem) => void
}

export async function buildCalendarOverlayContextMenuItems(
  overlay:
    | { kind: 'cloud_task'; task: CloudTaskListItem }
    | { kind: 'mail_todo'; mail: MailListItem },
  anchor: { x: number; y: number },
  opts: CalendarOverlayContextMenuOptions
): Promise<ContextMenuItem[]> {
  const task =
    overlay.kind === 'cloud_task'
      ? overlay.task
      : mailListItemToTaskListItem(overlay.mail, opts.mailTodoListLabel)

  const onEdit =
    overlay.kind === 'cloud_task'
      ? opts.onEditCloudTask
        ? (): void => opts.onEditCloudTask!(overlay.task)
        : undefined
      : opts.onEditMailTodo
        ? (): void => opts.onEditMailTodo!(overlay.mail)
        : undefined

  return buildTasksListContextMenuItems(task, anchor, {
    t: opts.t,
    plannedByTaskKey: opts.plannedByTaskKey,
    workItemHandlers: opts.workItemHandlers,
    onEdit
  })
}
