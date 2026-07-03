import { useCallback, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { NoteInkDocument } from '@shared/note-ink-document'
import { NoteInkDrawDialog } from '@/app/notes/NoteInkDrawDialog'
import { strokesToPngBlob } from '@/lib/note-ink-export'

export function useInkPngAttachment({
  onAddFiles,
  onError
}: {
  onAddFiles: (files: File[]) => void | Promise<void>
  onError?: (message: string) => void
}): {
  openInkDraw: () => void
  inkDialog: ReactNode
} {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const handleInsert = useCallback(
    async ({ document }: { document: NoteInkDocument }): Promise<void> => {
      try {
        const blob = await strokesToPngBlob(
          document.strokes,
          document.canvasWidth,
          document.canvasHeight
        )
        const name = `${t('notes.ink.defaultName')} ${format(new Date(), 'yyyy-MM-dd HH-mm')}.png`
        const file = new File([blob], name, { type: 'image/png' })
        await onAddFiles([file])
        setOpen(false)
      } catch (e) {
        onError?.(e instanceof Error ? e.message : String(e))
      }
    },
    [onAddFiles, onError, t]
  )

  const inkDialog = (
    <NoteInkDrawDialog
      open={open}
      onClose={(): void => setOpen(false)}
      onInsert={handleInsert}
    />
  )

  return {
    openInkDraw: (): void => setOpen(true),
    inkDialog
  }
}
