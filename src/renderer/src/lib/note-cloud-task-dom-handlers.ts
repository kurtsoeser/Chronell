import {
  NOTE_CLOUD_TASK_ITEM_CLASS,
  parseNoteCloudTaskRefFromElement
} from '@shared/note-cloud-task'
import {
  cloudTaskRefFromEventTarget,
  isCloudTaskCheckboxClick,
  patchNoteCloudTaskCompleted,
  readCloudTaskCompletedFromDom
} from '@/lib/note-cloud-task-insert'

export type NoteCloudTaskToggleHandler = (
  ref: ReturnType<typeof cloudTaskRefFromEventTarget>,
  completed: boolean
) => void | Promise<void>

export function createNoteCloudTaskDomEventHandlers(
  getOnToggle: () => NoteCloudTaskToggleHandler | undefined
): {
  mousedown: (view: unknown, event: Event) => boolean
} {
  return {
    mousedown: (_view, event): boolean => {
      if (!(event instanceof MouseEvent)) return false
      if (!isCloudTaskCheckboxClick(event.target)) return false
      const ref = cloudTaskRefFromEventTarget(event.target)
      if (!ref) return false
      const handler = getOnToggle()
      if (!handler) return false
      const current = readCloudTaskCompletedFromDom(event.target)
      if (current == null) return false
      event.preventDefault()
      event.stopPropagation()
      void handler(ref, !current)
      return true
    }
  }
}

export function setCloudTaskItemCheckedInDom(root: ParentNode, ref: { taskId: string }, completed: boolean): void {
  const items = root.querySelectorAll(`li.${NOTE_CLOUD_TASK_ITEM_CLASS}`)
  for (const item of items) {
    const parsed = parseNoteCloudTaskRefFromElement(item)
    if (!parsed || parsed.taskId !== ref.taskId) continue
    item.setAttribute('data-checked', completed ? 'true' : 'false')
  }
}

export async function toggleNoteCloudTaskFromEditor(
  editor: { commands: { focus: () => { setContent: (html: string, emitUpdate?: boolean) => boolean } } },
  root: HTMLElement,
  ref: NonNullable<ReturnType<typeof cloudTaskRefFromEventTarget>>,
  completed: boolean,
  getHtml: () => string
): Promise<void> {
  const previous = getHtml()
  setCloudTaskItemCheckedInDom(root, ref, completed)
  try {
    await patchNoteCloudTaskCompleted(ref, completed)
  } catch (e) {
    editor.commands.focus().setContent(previous, false)
    throw e
  }
}
