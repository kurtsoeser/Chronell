import { listAccounts } from './accounts'
import type { ConnectedAccount, TaskItemRow, TaskListRow, TaskSaveRecurrence } from '@shared/types'
import { mergeCloudTasksRecurrenceFromCache, setCloudTaskRecurrence } from './db/cloud-tasks-repo'
import {
  graphCreateTodoTask,
  graphDeleteTodoTask,
  graphListTodoLists,
  graphListTodoTasks,
  graphPatchTodoTask,
  graphPatchTodoTaskRecurrence,
  graphUpdateTodoTask
} from './graph/tasks-graph'
import {
  googleDeleteTask,
  googleInsertTask,
  googleListTaskLists,
  googleListTasksInList,
  googlePatchTask,
  googleUpdateTask
} from './google/tasks-google'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { clearMailCloudTaskLinksForDeletedTask } from './mail-cloud-task-link-service'
import { clearTaskPlannedSchedule } from './task-planned-schedule-service'
import { runGraphMailboxRequest } from './graph/graph-account-request'

function applyRecurrenceToTaskRow(
  row: TaskItemRow,
  recurrence: TaskSaveRecurrence | null,
  localOnly: boolean
): TaskItemRow {
  if (recurrence) {
    return { ...row, recurrence, recurrenceLocalOnly: localOnly }
  }
  const { recurrence: _r, recurrenceLocalOnly: _l, ...rest } = row
  return rest
}

/** Nach Upsert: Serien-Metadatum explizit setzen (Upsert-COALESCE wuerde sonst alte/null Werte behalten). */
export function persistTaskRecurrenceToCache(
  accountId: string,
  listId: string,
  taskId: string,
  recurrence: TaskSaveRecurrence | null | undefined,
  localOnly: boolean
): void {
  if (recurrence === undefined) return
  setCloudTaskRecurrence(accountId, listId, taskId, recurrence, localOnly && recurrence !== null)
}

async function resolveConnectedAccount(accountId: string): Promise<ConnectedAccount> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc) {
    throw new Error('Konto nicht gefunden.')
  }
  if (acc.provider !== 'microsoft' && acc.provider !== 'google') {
    throw new Error('Aufgaben werden fuer dieses Konto nicht unterstuetzt.')
  }
  return acc
}

export async function listTaskListsForAccount(accountId: string): Promise<TaskListRow[]> {
  const acc = await resolveConnectedAccount(accountId)
  if (acc.provider === 'google') {
    return googleListTaskLists(accountId)
  }
  return runGraphMailboxRequest(accountId, 'listTodoLists', () => graphListTodoLists(accountId))
}

export async function listTasksForAccount(
  accountId: string,
  listId: string,
  opts?: { showCompleted?: boolean; showHidden?: boolean }
): Promise<TaskItemRow[]> {
  const acc = await resolveConnectedAccount(accountId)
  let tasks: TaskItemRow[]
  if (acc.provider === 'google') {
    tasks = await googleListTasksInList(accountId, listId, opts)
  } else {
    tasks = await runGraphMailboxRequest(accountId, `listTodoTasks ${listId}`, () =>
      graphListTodoTasks(accountId, listId, opts)
    )
  }
  return mergeCloudTasksRecurrenceFromCache(accountId, listId, tasks)
}

export async function createTaskForAccount(
  accountId: string,
  listId: string,
  input: {
    title: string
    notes?: string | null
    dueIso?: string | null
    completed?: boolean
    recurrence?: TaskSaveRecurrence | null
    categories?: string[] | null
  }
): Promise<TaskItemRow> {
  const acc = await resolveConnectedAccount(accountId)
  if (input.recurrence && !input.dueIso?.trim()) {
    throw new Error('Wiederholende Aufgabe: Faelligkeitsdatum ist erforderlich.')
  }
  if (acc.provider === 'google') {
    const row = await googleInsertTask(accountId, listId, {
      title: input.title,
      notes: input.notes,
      dueIso: input.dueIso,
      completed: input.completed,
      recurrence: input.recurrence
    })
    if (input.recurrence) {
      return applyRecurrenceToTaskRow(row, input.recurrence, true)
    }
    return row
  }
  const row = await graphCreateTodoTask(accountId, listId, input)
  if (input.recurrence) {
    return applyRecurrenceToTaskRow(row, row.recurrence ?? input.recurrence, false)
  }
  return row
}

export async function patchTaskForAccount(
  accountId: string,
  listId: string,
  taskId: string,
  patch: {
    title?: string | null
    notes?: string | null
    dueIso?: string | null
    completed?: boolean
    categories?: string[] | null
  }
): Promise<TaskItemRow> {
  const acc = await resolveConnectedAccount(accountId)
  if (acc.provider === 'google') {
    return googlePatchTask(accountId, listId, taskId, {
      title: patch.title,
      notes: patch.notes,
      dueIso: patch.dueIso,
      completed: patch.completed
    })
  }
  return graphPatchTodoTask(accountId, listId, taskId, patch)
}

export async function updateTaskForAccount(
  accountId: string,
  listId: string,
  taskId: string,
  input: {
    title: string
    notes?: string | null
    dueIso?: string | null
    completed?: boolean
    categories?: string[] | null
    recurrence?: TaskSaveRecurrence | null
  }
): Promise<TaskItemRow> {
  const acc = await resolveConnectedAccount(accountId)
  if (input.recurrence && !input.dueIso?.trim()) {
    throw new Error('Wiederholende Aufgabe: Faelligkeitsdatum ist erforderlich.')
  }
  const { recurrence, ...baseInput } = input

  if (acc.provider === 'google') {
    const row = await googleUpdateTask(accountId, listId, taskId, baseInput)
    if (recurrence === undefined) return row
    return applyRecurrenceToTaskRow(row, recurrence, true)
  }

  let row = await graphUpdateTodoTask(accountId, listId, taskId, baseInput)
  if (recurrence === undefined) return row

  if (recurrence && baseInput.dueIso?.trim()) {
    try {
      row = await graphPatchTodoTaskRecurrence(
        accountId,
        listId,
        taskId,
        recurrence,
        String(baseInput.dueIso)
      )
    } catch (e) {
      console.warn('[tasks] Graph-Serien-Patch fehlgeschlagen, lokal gespeichert:', e)
    }
  } else if (recurrence === null) {
    try {
      row = await graphPatchTodoTask(accountId, listId, taskId, { recurrence: null })
    } catch (e) {
      console.warn('[tasks] Graph-Serien-Entfernen fehlgeschlagen, lokal entfernt:', e)
    }
  }

  return applyRecurrenceToTaskRow(row, recurrence, false)
}

export async function deleteTaskForAccount(accountId: string, listId: string, taskId: string): Promise<void> {
  const acc = await resolveConnectedAccount(accountId)
  if (acc.provider === 'google') {
    await googleDeleteTask(accountId, listId, taskId)
  } else {
    await graphDeleteTodoTask(accountId, listId, taskId)
  }
  clearTaskPlannedSchedule(cloudTaskStableKey(accountId, listId, taskId))
  clearMailCloudTaskLinksForDeletedTask(accountId, listId, taskId)
}
