import {
  NOTE_CLOUD_TASK_ITEM_CLASS,
  parseNoteCloudTaskRefFromElement
} from '@shared/note-cloud-task'
import type { TaskItemRow } from '@shared/types'

export interface NoteCloudTaskSyncState {
  accountId: string
  listId: string
  taskId: string
  completed: boolean
  title: string
  dueIso: string | null
}

function collectCloudTaskItems(doc: Document): HTMLLIElement[] {
  return Array.from(doc.querySelectorAll(`li.${NOTE_CLOUD_TASK_ITEM_CLASS}`)).filter(
    (el): el is HTMLLIElement => el instanceof HTMLLIElement
  )
}

export function extractNoteCloudTaskRefsFromHtml(html: string): Array<{
  ref: ReturnType<typeof parseNoteCloudTaskRefFromElement>
  completed: boolean
}> {
  if (!html.trim()) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: Array<{
    ref: NonNullable<ReturnType<typeof parseNoteCloudTaskRefFromElement>>
    completed: boolean
  }> = []
  for (const li of collectCloudTaskItems(doc)) {
    const ref = parseNoteCloudTaskRefFromElement(li)
    if (!ref) continue
    out.push({
      ref,
      completed: li.getAttribute('data-checked') === 'true'
    })
  }
  return out
}

export function syncNoteCloudTasksInHtml(
  html: string,
  states: Map<string, NoteCloudTaskSyncState>
): string {
  if (!html.trim() || states.size === 0) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let changed = false
  for (const li of collectCloudTaskItems(doc)) {
    const ref = parseNoteCloudTaskRefFromElement(li)
    if (!ref) continue
    const state = states.get(`${ref.accountId}:${ref.listId}:${ref.taskId}`)
    if (!state) continue
    const nextChecked = state.completed ? 'true' : 'false'
    if (li.getAttribute('data-checked') !== nextChecked) {
      li.setAttribute('data-checked', nextChecked)
      changed = true
    }
  }
  if (!changed) return html
  return doc.body.innerHTML
}

export function taskRowToSyncState(
  row: TaskItemRow,
  accountId: string,
  listId: string
): NoteCloudTaskSyncState {
  return {
    accountId,
    listId,
    taskId: row.id,
    completed: row.completed,
    title: row.title,
    dueIso: row.dueIso
  }
}

export function syncStateKey(state: Pick<NoteCloudTaskSyncState, 'accountId' | 'listId' | 'taskId'>): string {
  return `${state.accountId}:${state.listId}:${state.taskId}`
}
