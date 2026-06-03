import {
  tasksListItemKey,
  type CloudTaskListItem,
  type TasksViewSelection
} from '@/app/tasks/tasks-types'
import type { TaskItemRow } from '@shared/types'

export const PENDING_CLOUD_TASK_PREFIX = 'pending:'

export function isPendingCloudTaskId(id: string): boolean {
  return id.startsWith(PENDING_CLOUD_TASK_PREFIX)
}

export type TaskCreateUpsertMeta = {
  /** Ersetzt eine zuvor optimistisch eingefügte Zeile. */
  replacePendingId?: string
  /** Entfernt eine fehlgeschlagene optimistische Zeile. */
  removePendingId?: string
}

export function buildOptimisticCloudTaskItem(args: {
  accountId: string
  listId: string
  listName: string
  title: string
  notes: string | null
  dueIso: string | null
}): CloudTaskListItem {
  return {
    id: `${PENDING_CLOUD_TASK_PREFIX}${crypto.randomUUID()}`,
    listId: args.listId,
    title: args.title.trim() || '(Ohne Titel)',
    completed: false,
    dueIso: args.dueIso,
    notes: args.notes?.trim() ? args.notes.trim() : null,
    iconId: null,
    iconColor: null,
    accountId: args.accountId,
    listName: args.listName,
    source: 'cloud'
  }
}

export function upsertCloudTaskInList(
  items: CloudTaskListItem[],
  task: CloudTaskListItem,
  meta?: TaskCreateUpsertMeta
): CloudTaskListItem[] {
  if (meta?.removePendingId) {
    return removeCloudTaskById(items, meta.removePendingId)
  }
  const replaceId = meta?.replacePendingId
  if (replaceId) {
    const idx = items.findIndex((x) => x.id === replaceId)
    if (idx >= 0) {
      const next = [...items]
      next[idx] = task
      return next
    }
  }
  const key = tasksListItemKey(task)
  const existing = items.findIndex((x) => tasksListItemKey(x) === key)
  if (existing >= 0) {
    const next = [...items]
    next[existing] = task
    return next
  }
  return [...items, task]
}

export function removeCloudTaskById(items: CloudTaskListItem[], id: string): CloudTaskListItem[] {
  return items.filter((x) => x.id !== id)
}

export function cloudTaskMatchesListSelection(
  task: Pick<CloudTaskListItem, 'accountId' | 'listId'>,
  selection: TasksViewSelection | null,
  isUnified: boolean
): boolean {
  if (isUnified) return true
  return (
    selection?.kind === 'list' &&
    selection.accountId === task.accountId &&
    selection.listId === task.listId
  )
}

export function cloudTaskToListRow(task: CloudTaskListItem): TaskItemRow {
  return {
    id: task.id,
    listId: task.listId,
    title: task.title,
    completed: task.completed,
    dueIso: task.dueIso,
    notes: task.notes,
    iconId: task.iconId ?? null,
    iconColor: task.iconColor ?? null,
    recurrence: task.recurrence,
    recurrenceLocalOnly: task.recurrenceLocalOnly,
    categories: task.categories
  }
}
