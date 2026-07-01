import { memo, useCallback, useMemo, useState, type MutableRefObject } from 'react'
import { CalendarDays, Image } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  onOpenLinkedNote: (noteId: number) => void
  onOpenMeetingInsert: () => void
  onOpenScreenClip: () => void
  saving: boolean
}

export const NotesShellEditorPane = memo(function NotesShellEditorPane({
  noteId,
  editorSeedHtml,
  onChangeHtml,
  flushRef,
  insertHtmlRef,
  onOpenLinkedNote,
  onOpenMeetingInsert,
  onOpenScreenClip,
  saving
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
      </div>
    ),
    [onOpenMeetingInsert, onOpenScreenClip, saving, t]
  )

  return (
    <NoteEditorDropZone
      noteId={noteId}
      insertHtml={insertHtml}
      onUploadError={setDropError}
      className="mt-4 flex min-h-[280px] flex-1 flex-col"
    >
      {dropError ? (
        <p className="mb-2 text-xs text-destructive" role="alert">
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
        currentNoteId={noteId}
        onOpenLinkedNote={onOpenLinkedNote}
        actionBarStart={actionBarStart}
        stickyEditorChrome
      />
    </NoteEditorDropZone>
  )
})
