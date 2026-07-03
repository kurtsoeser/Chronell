import { useCallback, useState, type MutableRefObject, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/react'
import type { ConnectedAccount } from '@shared/types'
import type { NoteCloudTaskRef } from '@shared/note-cloud-task'
import { NoteCreateCloudTaskDialog } from '@/app/notes/NoteCreateCloudTaskDialog'
import {
  isCloudTaskItemAttrs,
  NoteCloudTaskItem,
  NoteCloudTaskList
} from '@/components/tiptap-note-cloud-task-item'
import { patchNoteCloudTaskCompleted } from '@/lib/note-cloud-task-insert'

export interface UseNoteCloudTaskOptions {
  noteId: number | null | undefined
  taskAccounts: ConnectedAccount[]
  insertHtmlRef: MutableRefObject<((html: string) => void) | null>
  getEditor?: () => Editor | null
  onLinksChanged?: () => void
  onError?: (message: string) => void
  onSuccess?: (message: string) => void
}

export interface UseNoteCloudTaskResult {
  openCreateDialog: (initialTitle?: string) => void
  openCreateFromSelection: () => void
  cloudTaskDialog: ReactNode
  canCreateCloudTask: boolean
  toggleCloudTaskInEditor: (ref: NoteCloudTaskRef, completed: boolean) => Promise<void>
}

function setCloudTaskCheckedInEditor(editor: Editor, ref: NoteCloudTaskRef, completed: boolean): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      let updated = false
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'taskItem' || !isCloudTaskItemAttrs(node.attrs)) return
        if (
          node.attrs.cloudTaskAccountId !== ref.accountId ||
          node.attrs.cloudTaskListId !== ref.listId ||
          node.attrs.cloudTaskId !== ref.taskId
        ) {
          return
        }
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: completed })
        updated = true
      })
      return updated
    })
    .run()
}

export function useNoteCloudTask({
  noteId,
  taskAccounts,
  insertHtmlRef,
  getEditor,
  onLinksChanged,
  onError,
  onSuccess
}: UseNoteCloudTaskOptions): UseNoteCloudTaskResult {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [initialTitle, setInitialTitle] = useState('')

  const canCreateCloudTask = noteId != null && taskAccounts.length > 0

  const openCreateDialog = useCallback((title = ''): void => {
    if (!canCreateCloudTask) return
    setInitialTitle(title)
    setOpen(true)
  }, [canCreateCloudTask])

  const openCreateFromSelection = useCallback((): void => {
    const editor = getEditor?.()
    if (!editor || !canCreateCloudTask) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ').trim()
    openCreateDialog(text)
  }, [canCreateCloudTask, getEditor, openCreateDialog])

  const toggleCloudTaskInEditor = useCallback(
    async (ref: NoteCloudTaskRef, completed: boolean): Promise<void> => {
      const editor = getEditor?.()
      if (!editor) return
      const previous = editor.getHTML()
      if (!setCloudTaskCheckedInEditor(editor, ref, completed)) return
      try {
        await patchNoteCloudTaskCompleted(ref, completed)
      } catch (e) {
        editor.commands.setContent(previous, { emitUpdate: false })
        onError?.(e instanceof Error ? e.message : String(e))
        throw e
      }
    },
    [getEditor, onError]
  )

  const handleCreated = useCallback(
    (html: string): void => {
      insertHtmlRef.current?.(html)
      onSuccess?.(t('notes.cloudTask.createdToast'))
    },
    [insertHtmlRef, onSuccess, t]
  )

  const cloudTaskDialog = (
    <NoteCreateCloudTaskDialog
      open={open}
      noteId={noteId ?? null}
      initialTitle={initialTitle}
      taskAccounts={taskAccounts}
      onClose={(): void => setOpen(false)}
      onCreated={handleCreated}
      onLinkAdded={onLinksChanged}
      onError={onError}
    />
  )

  return {
    openCreateDialog,
    openCreateFromSelection,
    cloudTaskDialog,
    canCreateCloudTask,
    toggleCloudTaskInEditor
  }
}

export { NoteCloudTaskItem, NoteCloudTaskList }
