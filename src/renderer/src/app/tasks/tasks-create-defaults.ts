import type { ConnectedAccount, TaskListRow } from '@shared/types'
import { readTasksCalendarCreateAccountId } from '@/app/tasks/tasks-calendar-create-storage'
import type { TasksViewSelection } from '@/app/tasks/tasks-types'

export function pickDefaultListId(rows: TaskListRow[]): string | null {
  if (rows.length === 0) return null
  return rows.find((r) => r.isDefault)?.id ?? rows[0]!.id
}

export function resolvePreferredAccountId(
  taskAccounts: ConnectedAccount[],
  selection: TasksViewSelection | null
): string {
  if (selection?.kind === 'list') {
    const hit = taskAccounts.find((a) => a.id === selection.accountId)
    if (hit) return hit.id
  }
  const stored = readTasksCalendarCreateAccountId()
  if (stored && taskAccounts.some((a) => a.id === stored)) return stored
  return taskAccounts[0]?.id ?? ''
}

export function resolvePreferredListId(
  selection: TasksViewSelection | null,
  accountId: string,
  lists: TaskListRow[]
): string {
  if (selection?.kind === 'list' && selection.accountId === accountId && selection.listId) {
    if (lists.some((l) => l.id === selection.listId)) return selection.listId
  }
  return pickDefaultListId(lists) ?? ''
}
