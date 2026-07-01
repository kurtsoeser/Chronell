import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  /** Linke Seite (z. B. Besprechungsdetails, künftige Notiz-Aktionen). */
  start?: ReactNode
  /** Rechte Seite (z. B. Hell/Dunkel-Umschalter). */
  end?: ReactNode
  className?: string
}

/** Aktionszeile direkt über der TipTap-Formatierungsleiste (Notizen-Editor). */
export function NoteEditorActionBar({ start, end, className }: Props): JSX.Element | null {
  if (!start && !end) return null

  return (
    <div
      className={cn(
        'note-editor-action-bar compose-editor-toolbar-zone flex shrink-0 items-center gap-2 px-2 py-1',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{start}</div>
      {end ? <div className="flex shrink-0 items-center gap-1">{end}</div> : null}
    </div>
  )
}
