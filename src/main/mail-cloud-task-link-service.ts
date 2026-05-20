import type { MailCloudTaskLinkDto, TaskItemRow } from '@shared/types'
import { getMessageById } from './db/messages-repo'
import {
  cloudTaskEntityRef,
  mailTodoEntityRef,
  rewireEntityLinks
} from './db/entity-links-repo'
import {
  deleteMailCloudTaskLinksForTask,
  insertMailCloudTaskLink,
  listAllMailCloudTaskLinks,
  type MailCloudTaskLinkRow
} from './db/mail-cloud-task-link-repo'
import { getDb } from './db/index'
import { getTodoById, markTodoDone } from './db/todos-repo'
import { createTaskForAccount } from './tasks-service'

function rowToDto(r: MailCloudTaskLinkRow): MailCloudTaskLinkDto {
  return {
    messageId: r.messageId,
    accountId: r.accountId,
    listId: r.listId,
    taskId: r.taskId
  }
}

export function listMailCloudTaskLinkDtos(): MailCloudTaskLinkDto[] {
  return listAllMailCloudTaskLinks().map(rowToDto)
}

export interface CreateMailCloudTaskFromMessageInput {
  messageId: number
  accountId: string
  listId: string
  title: string
  notes?: string | null
  dueIso?: string | null
}

export async function createMailCloudTaskFromMessage(
  input: CreateMailCloudTaskFromMessageInput
): Promise<TaskItemRow> {
  const messageId = input.messageId
  const accountId = input.accountId.trim()
  const listId = input.listId.trim()
  const title = input.title.trim()
  if (!accountId || !listId) throw new Error('Konto oder Liste fehlt.')
  if (!title) throw new Error('Titel fehlt.')

  const msg = getMessageById(messageId)
  if (!msg) throw new Error('Mail nicht gefunden.')
  if (msg.accountId !== accountId) {
    throw new Error('Die Mail gehört nicht zu diesem Konto.')
  }

  const task = await createTaskForAccount(accountId, listId, {
    title,
    notes: input.notes ?? null,
    dueIso: input.dueIso ?? null,
    completed: false
  })

  insertMailCloudTaskLink({
    messageId,
    accountId,
    listId,
    taskId: task.id
  })

  const openTodoId = findOpenTodoIdForMessage(messageId)
  if (openTodoId) {
    rewireEntityLinks(
      mailTodoEntityRef(openTodoId),
      cloudTaskEntityRef(accountId, listId, task.id)
    )
  }

  return task
}

export interface PromoteMailTodoToCloudTaskInput {
  todoId: number
  accountId: string
  listId: string
  title: string
  notes?: string | null
  dueIso?: string | null
}

/** Mail-ToDo in Cloud-Aufgabe ueberfuehren; Verknuepfungen am ToDo-Knoten werden umgehaengt. */
export async function promoteMailTodoToCloudTask(
  input: PromoteMailTodoToCloudTaskInput
): Promise<TaskItemRow> {
  const todoId = input.todoId
  const accountId = input.accountId.trim()
  const listId = input.listId.trim()
  const title = input.title.trim()
  if (!accountId || !listId) throw new Error('Konto oder Liste fehlt.')
  if (!title) throw new Error('Titel fehlt.')

  const todo = getTodoById(todoId)
  if (!todo) throw new Error('Mail-ToDo nicht gefunden.')
  if (todo.status !== 'open') throw new Error('Nur offene Mail-ToDos koennen ueberfuehrt werden.')

  const msg = getMessageById(todo.messageId)
  if (!msg) throw new Error('Mail nicht gefunden.')

  const task = await createTaskForAccount(accountId, listId, {
    title,
    notes: input.notes ?? null,
    dueIso: input.dueIso ?? null,
    completed: false
  })

  insertMailCloudTaskLink({
    messageId: todo.messageId,
    accountId,
    listId,
    taskId: task.id
  })

  rewireEntityLinks(
    mailTodoEntityRef(todoId),
    cloudTaskEntityRef(accountId, listId, task.id)
  )

  markTodoDone(todoId)
  return task
}

function findOpenTodoIdForMessage(messageId: number): number | null {
  const r = getDb()
    .prepare(
      `SELECT id FROM todos WHERE message_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`
    )
    .get(messageId) as { id: number } | undefined
  return r?.id ?? null
}

export function clearMailCloudTaskLinksForDeletedTask(
  accountId: string,
  listId: string,
  taskId: string
): void {
  deleteMailCloudTaskLinksForTask(accountId, listId, taskId)
}
