import { FilePlus2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNoteListItem } from '@shared/types'
import { noteTitle } from '@/app/notes/notes-display-helpers'
import { NoteDisplayIcon } from '@/components/NoteDisplayIcon'
import { cn } from '@/lib/utils'

export function NotesChildPagesBar({
  childNotes,
  activeNoteId,
  onOpenNote,
  onCreateSubPage,
  disabled = false,
  className
}: {
  childNotes: UserNoteListItem[]
  activeNoteId: number
  onOpenNote: (note: UserNoteListItem) => void
  onCreateSubPage: () => void
  disabled?: boolean
  className?: string
}): JSX.Element | null {
  const { t } = useTranslation()
  const untitled = t('notes.shell.untitled')

  if (childNotes.length === 0) {
    return (
      <div className={cn('mb-3 flex items-center justify-between gap-2', className)}>
        <span className="text-2xs text-muted-foreground">{t('notes.subPages.empty')}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onCreateSubPage}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <FilePlus2 className="h-3 w-3" />
          {t('notes.subPages.create')}
        </button>
      </div>
    )
  }

  return (
    <section className={cn('mb-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('notes.subPages.title', { count: childNotes.length })}
        </h3>
        <button
          type="button"
          disabled={disabled}
          onClick={onCreateSubPage}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background/70 px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <FilePlus2 className="h-3 w-3" />
          {t('notes.subPages.create')}
        </button>
      </div>
      <ul className="space-y-0.5">
        {childNotes.map((child) => {
          const title = noteTitle(child, untitled)
          const active = child.id === activeNoteId
          return (
            <li key={child.id}>
              <button
                type="button"
                onClick={(): void => onOpenNote(child)}
                className={cn(
                  'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                  active ? 'bg-primary/10 font-medium text-foreground' : 'hover:bg-secondary/60'
                )}
                title={title}
              >
                <NoteDisplayIcon note={child} className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
