import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, Plus, StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PeopleContactLinkedNote, PeopleContactView } from '@shared/types'
import { cn } from '@/lib/utils'
import { markdownPreviewText, noteTitle } from '@/app/notes/notes-display-helpers'
import { useAppModeStore } from '@/stores/app-mode'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'

export function PeopleContactLinkedNotesSection({
  contact
}: {
  contact: PeopleContactView
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const setPendingNoteId = useNotesPendingFocusStore((s) => s.setPendingNoteId)
  const [rows, setRows] = useState<PeopleContactLinkedNote[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.mailClient.notes.links.listForContact(contact.id)
      setRows(list)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [contact.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsub = window.mailClient.events.onNotesChanged(() => {
      void load()
    })
    return unsub
  }, [load])

  async function createLinkedNote(): Promise<void> {
    setCreating(true)
    try {
      const contactLabel =
        contact.displayName?.trim() ||
        [contact.givenName, contact.surname].filter(Boolean).join(' ').trim() ||
        contact.primaryEmail?.trim() ||
        t('people.shell.linkedNotesUntitledContact')
      const note = await window.mailClient.notes.createStandalone({
        title: t('people.shell.linkedNotesDefaultTitle', { name: contactLabel }),
        body: ''
      })
      await window.mailClient.notes.links.add({
        fromNoteId: note.id,
        target: { kind: 'people_contact', contactId: contact.id }
      })
      setPendingNoteId(note.id)
      setAppMode('notes')
    } finally {
      setCreating(false)
    }
  }

  function openNote(noteId: number): void {
    setPendingNoteId(noteId)
    setAppMode('notes')
  }

  return (
    <section className="min-w-0 sm:col-span-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <StickyNote className="h-3.5 w-3.5 shrink-0" />
          {t('people.shell.linkedNotesHeading')}
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={(): void => void createLinkedNote()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-3 w-3" aria-hidden />
          )}
          {t('people.shell.linkedNotesAdd')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('common.loading')}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('people.shell.linkedNotesEmpty')}</p>
      ) : (
        <ul className="list-none space-y-1.5">
          {rows.map((row) => {
            const title = noteTitle(
              { kind: 'standalone', title: row.title, eventTitleSnapshot: null },
              t('notes.shell.untitled')
            )
            const preview = markdownPreviewText(row.body)
            return (
              <li key={row.noteId}>
                <button
                  type="button"
                  onClick={(): void => openNote(row.noteId)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md border border-border/70 bg-muted/10 px-3 py-2 text-left',
                    'transition-colors hover:border-primary/30 hover:bg-secondary/40'
                  )}
                >
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{title}</span>
                    {preview ? (
                      <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{preview}</span>
                    ) : null}
                    <span className="mt-1 block text-[10px] text-muted-foreground/80">
                      {new Date(row.updatedAt).toLocaleString(
                        i18n.language.startsWith('de') ? 'de-DE' : 'en-GB'
                      )}
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
