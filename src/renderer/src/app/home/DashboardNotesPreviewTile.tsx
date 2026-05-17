import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNoteListItem } from '@shared/types'
import { cn } from '@/lib/utils'
import { NoteDisplayIcon } from '@/components/NoteDisplayIcon'
import {
  formatNoteDate,
  markdownPreviewText,
  noteTitle
} from '@/app/notes/notes-display-helpers'
import { useAppModeStore } from '@/stores/app-mode'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'

const NOTES_FETCH_LIMIT = 80
const NOTES_OVERVIEW_MAX = 12

export type DashboardNotesPreviewMode = 'overview' | 'last'

interface Props {
  mode: DashboardNotesPreviewMode
}

function sortNotesByUpdated(notes: UserNoteListItem[]): UserNoteListItem[] {
  return [...notes].sort((a, b) => {
    const ta = Date.parse(a.updatedAt)
    const tb = Date.parse(b.updatedAt)
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
    if (Number.isNaN(ta)) return 1
    if (Number.isNaN(tb)) return -1
    return tb - ta
  })
}

export function DashboardNotesPreviewTile({ mode }: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const [notes, setNotes] = useState<UserNoteListItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotes = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.mailClient.notes.list({ limit: NOTES_FETCH_LIMIT })
      setNotes(sortNotesByUpdated(list))
    } catch {
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  const openNote = useCallback(
    (noteId: number): void => {
      useNotesPendingFocusStore.getState().setPendingNoteId(noteId)
      setAppMode('notes')
    },
    [setAppMode]
  )

  const sorted = useMemo(() => sortNotesByUpdated(notes), [notes])
  const lastNote = sorted[0] ?? null
  const overviewNotes = sorted.slice(0, NOTES_OVERVIEW_MAX)
  const untitled = t('notes.shell.untitled')

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('dashboard.loading.notes')}
      </div>
    )
  }

  if (mode === 'last') {
    if (!lastNote) {
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-8 text-center text-xs text-muted-foreground">
          {t('dashboard.notesLast.empty')}
        </div>
      )
    }
    const title = noteTitle(lastNote, untitled)
    const preview = markdownPreviewText(lastNote.body)
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          onClick={(): void => openNote(lastNote.id)}
          className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3 text-left transition-colors hover:bg-secondary/50"
        >
          <div className="flex items-start gap-2">
            <NoteDisplayIcon note={lastNote} className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{title}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {formatNoteDate(lastNote.updatedAt, i18n.language)}
              </div>
            </div>
          </div>
          {preview ? (
            <p className="line-clamp-[8] text-xs leading-relaxed text-muted-foreground">{preview}</p>
          ) : (
            <p className="text-xs italic text-muted-foreground">{t('dashboard.notesLast.noBody')}</p>
          )}
        </button>
      </div>
    )
  }

  if (overviewNotes.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-8 text-center text-xs text-muted-foreground">
        {t('dashboard.notesOverview.empty')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ul className="min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto overscroll-contain">
        {overviewNotes.map((note) => {
          const title = noteTitle(note, untitled)
          return (
            <li key={note.id}>
              <button
                type="button"
                onClick={(): void => openNote(note.id)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors',
                  'hover:bg-secondary/50'
                )}
              >
                <NoteDisplayIcon note={note} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{title}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {formatNoteDate(note.updatedAt, i18n.language)}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
