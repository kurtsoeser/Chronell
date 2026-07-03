import type { NoteEntityLinkTarget } from '@shared/note-entity-links'
import {
  isNoteCloudTaskChecked,
  NOTE_CLOUD_TASK_ITEM_CLASS,
  parseNoteCloudTaskRefFromElement,
  type NoteCloudTaskRef
} from '@shared/note-cloud-task'
import type { TaskItemRow } from '@shared/types'
import { buildNoteCloudTaskInsertHtml } from '@/lib/note-cloud-task-export'
import { formatNoteCloudTaskDueLabel } from '@/lib/note-cloud-task-format'

export interface InsertNoteCloudTaskInput {
  noteId: number
  title: string
  dueIso?: string | null
  completed?: boolean
  accountId: string
  listId: string
  dueLabel?: string | null
}

export interface InsertNoteCloudTaskResult {
  task: TaskItemRow
  ref: NoteCloudTaskRef
  html: string
}

export async function createAndLinkNoteCloudTask(
  input: InsertNoteCloudTaskInput
): Promise<InsertNoteCloudTaskResult> {
  const task = await window.mailClient.tasks.createTask({
    accountId: input.accountId,
    listId: input.listId,
    title: input.title.trim(),
    dueIso: input.dueIso ?? null,
    completed: input.completed ?? false
  })
  const ref: NoteCloudTaskRef = {
    accountId: input.accountId,
    listId: input.listId,
    taskId: task.id
  }
  const target: NoteEntityLinkTarget = { kind: 'cloud_task', ...ref }
  await window.mailClient.notes.links.add({ fromNoteId: input.noteId, target })
  const html = buildNoteCloudTaskInsertHtml({
    title: input.title,
    completed: input.completed ?? false,
    dueIso: input.dueIso ?? null,
    dueLabel: input.dueLabel ?? formatNoteCloudTaskDueLabel(input.dueIso ?? null, navigator.language),
    ref
  })
  return { task, ref, html }
}

export function cloudTaskRefFromEventTarget(target: EventTarget | null): NoteCloudTaskRef | null {
  if (!target || typeof target !== 'object') return null
  const element = target as HTMLElement
  if (typeof element.closest !== 'function') return null
  const li = element.closest(`li.${NOTE_CLOUD_TASK_ITEM_CLASS}, li[data-chronell-cloud-task-id]`)
  if (!li) return null
  return parseNoteCloudTaskRefFromElement(li)
}

export function isCloudTaskCheckboxClick(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as HTMLElement
  const li = element.closest?.('li[data-type="taskItem"]')
  if (!li || !parseNoteCloudTaskRefFromElement(li)) return false
  const label = li.querySelector('label')
  if (!label) return false
  return label === element || label.contains(element)
}

export async function patchNoteCloudTaskCompleted(
  ref: NoteCloudTaskRef,
  completed: boolean
): Promise<TaskItemRow> {
  return window.mailClient.tasks.patchTask({
    accountId: ref.accountId,
    listId: ref.listId,
    taskId: ref.taskId,
    completed
  })
}

export function readCloudTaskCompletedFromDom(target: EventTarget | null): boolean | null {
  if (!target || typeof target !== 'object') return null
  const element = target as HTMLElement
  const li = element.closest?.('li[data-type="taskItem"]')
  if (!li || !parseNoteCloudTaskRefFromElement(li)) return null
  return isNoteCloudTaskChecked(li)
}
