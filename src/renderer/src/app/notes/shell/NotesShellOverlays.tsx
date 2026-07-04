import type { NotePageTemplateEditorState } from '@/components/NotePageTemplateEditDialog'
import type { Editor } from '@tiptap/react'
import type { NoteEmbedInsertTarget } from '@shared/note-embed-insert'
import type { NoteMeetingInsertResult } from '@/app/notes/NoteMeetingInsertDialog'
import { NoteCategoriesPopover } from '@/components/NoteCategoriesPopover'
import { NoteEmbedInsertDialog } from '@/app/notes/NoteEmbedInsertDialog'
import { NoteMeetingInsertDialog } from '@/app/notes/NoteMeetingInsertDialog'
import { NotePageTemplateEditDialog } from '@/components/NotePageTemplateEditDialog'
import { NoteSectionPopover } from '@/components/NoteSectionPopover'
import { resolveNoteCategoryAccountId } from '@/lib/note-category-account'
import {
  loadCustomNotePageTemplates,
  upsertCustomNotePageTemplate
} from '@/lib/note-page-templates-custom'
import type { ConnectedAccount, NoteSection, UserNote, UserNoteListItem } from '@shared/types'
import type { ReactNode } from 'react'

export function NotesShellOverlays({
  editing,
  accounts,
  sections,
  categoryPopover,
  sectionPopover,
  onCloseCategoryPopover,
  onCloseSectionPopover,
  onRefreshEditingNote,
  templateFromNoteOpen,
  onCloseTemplateFromNote,
  onTemplateSaved,
  meetingInsertOpen,
  onCloseMeetingInsert,
  onMeetingInsert,
  embedInsertOpen,
  onCloseEmbedInsert,
  editorRef,
  insertEmbedRef,
  onEditBodyChange,
  onEmbedInserted,
  onEmbedError,
  inkDialog,
  cloudTaskDialog,
  calendarEventDialog,
  pushToast,
  t
}: {
  editing: UserNote | null
  accounts: ConnectedAccount[]
  sections: NoteSection[]
  categoryPopover: { x: number; y: number } | null
  sectionPopover: { x: number; y: number } | null
  onCloseCategoryPopover: () => void
  onCloseSectionPopover: () => void
  onRefreshEditingNote: () => void
  templateFromNoteOpen: NotePageTemplateEditorState | null
  onCloseTemplateFromNote: () => void
  onTemplateSaved: () => void
  meetingInsertOpen: boolean
  onCloseMeetingInsert: () => void
  onMeetingInsert: (result: NoteMeetingInsertResult, html: string) => void | Promise<void>
  embedInsertOpen: boolean
  onCloseEmbedInsert: () => void
  editorRef: React.MutableRefObject<Editor | null>
  insertEmbedRef: React.MutableRefObject<((target: NoteEmbedInsertTarget) => boolean) | null>
  onEditBodyChange: (html: string) => void
  onEmbedInserted: () => void
  onEmbedError: (message: string) => void
  inkDialog: ReactNode
  cloudTaskDialog: ReactNode
  calendarEventDialog: ReactNode
  pushToast: (input: { label: string; variant: 'success' | 'error' | 'info' }) => void
  t: (key: string, options?: Record<string, unknown>) => string
}): JSX.Element {
  return (
    <>
      {templateFromNoteOpen ? (
        <NotePageTemplateEditDialog
          editorState={templateFromNoteOpen}
          onClose={onCloseTemplateFromNote}
          onSave={(entry): void => {
            upsertCustomNotePageTemplate(loadCustomNotePageTemplates(), entry)
            onTemplateSaved()
            pushToast({ label: t('notes.templates.savedToast'), variant: 'success' })
          }}
        />
      ) : null}
      {editing && categoryPopover ? (
        <NoteCategoriesPopover
          open
          anchor={categoryPopover}
          noteId={editing.id}
          account={
            accounts.find(
              (a) => a.id === resolveNoteCategoryAccountId(editing as UserNoteListItem, accounts)
            ) ?? null
          }
          selectedNames={(editing as UserNoteListItem).categories ?? []}
          onClose={onCloseCategoryPopover}
          onSaved={onRefreshEditingNote}
        />
      ) : null}
      {editing && sectionPopover ? (
        <NoteSectionPopover
          open
          anchor={sectionPopover}
          noteId={editing.id}
          sections={sections}
          currentSectionId={editing.sectionId ?? null}
          onClose={onCloseSectionPopover}
          onMoved={onRefreshEditingNote}
        />
      ) : null}
      {editing && meetingInsertOpen ? (
        <NoteMeetingInsertDialog
          open
          accounts={accounts}
          onClose={onCloseMeetingInsert}
          onInsert={onMeetingInsert}
        />
      ) : null}
      {editing && embedInsertOpen ? (
        <NoteEmbedInsertDialog
          open
          editorRef={editorRef}
          insertEmbedRef={insertEmbedRef}
          onClose={onCloseEmbedInsert}
          onChangeHtml={onEditBodyChange}
          onInserted={onEmbedInserted}
          onError={onEmbedError}
        />
      ) : null}
      {inkDialog}
      {cloudTaskDialog}
      {calendarEventDialog}
    </>
  )
}
