import { useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { useNoteFileDrop } from '@/lib/use-note-file-drop'
import { uploadFilesToNote } from '@/lib/note-attachments-upload'
import { cn } from '@/lib/utils'

export function NoteEditorDropZone({
  noteId,
  insertHtml,
  onUploadError,
  className,
  children
}: {
  noteId: number
  insertHtml?: (html: string) => void
  onUploadError?: (message: string) => void
  className?: string
  children: ReactNode
}): JSX.Element {
  const { t } = useTranslation()

  const handleFiles = useCallback(
    (files: File[]): void => {
      void (async (): Promise<void> => {
        const result = await uploadFilesToNote(noteId, files, { insertHtml })
        if (!result.ok) onUploadError?.(result.error)
      })()
    },
    [insertHtml, noteId, onUploadError]
  )

  const { dragging, dropZoneProps } = useNoteFileDrop(handleFiles)

  return (
    <div
      className={cn('relative min-h-0 flex-1', className)}
      {...dropZoneProps}
    >
      {children}
      {dragging ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-md border-2 border-dashed border-primary/60 bg-primary/10 backdrop-blur-[1px]"
          aria-hidden
        >
          <div className="flex flex-col items-center gap-2 rounded-lg bg-card/90 px-6 py-4 shadow-lg">
            <Upload className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-foreground">{t('notes.dropZone.hint')}</p>
            <p className="text-xs text-muted-foreground">{t('notes.dropZone.imagesInline')}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
