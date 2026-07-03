import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import {
  NOTE_CLOUD_TASK_ACCOUNT_ATTR,
  NOTE_CLOUD_TASK_DUE_ATTR,
  NOTE_CLOUD_TASK_ID_ATTR,
  NOTE_CLOUD_TASK_LIST_ATTR
} from '@shared/note-cloud-task'

function cloudTaskStringAttr(attrName: string, key: string) {
  return {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.getAttribute(attrName),
    renderHTML: (attributes: Record<string, string | null>) => {
      const value = attributes[key]
      if (!value) return {}
      return { [attrName]: value }
    }
  }
}

/** TaskItem mit optionaler Cloud-Aufgaben-Referenz (Outlook / Google Tasks). */
export const NoteCloudTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cloudTaskAccountId: cloudTaskStringAttr(NOTE_CLOUD_TASK_ACCOUNT_ATTR, 'cloudTaskAccountId'),
      cloudTaskListId: cloudTaskStringAttr(NOTE_CLOUD_TASK_LIST_ATTR, 'cloudTaskListId'),
      cloudTaskId: cloudTaskStringAttr(NOTE_CLOUD_TASK_ID_ATTR, 'cloudTaskId'),
      cloudTaskDueIso: cloudTaskStringAttr(NOTE_CLOUD_TASK_DUE_ATTR, 'cloudTaskDueIso')
    }
  }
}).configure({
  nested: true,
  HTMLAttributes: {
    class: 'note-task-item',
    'data-type': 'taskItem'
  }
})

export const NoteCloudTaskList = TaskList.configure({
  HTMLAttributes: { class: 'note-task-list', 'data-type': 'taskList' }
})

export function isCloudTaskItemAttrs(attrs: Record<string, unknown>): boolean {
  return (
    typeof attrs.cloudTaskAccountId === 'string' &&
    attrs.cloudTaskAccountId.length > 0 &&
    typeof attrs.cloudTaskListId === 'string' &&
    attrs.cloudTaskListId.length > 0 &&
    typeof attrs.cloudTaskId === 'string' &&
    attrs.cloudTaskId.length > 0
  )
}
