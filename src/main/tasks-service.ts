import { listAccounts } from './accounts'
import type { ConnectedAccount, TaskItemRow, TaskListRow, TaskSaveRecurrence } from '@shared/types'
import { mergeCloudTasksRecurrenceFromCache } from './db/cloud-tasks-repo'
import {
  graphCreateTodoTask,
  graphDeleteTodoTask,
  graphListTodoLists,
  graphListTodoTasks,
  graphPatchTodoTask,
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
  }
): Promise<TaskItemRow> {
  const acc = await resolveConnectedAccount(accountId)
  if (input.recurrence && !input.dueIso?.trim()) {
    throw new Error('Wiederholende Aufgabe: Faelligkeitsdatum ist erforderlich.')
  }
  if (acc.provider === 'google') {
    const row = await googleInsertTask(accountId, listId, input)
    if (input.recurrence) {
      return {
        ...row,
        recurrence: input.recurrence,
        recurrenceLocalOnly: true
      }
    }
    return row
  }
  return graphCreateTodoTask(accountId, listId, input)
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
  }
): Promise<TaskItemRow> {
  const acc = await resolveConnectedAccount(accountId)
  if (acc.provider === 'google') {
    return googlePatchTask(accountId, listId, taskId, patch)
  }
  return graphPatchTodoTask(accountId, listId, taskId, patch)
}

export async function updateTaskForAccount(
  accountId: string,
  listId: string,
  taskId: string,
  input: { title: string; notes?: string | null; dueIso?: string | null; completed?: boolean }
): Promise<TaskItemRow> {
  const acc = await resolveConnectedAccount(accountId)
  if (acc.provider === 'google') {
    return googleUpdateTask(accountId, listId, taskId, input)
  }
  return graphUpdateTodoTask(accountId, listId, taskId, input)
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
