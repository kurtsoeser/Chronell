import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type { CalendarEventView, ConnectedAccount, PeopleContactView, UserNote } from '@shared/types'
import { CalendarEventPreview } from '@/app/calendar/CalendarEventPreview'
import { CloudTaskItemPreview } from '@/app/calendar/CloudTaskItemPreview'
import type { TaskItemWithContext } from '@/app/tasks/tasks-types'
import { ReadingPane } from '@/app/layout/ReadingPane'
import { formatNoteDate, noteTitle } from '@/app/notes/notes-display-helpers'
import { NoteDisplayIcon } from '@/components/NoteDisplayIcon'
import { RichTextNotesPreview } from '@/components/RichTextNotesPreview'
import { openMailReadingPopout } from '@/lib/open-mail-reading-popout'
import { useThemeStore } from '@/stores/theme'
import { useMailStore } from '@/stores/mail'

export function ConnectionsObjectPreview({
  entityRef,
  accounts,
  onRequestMailPopout
}: {
  entityRef: ChronellEntityRef
  accounts: readonly ConnectedAccount[]
  onRequestMailPopout?: (opts?: { osWindow?: boolean }) => void
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const viewerTheme = useThemeStore((s) => s.effective)
  const selectMessageWithThreadPreview = useMailStore((s) => s.selectMessageWithThreadPreview)
  const clearSelectedMessage = useMailStore((s) => s.clearSelectedMessage)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkedNote, setLinkedNote] = useState<UserNote | null>(null)
  const [calendarEvent, setCalendarEvent] = useState<CalendarEventView | null>(null)
  const [cloudTask, setCloudTask] = useState<TaskItemWithContext | null>(null)
  const [linkedContact, setLinkedContact] = useState<PeopleContactView | null>(null)
  const [mailMessageId, setMailMessageId] = useState<number | null>(null)

  const mailTargetId = useMemo((): number | null => {
    if (entityRef.kind === 'mail') return entityRef.messageId
    return mailMessageId
  }, [entityRef, mailMessageId])

  useEffect(() => {
    if (entityRef.kind !== 'mail' && entityRef.kind !== 'mail_todo') {
      setMailMessageId(null)
      return
    }
    if (entityRef.kind === 'mail') {
      setMailMessageId(entityRef.messageId)
      return
    }
    let cancelled = false
    void (async (): Promise<void> => {
      const id = await window.mailClient.entityLinks.getMailTodoMessageId(entityRef.todoId)
      if (!cancelled) setMailMessageId(id)
    })()
    return (): void => {
      cancelled = true
    }
  }, [entityRef])

  useEffect(() => {
    if (mailTargetId == null) {
      clearSelectedMessage()
      return
    }
    void selectMessageWithThreadPreview(mailTargetId)
    return (): void => {
      clearSelectedMessage()
    }
  }, [mailTargetId, selectMessageWithThreadPreview, clearSelectedMessage])

  useEffect(() => {
    if (entityRef.kind === 'mail' || entityRef.kind === 'mail_todo') return

    let cancelled = false
    setLoading(true)
    setError(null)
    setLinkedNote(null)
    setCalendarEvent(null)
    setCloudTask(null)
    setLinkedContact(null)

    void (async (): Promise<void> => {
      try {
        if (entityRef.kind === 'note') {
          const note = await window.mailClient.notes.getById(entityRef.noteId)
          if (!cancelled) setLinkedNote(note)
          return
        }

        if (entityRef.kind === 'calendar_event') {
          const now = new Date()
          const start = new Date(now)
          start.setMonth(start.getMonth() - 6)
          const end = new Date(now)
          end.setMonth(end.getMonth() + 12)
          const events = await window.mailClient.calendar.listEvents({
            startIso: start.toISOString(),
            endIso: end.toISOString()
          })
          const ev = events.find(
            (row) =>
              row.accountId === entityRef.accountId &&
              row.graphEventId === entityRef.graphEventId
          )
          if (!cancelled) setCalendarEvent(ev ?? null)
          return
        }

        if (entityRef.kind === 'people_contact') {
          const contact = await window.mailClient.people.getById(entityRef.contactId)
          if (!cancelled) setLinkedContact(contact)
          return
        }

        if (entityRef.kind === 'cloud_task') {
          const rows = await window.mailClient.tasks.listTasks({
            accountId: entityRef.accountId,
            listId: entityRef.listId,
            showCompleted: true,
            cacheOnly: true
          })
          const row = rows.find((r) => r.id === entityRef.taskId)
          if (!row) {
            if (!cancelled) setCloudTask(null)
            return
          }
          const lists = await window.mailClient.tasks.listLists({
            accountId: entityRef.accountId
          })
          const listName = lists.find((l) => l.id === entityRef.listId)?.name ?? ''
          if (!cancelled) {
            setCloudTask({
              ...row,
              accountId: entityRef.accountId,
              listName
            })
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return (): void => {
      cancelled = true
    }
  }, [entityRef])

  const accountLabel = useMemo((): string | null => {
    if (entityRef.kind !== 'calendar_event' && entityRef.kind !== 'cloud_task') return null
    return accounts.find((a) => a.id === entityRef.accountId)?.displayName ?? entityRef.accountId
  }, [entityRef, accounts])

  const requestPopout = onRequestMailPopout ?? ((): void => {
    if (mailTargetId != null) openMailReadingPopout(mailTargetId)
  })

  if (entityRef.kind === 'mail' || entityRef.kind === 'mail_todo') {
    if (entityRef.kind === 'mail_todo' && mailMessageId == null && !loading) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          {t('connections.preview.mailNotFound')}
        </div>
      )
    }
    return (
      <ReadingPane
        hideEntityConnections
        hideChromeWhenEmpty
        emptySelectionTitle={t('connections.preview.loadingMail')}
        onRequestGlobalPopout={mailTargetId != null ? requestPopout : undefined}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('connections.preview.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-destructive">
        {error}
      </div>
    )
  }

  if (entityRef.kind === 'note') {
    if (!linkedNote) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          {t('connections.preview.noteNotFound')}
        </div>
      )
    }
    const title = noteTitle(linkedNote, t('notes.shell.untitled'))
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-start gap-2">
          <NoteDisplayIcon note={linkedNote} className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {t(`notes.kind.${linkedNote.kind}`)}
              {' · '}
              {formatNoteDate(linkedNote.updatedAt, i18n.language)}
            </div>
          </div>
        </div>
        {linkedNote.body.trim() ? (
          <RichTextNotesPreview notes={linkedNote.body} viewerTheme={viewerTheme} />
        ) : (
          <p className="text-xs text-muted-foreground">{t('notes.shell.emptyBody')}</p>
        )}
      </div>
    )
  }

  if (entityRef.kind === 'calendar_event') {
    if (!calendarEvent) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          {t('connections.preview.eventNotFound')}
        </div>
      )
    }
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CalendarEventPreview
          event={calendarEvent}
          calendarName={accountLabel}
          onEdit={(): void => undefined}
        />
      </div>
    )
  }

  if (entityRef.kind === 'cloud_task') {
    if (!cloudTask) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          {t('connections.preview.taskNotFound')}
        </div>
      )
    }
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CloudTaskItemPreview task={cloudTask} accountDisplayName={accountLabel ?? undefined} />
      </div>
    )
  }

  if (entityRef.kind === 'people_contact') {
    if (!linkedContact) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          {t('connections.preview.contactNotFound')}
        </div>
      )
    }
    const name =
      linkedContact.displayName?.trim() ||
      [linkedContact.givenName, linkedContact.surname].filter(Boolean).join(' ').trim() ||
      linkedContact.primaryEmail?.trim() ||
      t('people.shell.linkedNotesUntitledContact')
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="text-sm font-semibold text-foreground">{name}</div>
        {linkedContact.primaryEmail ? (
          <p className="text-xs text-muted-foreground">{linkedContact.primaryEmail}</p>
        ) : null}
        {linkedContact.company?.trim() ? (
          <p className="text-xs text-muted-foreground">{linkedContact.company}</p>
        ) : null}
        {linkedContact.notes?.trim() ? (
          <p className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/15 p-3 text-xs text-foreground">
            {linkedContact.notes}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6 text-xs text-muted-foreground">
      {t('connections.preview.unsupported')}
    </div>
  )
}
