import { useMemo } from 'react'
import type { NoteEntityLinkedItem } from '@shared/note-entity-links'
import type { NotePageTemplateEditorState } from '@/components/NotePageTemplateEditDialog'
import { linkedItemToPreviewEntry } from '@/app/notes/notes-link-preview-items'
import type { useNotesEditorSession } from '@/app/notes/shell/use-notes-editor-session'
import type { useNotesLinkedPreview } from '@/app/notes/shell/use-notes-linked-preview'
import type { useNotesListData } from '@/app/notes/shell/use-notes-list-data'
import type { NoteScheduleDraft } from '@/app/notes/shell/notes-shell-types'

type EditorSession = ReturnType<typeof useNotesEditorSession>
type LinkedPreview = ReturnType<typeof useNotesLinkedPreview>
type ListData = ReturnType<typeof useNotesListData>

export function useNotesEditorColumnProps({
  editor,
  list,
  preview,
  onSelectLinkForPreview,
  onCreateSubPage,
  onDeleteNote,
  onSaveTemplateFromNote
}: {
  editor: EditorSession
  list: ListData
  preview: LinkedPreview
  onSelectLinkForPreview: (item: NoteEntityLinkedItem, direction: 'outgoing' | 'incoming') => void
  onCreateSubPage: () => void
  onDeleteNote: () => void
  onSaveTemplateFromNote: () => void
}) {
  const { t } = list

  return useMemo(
    () => ({
      editing: editor.editing,
      error: editor.error,
      saving: editor.saving,
      openingNote: editor.openingNote,
      saveStatus: editor.saveStatus,
      lastSavedAt: editor.lastSavedAt,
      editorSeedHtml: editor.editorSeedHtml,
      linksBodyHtml: editor.linksBodyHtml,
      scheduleDraft: editor.scheduleDraft,
      categoryColorByName: list.categoryColorByName,
      editingSectionName: editor.editingSectionName,
      editingBreadcrumb: editor.editingBreadcrumb,
      notesById: list.notesById,
      notesSettings: list.notesSettings,
      previewEntriesCount: preview.previewEntries.length,
      linkedPreviewKey: preview.linkedPreviewKey,
      linkedPreviewOpen: preview.linkedPreviewOpen,
      onLinkedPreviewToggle: preview.toggleLinkedPreview,
      onSelectLinkForPreview,
      onLinksLoaded: preview.setLinksBundle,
      onTitleChange: editor.handleTitleChange,
      onOpenNoteById: (id: number): void => {
        void editor.openNoteById(id)
      },
      onIconChange: (iconId: string | undefined): void => {
        void editor.patchNoteDisplay({ iconId: iconId ?? null })
      },
      onIconColorChange: (iconColor: string | null): void => {
        void editor.patchNoteDisplay({ iconColor })
      },
      onScheduleChange: (value: NoteScheduleDraft): void => editor.setScheduleDraft(value),
      onCreateSubPage,
      onEditBodyChange: editor.handleEditBodyChangeWithAutosave,
      onOpenMeetingInsert: (): void => editor.setMeetingInsertOpen(true),
      onRefreshMeetingDetails: (): void => {
        void editor.handleMeetingDetailsRefresh()
      },
      canRefreshMeetingDetails: editor.hasMeetingBlocks,
      meetingRefreshBusy: editor.meetingRefreshBusy,
      onOpenEmbedInsert: (): void => editor.setEmbedInsertOpen(true),
      onOpenScreenClip: editor.handleScreenClip,
      onOpenInkDraw: editor.noteInk.openNew,
      onOpenCloudTaskCreate: (): void => editor.noteCloudTask.openCreateDialog(),
      canCreateCloudTask: editor.noteCloudTask.canCreateCloudTask,
      onOpenCalendarEventCreate: (): void => editor.noteCalendarEvent.openCreateDialog(),
      canCreateCalendarEvent: editor.noteCalendarEvent.canCreateCalendarEvent,
      onCreateCloudTaskFromSelection: editor.noteCloudTask.openCreateFromSelection,
      onCreateCalendarEventFromSelection: editor.noteCalendarEvent.openCreateFromSelection,
      onCloudTaskToggle: editor.noteCloudTask.toggleCloudTaskInEditor,
      onEntityMentionLinkAdded: (): void => {
        if (editor.editing) void preview.reloadLinksBundle(editor.editing.id)
      },
      editorRef: editor.editorRef,
      onInkImageDoubleClick: editor.handleInkImageDoubleClick,
      onDeleteNote,
      onSaveTemplateFromNote,
      onPrintPage: editor.handlePrintPage,
      onExportPdf: editor.handleExportPdf,
      onSave: (): void => {
        void editor.saveEditing()
      },
      onClose: editor.closeEditor,
      editorFlushRef: editor.editorFlushRef,
      editorInsertHtmlRef: editor.editorInsertHtmlRef,
      editorInsertEmbedRef: editor.editorInsertEmbedRef,
      editorReplaceInkRef: editor.editorReplaceInkRef,
      editorFocusedRef: editor.editorFocusedRef
    }),
    [editor, list.categoryColorByName, list.notesById, list.notesSettings, preview, onSelectLinkForPreview, onCreateSubPage, onDeleteNote, onSaveTemplateFromNote]
  )
}
