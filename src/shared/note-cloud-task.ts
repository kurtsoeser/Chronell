/** HTML-Attribute für eingebettete Cloud-Aufgaben (Microsoft To Do / Google Tasks). */
export const NOTE_CLOUD_TASK_ACCOUNT_ATTR = 'data-chronell-cloud-task-account' as const
export const NOTE_CLOUD_TASK_LIST_ATTR = 'data-chronell-cloud-task-list' as const
export const NOTE_CLOUD_TASK_ID_ATTR = 'data-chronell-cloud-task-id' as const
export const NOTE_CLOUD_TASK_DUE_ATTR = 'data-chronell-cloud-task-due' as const

export const NOTE_CLOUD_TASK_ITEM_CLASS = 'note-cloud-task-item' as const
export const NOTE_CLOUD_TASK_DUE_CLASS = 'note-cloud-task-due' as const

export const NOTE_CLOUD_TASK_HTML_ATTRS = [
  NOTE_CLOUD_TASK_ACCOUNT_ATTR,
  NOTE_CLOUD_TASK_LIST_ATTR,
  NOTE_CLOUD_TASK_ID_ATTR,
  NOTE_CLOUD_TASK_DUE_ATTR
] as const

export interface NoteCloudTaskRef {
  accountId: string
  listId: string
  taskId: string
}

export function noteCloudTaskRefKey(ref: NoteCloudTaskRef): string {
  return `task:${ref.accountId}:${ref.listId}:${ref.taskId}`
}

export function noteCloudTaskRefsEqual(a: NoteCloudTaskRef, b: NoteCloudTaskRef): boolean {
  return noteCloudTaskRefKey(a) === noteCloudTaskRefKey(b)
}

export interface NoteCloudTaskDomNode {
  getAttribute(name: string): string | null
}

export function parseNoteCloudTaskRefFromElement(element: NoteCloudTaskDomNode): NoteCloudTaskRef | null {
  const accountId = element.getAttribute(NOTE_CLOUD_TASK_ACCOUNT_ATTR)?.trim()
  const listId = element.getAttribute(NOTE_CLOUD_TASK_LIST_ATTR)?.trim()
  const taskId = element.getAttribute(NOTE_CLOUD_TASK_ID_ATTR)?.trim()
  if (!accountId || !listId || !taskId) return null
  return { accountId, listId, taskId }
}

export function isNoteCloudTaskChecked(element: NoteCloudTaskDomNode): boolean {
  return element.getAttribute('data-checked') === 'true'
}
