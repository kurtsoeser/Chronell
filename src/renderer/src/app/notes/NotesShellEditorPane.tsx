import { memo, useCallback, useMemo, useState, type MutableRefObject, type ReactNode } from 'react'
import { AppWindow, CalendarDays, CalendarPlus, Image, Loader2, PenLine, RefreshCw, SquareCheckBig } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/react'
import type { NoteCloudTaskRef } from '@shared/note-cloud-task'
import { TipTapNoteEditorLazy } from '@/components/TipTapNoteEditorLazy'
import { moduleColumnHeaderOutlineSmClass } from '@/components/ModuleColumnHeader'
import { NoteEditorDropZone } from '@/app/notes/NoteEditorDropZone'
import { cn } from '@/lib/utils'

export interface NotesShellEditorPaneProps {
  noteId: number
  editorSeedHtml: string
  onChangeHtml: (html: string) => void
  flushRef: MutableRefObject<(() => void) | null>
  insertHtmlRef: MutableRefObject<((html: string) => void) | null>
  replaceInkSnapshotRef: MutableRefObject<
    ((inkJsonAttachmentId: number, html: string) => void) | null
  >
  onOpenLinkedNote: (noteId: number) => void
  onOpenMeetingInsert: () => void
  onRefreshMeetingDetails: () => void
  canRefreshMeetingDetails: boolean
  meetingRefreshBusy: boolean
  onOpenEmbedInsert: () => void
  onOpenScreenClip: () => void
  onOpenInkDraw: () => void
  onOpenCloudTaskCreate: () => void
  canCreateCloudTask: boolean
  onOpenCalendarEventCreate: () => void
  canCreateCalendarEvent: boolean
  onInkImageDoubleClick: (inkJsonAttachmentId: number) => void
  onCreateCloudTaskFromSelection: () => void
  onCreateCalendarEventFromSelection: () => void
  onCloudTaskToggle: (ref: NoteCloudTaskRef, completed: boolean) => void | Promise<void>
  onEntityMentionLinkAdded?: () => void
  onEntityMentionLinkError?: (message: string) => void
  editorRef: MutableRefObject<Editor | null>
  saving: boolean
  scrollFooter?: ReactNode
}

export const NotesShellEditorPane = memo(function NotesShellEditorPane({
  noteId,
  editorSeedHtml,
  onChangeHtml,
  flushRef,
  insertHtmlRef,
  replaceInkSnapshotRef,
  onOpenLinkedNote,
  onOpenMeetingInsert,
  onRefreshMeetingDetails,
  canRefreshMeetingDetails,
  meetingRefreshBusy,
  onOpenEmbedInsert,
  onOpenScreenClip,
  onOpenInkDraw,
  onOpenCloudTaskCreate,
  canCreateCloudTask,
  onOpenCalendarEventCreate,
  canCreateCalendarEvent,
  onInkImageDoubleClick,
  onCreateCloudTaskFromSelection,
  onCreateCalendarEventFromSelection,
  onCloudTaskToggle,
  onEntityMentionLinkAdded,
  onEntityMentionLinkError,
  editorRef,
  saving,
  scrollFooter
}: NotesShellEditorPaneProps): JSX.Element {
  const { t } = useTranslation()
  const [dropError, setDropError] = useState<string | null>(null)

  const insertHtml = useCallback(
    (html: string): void => {
      insertHtmlRef.current?.(html)
    },
    [insertHtmlRef]
  )

  const actionBarStart = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onOpenMeetingInsert}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium'
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {t('notes.meetingInsert.button')}
        </button>
        <button
          type="button"
          disabled={saving || meetingRefreshBusy || !canRefreshMeetingDetails}
          onClick={onRefreshMeetingDetails}
          title={t('notes.meetingRefresh.buttonHint')}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium'
          )}
        >
          {meetingRefreshBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          {t('notes.meetingRefresh.button')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onOpenEmbedInsert}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium'
          )}
        >
          <AppWindow className="h-3.5 w-3.5" aria-hidden />
          {t('notes.embedInsert.button')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onOpenScreenClip}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium'
          )}
        >
          <Image className="h-3.5 w-3.5" aria-hidden />
          {t('notes.screenClip.button')}
        </button>
        <button
          type="button"
          disabled={saving || !canCreateCalendarEvent}
          onClick={onOpenCalendarEventCreate}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium'
          )}
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
          {t('notes.calendarEvent.button')}
        </button>
        <button
          type="button"
          disabled={saving || !canCreateCloudTask}
          onClick={onOpenCloudTaskCreate}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium'
          )}
        >
          <SquareCheckBig className="h-3.5 w-3.5" aria-hidden />
          {t('notes.cloudTask.button')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onOpenInkDraw}
          className={cn(
            moduleColumnHeaderOutlineSmClass,
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium'
          )}
        >
          <PenLine className="h-3.5 w-3.5" aria-hidden />
          {t('notes.ink.button')}
        </button>
      </div>
    ),
    [
      canCreateCalendarEvent,
      canCreateCloudTask,
      canRefreshMeetingDetails,
      meetingRefreshBusy,
      onOpenCalendarEventCreate,
      onOpenCloudTaskCreate,
      onOpenEmbedInsert,
      onOpenInkDraw,
      onOpenMeetingInsert,
      onRefreshMeetingDetails,
      onOpenScreenClip,
      saving,
      t
    ]
  )

  return (
    <NoteEditorDropZone
      noteId={noteId}
      insertHtml={insertHtml}
      onUploadError={setDropError}
      className="mt-2 flex min-h-0 flex-1 flex-col"
    >
      {dropError ? (
        <p className="mb-2 shrink-0 text-xs text-destructive" role="alert">
          {dropError}
        </p>
      ) : null}
      <TipTapNoteEditorLazy
        key={noteId}
        valueHtml={editorSeedHtml}
        onChangeHtml={onChangeHtml}
        placeholder={t('notes.editor.placeholder')}
        fillHeight
        minHeight={200}
        className="min-h-0 flex-1"
        flushRef={flushRef}
        insertHtmlRef={insertHtmlRef}
        replaceInkSnapshotRef={replaceInkSnapshotRef}
        onInkImageDoubleClick={onInkImageDoubleClick}
        currentNoteId={noteId}
        onOpenLinkedNote={onOpenLinkedNote}
        onCreateCloudTaskFromSelection={onCreateCloudTaskFromSelection}
        onCreateCalendarEventFromSelection={onCreateCalendarEventFromSelection}
        onCloudTaskToggle={onCloudTaskToggle}
        onEntityMentionLinkAdded={onEntityMentionLinkAdded}
        onEntityMentionLinkError={onEntityMentionLinkError}
        editorRef={editorRef}
        actionBarStart={actionBarStart}
        scrollEditorBodyOnly
        scrollFooter={scrollFooter}
      />
    </NoteEditorDropZone>
  )
})
