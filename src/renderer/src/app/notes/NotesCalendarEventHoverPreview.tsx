import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { UserNoteListItem } from '@shared/types'
import { notePreviewText, noteTitle } from '@/app/notes/notes-display-helpers'
import { chronellAcrylicPopoverClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'

export function NotesCalendarEventHoverPreview({
  note,
  anchorX,
  anchorY,
  visible
}: {
  note: UserNoteListItem | null
  anchorX: number
  anchorY: number
  visible: boolean
}): JSX.Element | null {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !visible || !note) return null

  const title = noteTitle(note, t('notes.shell.untitled'))
  const excerpt = notePreviewText(note.body)
  const pad = 14
  const width = 300
  let left = anchorX + pad
  let top = anchorY + pad
  if (typeof window !== 'undefined') {
    if (left + width > window.innerWidth - 8) left = Math.max(8, anchorX - width - pad)
    if (top + 120 > window.innerHeight - 8) top = Math.max(8, anchorY - 120 - pad)
  }

  return createPortal(
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none fixed z-[250]',
        chronellAcrylicPopoverClass,
        'max-w-[min(300px,calc(100vw-16px))] rounded-lg border border-border p-3 shadow-xl'
      )}
      style={{ left, top, width }}
    >
      <div className="truncate text-xs font-semibold text-foreground">{title}</div>
      {excerpt ? (
        <p className="mt-1.5 line-clamp-4 text-2xs leading-snug text-muted-foreground">{excerpt}</p>
      ) : (
        <p className="mt-1.5 text-2xs italic text-muted-foreground">{t('notes.shell.emptyBody')}</p>
      )}
    </div>,
    document.body
  )
}
