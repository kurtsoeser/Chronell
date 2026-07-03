import {
  NOTE_CLOUD_TASK_ACCOUNT_ATTR,
  NOTE_CLOUD_TASK_DUE_ATTR,
  NOTE_CLOUD_TASK_DUE_CLASS,
  NOTE_CLOUD_TASK_ID_ATTR,
  NOTE_CLOUD_TASK_ITEM_CLASS,
  NOTE_CLOUD_TASK_LIST_ATTR,
  type NoteCloudTaskRef
} from '@shared/note-cloud-task'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface BuildNoteCloudTaskInsertHtmlInput {
  title: string
  completed?: boolean
  dueIso?: string | null
  ref: NoteCloudTaskRef
  dueLabel?: string | null
}

export function buildNoteCloudTaskInsertHtml(input: BuildNoteCloudTaskInsertHtmlInput): string {
  const title = input.title.trim() || '—'
  const checked = input.completed ? 'true' : 'false'
  const dueAttr =
    input.dueIso && input.dueIso.trim()
      ? ` ${NOTE_CLOUD_TASK_DUE_ATTR}="${escapeHtml(input.dueIso.trim())}"`
      : ''
  const dueMarkup =
    input.dueLabel && input.dueLabel.trim()
      ? ` <span class="${NOTE_CLOUD_TASK_DUE_CLASS}">${escapeHtml(input.dueLabel.trim())}</span>`
      : ''
  return (
    `<ul data-type="taskList">` +
    `<li data-type="taskItem" data-checked="${checked}" class="note-task-item ${NOTE_CLOUD_TASK_ITEM_CLASS}"` +
    ` ${NOTE_CLOUD_TASK_ACCOUNT_ATTR}="${escapeHtml(input.ref.accountId)}"` +
    ` ${NOTE_CLOUD_TASK_LIST_ATTR}="${escapeHtml(input.ref.listId)}"` +
    ` ${NOTE_CLOUD_TASK_ID_ATTR}="${escapeHtml(input.ref.taskId)}"${dueAttr}>` +
    `<p>${escapeHtml(title)}${dueMarkup}</p>` +
    `</li></ul>`
  )
}
