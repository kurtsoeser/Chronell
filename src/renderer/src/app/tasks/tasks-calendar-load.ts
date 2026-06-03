import type { ConnectedAccount, TaskListRow } from '@shared/types'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import {
  cloudTaskVisualSpan,
  cloudTaskVisualSpanForMode,
  type CloudTaskCalendarDateMode
} from '@/app/calendar/cloud-task-calendar'
import type { TaskListFilter } from '@/app/tasks/task-list-arrange'
import { classifyTaskItemDueBucket } from '@/app/tasks/task-due-bucket'
import type { CloudTaskListItem, TasksViewSelection } from '@/app/tasks/tasks-types'

/** Signatur für Kalender-Layer: verhindert FullCalendar-Redraw bei unveränderten Daten. */
export function cloudTaskCalendarDisplaySignature(
  items: CloudTaskListItem[],
  plannedByTaskKey: ReadonlyMap<string, WorkItemPlannedSchedule>
): string {
  const parts = items.map((task) => {
    const key = cloudTaskStableKey(task.accountId, task.listId, task.id)
    const p = plannedByTaskKey.get(key)
    return `${key}\t${task.title}\t${task.completed ? 1 : 0}\t${task.dueIso ?? ''}\t${p?.plannedStartIso ?? ''}\t${p?.plannedEndIso ?? ''}`
  })
  parts.sort()
  return parts.join('\n')
}

/** Alle Aufgaben eines Kontos (Cache oder mit optionalem Hintergrund-Sync). */
export async function loadCloudTasksForAccount(
  accountId: string,
  opts?: { cacheOnly?: boolean }
): Promise<CloudTaskListItem[]> {
  const cacheOnly = opts?.cacheOnly === true
  let lists: TaskListRow[]
  try {
    lists = await window.mailClient.tasks.listLists({ accountId, cacheOnly })
  } catch {
    return []
  }
  const merged: CloudTaskListItem[] = []
  for (const list of lists) {
    try {
      const rows = await window.mailClient.tasks.listTasks({
        accountId,
        listId: list.id,
        showCompleted: true,
        showHidden: false,
        cacheOnly
      })
      for (const row of rows) {
        merged.push({ ...row, accountId, listName: list.name, source: 'cloud' })
      }
    } catch {
      // eine Liste ueberspringen
    }
  }
  return merged
}

/** Alle Cloud-Aufgaben verbundener Konten (Hauptkalender-Layer). */
export async function loadUnifiedCloudTasks(
  taskAccounts: ConnectedAccount[],
  opts?: { cacheOnly?: boolean; forceRefresh?: boolean }
): Promise<CloudTaskListItem[]> {
  const cacheOnly = opts?.cacheOnly === true
  const forceRefresh = opts?.forceRefresh === true
  const perAccount = await Promise.all(
    taskAccounts.map(async (acc): Promise<CloudTaskListItem[]> => {
      let lists: TaskListRow[]
      try {
        lists = await window.mailClient.tasks.listLists({
          accountId: acc.id,
          cacheOnly,
          forceRefresh: forceRefresh && !cacheOnly
        })
      } catch {
        return []
      }
      const perList = await Promise.all(
        lists.map(async (list): Promise<CloudTaskListItem[]> => {
          try {
            const rows = await window.mailClient.tasks.listTasks({
              accountId: acc.id,
              listId: list.id,
              showCompleted: true,
              showHidden: false,
              cacheOnly,
              forceRefresh: forceRefresh && !cacheOnly
            })
            return rows.map((row) => ({
              ...row,
              accountId: acc.id,
              listName: list.name,
              source: 'cloud' as const
            }))
          } catch {
            return []
          }
        })
      )
      return perList.flat()
    })
  )
  return perAccount.flat()
}

export async function loadCloudTasksForSelection(
  selection: TasksViewSelection | null,
  taskAccounts: ConnectedAccount[],
  listsByAccount: Record<string, TaskListRow[] | undefined>,
  loadListsForAccount: (accountId: string) => Promise<TaskListRow[]>
): Promise<CloudTaskListItem[]> {
  if (!selection) return []

  if (selection.kind === 'list') {
    const listArgs = {
      accountId: selection.accountId,
      listId: selection.listId,
      showCompleted: true as const,
      showHidden: false as const
    }
    let rows = await window.mailClient.tasks.listTasks({ ...listArgs, cacheOnly: true })
    if (rows.length === 0) {
      rows = await window.mailClient.tasks.listTasks(listArgs)
    }
    const listName =
      listsByAccount[selection.accountId]?.find((l) => l.id === selection.listId)?.name ?? ''
    return rows.map((row) => ({
      ...row,
      accountId: selection.accountId,
      listName,
      source: 'cloud' as const
    }))
  }

  const merged: CloudTaskListItem[] = []
  for (const acc of taskAccounts) {
    let lists = listsByAccount[acc.id]
    if (lists === undefined) {
      lists = await loadListsForAccount(acc.id)
    }
    for (const list of lists ?? []) {
      try {
        const listArgs = {
          accountId: acc.id,
          listId: list.id,
          showCompleted: true as const,
          showHidden: false as const
        }
        let rows = await window.mailClient.tasks.listTasks({ ...listArgs, cacheOnly: true })
        if (rows.length === 0) {
          rows = await window.mailClient.tasks.listTasks(listArgs)
        }
        for (const row of rows) {
          merged.push({ ...row, accountId: acc.id, listName: list.name, source: 'cloud' })
        }
      } catch {
        // ein Konto/Liste ueberspringen
      }
    }
  }
  return merged
}

export function filterCloudTasksInCalendarRange(
  items: CloudTaskListItem[],
  plannedByTaskKey: ReadonlyMap<string, WorkItemPlannedSchedule>,
  rangeStart: Date,
  rangeEnd: Date,
  filter: TaskListFilter = 'all',
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateMode?: CloudTaskCalendarDateMode
): CloudTaskListItem[] {
  const startMs = rangeStart.getTime()
  const endMs = rangeEnd.getTime()
  return items.filter((task) => {
    if (filter === 'open' && task.completed) return false
    if (filter === 'completed' && !task.completed) return false
    if (filter === 'overdue') {
      if (task.completed) return false
      if (classifyTaskItemDueBucket(task, timeZone) !== 'overdue') return false
    }
    const key = cloudTaskStableKey(task.accountId, task.listId, task.id)
    const planned = plannedByTaskKey.get(key)
    const span = dateMode
      ? cloudTaskVisualSpanForMode(task, planned ?? null, dateMode, timeZone)
      : cloudTaskVisualSpan(task, planned ?? null, timeZone)
    if (!span) return false
    return span.endMs > startMs && span.startMs < endMs
  })
}
