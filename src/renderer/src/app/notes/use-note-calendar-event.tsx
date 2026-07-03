import { useCallback, useState, type MutableRefObject, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/react'
import type { ConnectedAccount } from '@shared/types'
import { NoteCreateCalendarEventDialog } from '@/app/notes/NoteCreateCalendarEventDialog'

export interface UseNoteCalendarEventOptions {
  noteId: number | null | undefined
  accounts: ConnectedAccount[]
  insertHtmlRef: MutableRefObject<((html: string) => void) | null>
  getEditor?: () => Editor | null
  onLinksChanged?: () => void
  onError?: (message: string) => void
  onSuccess?: (message: string) => void
}

export interface UseNoteCalendarEventResult {
  openCreateDialog: (initialSubject?: string) => void
  openCreateFromSelection: () => void
  calendarEventDialog: ReactNode
  canCreateCalendarEvent: boolean
}

function calendarLinkedAccounts(accounts: ConnectedAccount[]): ConnectedAccount[] {
  return accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google')
}

export function useNoteCalendarEvent({
  noteId,
  accounts,
  insertHtmlRef,
  getEditor,
  onLinksChanged,
  onError,
  onSuccess
}: UseNoteCalendarEventOptions): UseNoteCalendarEventResult {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [initialSubject, setInitialSubject] = useState('')
  const linkedAccounts = calendarLinkedAccounts(accounts)
  const canCreateCalendarEvent = noteId != null && linkedAccounts.length > 0

  const openCreateDialog = useCallback((title = ''): void => {
    if (!canCreateCalendarEvent) return
    setInitialSubject(title)
    setOpen(true)
  }, [canCreateCalendarEvent])

  const openCreateFromSelection = useCallback((): void => {
    const editor = getEditor?.()
    if (!editor || !canCreateCalendarEvent) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ').trim()
    openCreateDialog(text)
  }, [canCreateCalendarEvent, getEditor, openCreateDialog])

  const handleCreated = useCallback(
    (html: string): void => {
      insertHtmlRef.current?.(html)
      onSuccess?.(t('notes.calendarEvent.createdToast'))
    },
    [insertHtmlRef, onSuccess, t]
  )

  const calendarEventDialog = (
    <NoteCreateCalendarEventDialog
      open={open}
      noteId={noteId ?? null}
      initialSubject={initialSubject}
      accounts={accounts}
      onClose={(): void => setOpen(false)}
      onCreated={handleCreated}
      onLinkAdded={onLinksChanged}
      onError={onError}
    />
  )

  return {
    openCreateDialog,
    openCreateFromSelection,
    calendarEventDialog,
    canCreateCalendarEvent
  }
}
