import type { TFunction } from 'i18next'
import { Copy, Pencil } from 'lucide-react'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import type { ContextMenuItem } from '@/components/ContextMenu'
import {
  buildWorkItemContextMenuItems,
  type WorkItemContextHandlers
} from '@/app/work-items/work-item-context-menu'
import { mailListItemToWorkItem, taskItemToWorkItem } from '@/app/work-items/work-item-mapper'
import { isMailTodoListItem, type TasksListItem } from '@/app/tasks/tasks-types'

export type TasksListContextMenuOptions = {
  t: TFunction
  /** Im Aufgaben-Modul: „Im Aufgaben-Modul öffnen“ ausblenden. */
  inTasksModule?: boolean
  plannedByTaskKey?: ReadonlyMap<string, WorkItemPlannedSchedule>
  workItemHandlers: WorkItemContextHandlers
  onEdit?: (task: TasksListItem) => void
}

export async function buildTasksListContextMenuItems(
  task: TasksListItem,
  anchor: { x: number; y: number },
  opts: TasksListContextMenuOptions
): Promise<ContextMenuItem[]> {
  const { t, inTasksModule, plannedByTaskKey, workItemHandlers, onEdit } = opts
  const workItem = isMailTodoListItem(task)
    ? mailListItemToWorkItem(task.mail)
    : taskItemToWorkItem(task, { plannedByTaskKey })

  const head: ContextMenuItem[] = []
  if (onEdit) {
    head.push({
      id: 'tasks-ctx-edit',
      label: t('tasks.context.edit'),
      icon: Pencil,
      onSelect: (): void => onEdit(task)
    })
  }
  const title = task.title.trim()
  if (title.length > 0) {
    head.push({
      id: 'tasks-ctx-copy-title',
      label: t('tasks.context.copyTitle'),
      icon: Copy,
      onSelect: (): void => {
        void navigator.clipboard?.writeText(title)
      }
    })
  }

  const workItems = await buildWorkItemContextMenuItems(workItem, anchor, workItemHandlers)
  const filtered = inTasksModule ? workItems.filter((i) => i.id !== 'work-open-tasks') : workItems

  const sep =
    head.length > 0 ? [{ id: 'tasks-ctx-sep-head', label: '', separator: true as const }] : []
  return [...head, ...sep, ...filtered]
}
