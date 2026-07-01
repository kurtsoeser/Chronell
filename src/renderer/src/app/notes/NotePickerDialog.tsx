import { useCallback, useEffect, useState } from 'react'
import { Loader2, StickyNote, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNoteListItem } from '@shared/types'
import { appendMailToNote, runMailToNoteWithErrorHandling } from '@/lib/mail-to-note'
import { useNotePickerStore } from '@/stores/note-picker'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

export function NotePickerDialog(): JSX.Element | null {
  const { t } = useTranslation()
  const open = useNotePickerStore((s) => s.open)
  const messageId = useNotePickerStore((s) => s.messageId)
  const selection = useNotePickerStore((s) => s.selection)
  const close = useNotePickerStore((s) => s.close)
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState<UserNoteListItem[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setNotes([])
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void window.mailClient.notes
        .search({
          query: search.trim(),
          kinds: ['standalone'],
          limit: 40
        })
        .then(setNotes)
        .catch(() => setNotes([]))
    }, 150)
    return (): void => window.clearTimeout(handle)
  }, [open, search])

  const pick = useCallback(
    async (note: UserNoteListItem): Promise<void> => {
      if (messageId == null) return
      setBusyId(note.id)
      try {
        const saved = await runMailToNoteWithErrorHandling(() =>
          appendMailToNote(note.id, messageId, selection)
        )
        if (saved) close()
      } finally {
        setBusyId(null)
      }
    },
    [close, messageId, selection]
  )

  if (!open || messageId == null) return null

  return (
    <ModalRoot open onBackdropClick={close} zIndex={320} overlayClassName="p-4">
      <ModalPanel
        className="flex max-h-[min(80vh,560px)] w-full max-w-md flex-col"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <StickyNote className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="min-w-0 flex-1 text-sm font-semibold">{t('notes.mailInsert.appendTitle')}</h2>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={close}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-border px-4 py-2">
          <input
            type="search"
            value={search}
            onChange={(e): void => setSearch(e.target.value)}
            placeholder={t('notes.mailInsert.searchPlaceholder')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {notes.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">{t('notes.mailInsert.noNotes')}</p>
          ) : (
            <ul className="space-y-1">
              {notes.map((note) => {
                const title = note.title?.trim() || t('notes.shell.untitled')
                const busy = busyId === note.id
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(): void => void pick(note)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                        busy && 'opacity-70'
                      )}
                    >
                      <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{title}</span>
                      {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
