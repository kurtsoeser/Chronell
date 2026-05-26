import type { MailListItem, TaskItemRow } from '@shared/types'

export const MAIL_TASK_LIST_ID = '__mail_todo__'

export type TasksViewSelection =
  | { kind: 'list'; accountId: string; listId: string }
  | { kind: 'unified' }

export type TaskItemWithContext = TaskItemRow & {
  accountId: string
  listName: string
}

export type MailTodoListItem = {
  source: 'mail'
  accountId: string
  listId: typeof MAIL_TASK_LIST_ID
  id: string
  listName: string
  title: string
  dueIso: string | null
  completed: boolean
  notes: string | null
  iconId: string | null
  iconColor: string | null
  messageId: number
  mail: MailListItem
}

export type CloudTaskListItem = TaskItemWithContext & { source: 'cloud' }

export type TasksListItem = CloudTaskListItem | MailTodoListItem

export function isMailTodoListItem(item: TasksListItem): item is MailTodoListItem {
  return item.source === 'mail'
}

export function isCloudTaskListItem(item: TasksListItem): item is CloudTaskListItem {
  return item.source === 'cloud'
}

export function tasksListItemKey(item: Pick<TasksListItem, 'source' | 'accountId' | 'listId' | 'id'>): string {
  if (item.source === 'mail') return `mail:${item.accountId}:${item.id}`
  return `${item.accountId}:${item.listId}:${item.id}`
}

/** @deprecated Alias für Cloud-Aufgaben */
export function taskItemKey(item: Pick<TaskItemWithContext, 'accountId' | 'listId' | 'id'>): string {
  return `${item.accountId}:${item.listId}:${item.id}`
}
