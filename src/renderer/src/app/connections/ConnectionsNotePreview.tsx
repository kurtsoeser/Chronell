import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNote } from '@shared/types'
import { formatNoteDate, noteTitle } from '@/app/notes/notes-display-helpers'
import { NoteDisplayIcon } from '@/components/NoteDisplayIcon'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { IconColorPickerFooter } from '@/components/IconColorPickerFooter'
import { MarkdownNoteEditor } from '@/components/MarkdownNoteEditor'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import { cn } from '@/lib/utils'

const AUTOSAVE_MS = 800

async function persistNote(
  note: UserNote,
  patch: { title?: string; body?: string },
  invalidNoteMessage: string
): Promise<UserNote> {
  const title = patch.title !== undefined ? patch.title : (note.title?.trim() ?? '')
  const body = patch.body !== undefined ? patch.body : note.body
  if (note.kind === 'standalone') {
    return window.mailClient.notes.updateStandalone({
      id: note.id,
      title,
      body
    })
  }
  if (note.kind === 'mail' && note.messageId != null) {
    return window.mailClient.notes.upsertMail({
      messageId: note.messageId,
      title,
      body
    })
  }
  if (
    note.kind === 'calendar' &&
    note.accountId &&
    note.calendarSource &&
    note.calendarRemoteId &&
    note.eventRemoteId
  ) {
    return window.mailClient.notes.upsertCalendar({
      accountId: note.accountId,
      calendarSource: note.calendarSource,
      calendarRemoteId: note.calendarRemoteId,
      eventRemoteId: note.eventRemoteId,
      title,
      body,
      eventTitleSnapshot: note.eventTitleSnapshot,
      eventStartIsoSnapshot: note.eventStartIsoSnapshot
    })
  }
  throw new Error(invalidNoteMessage)
}

export function ConnectionsNotePreview({
  note,
  onNoteChange
}: {
  note: UserNote
  onNoteChange: (note: UserNote) => void
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const untitled = t('notes.shell.untitled')
  const displayTitle = noteTitle(note, untitled)

  const [titleDraft, setTitleDraft] = useState(displayTitle)
  const [bodyDraft, setBodyDraft] = useState(note.body)
  const [saving, setSaving] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const savedSnapshotRef = useRef({ title: displayTitle, body: note.body, noteId: note.id })
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    savedSnapshotRef.current = { title: displayTitle, body: note.body, noteId: note.id }
    setTitleDraft(displayTitle)
    setBodyDraft(note.body)
    setInlineError(null)
  }, [displayTitle, note.body, note.id])

  const flushSave = useCallback(async (): Promise<void> => {
    if (autosaveTimerRef.current != null) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    const nextTitle = titleDraft.trim() || untitled
    const titleChanged = nextTitle !== savedSnapshotRef.current.title
    const bodyChanged = bodyDraft !== savedSnapshotRef.current.body
    if (!titleChanged && !bodyChanged) return
    setSaving(true)
    setInlineError(null)
    try {
      const saved = await persistNote(
        note,
        {
          ...(titleChanged ? { title: nextTitle } : {}),
          ...(bodyChanged ? { body: bodyDraft } : {})
        },
        t('notes.shell.invalidNote')
      )
      savedSnapshotRef.current = {
        title: noteTitle(saved, untitled),
        body: saved.body,
        noteId: saved.id
      }
      onNoteChange(saved)
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [bodyDraft, note, onNoteChange, t, titleDraft, untitled])

  const scheduleAutosave = useCallback((): void => {
    if (autosaveTimerRef.current != null) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void flushSave()
    }, AUTOSAVE_MS)
  }, [flushSave])

  useEffect(() => {
    const nextTitle = titleDraft.trim() || untitled
    const dirty =
      nextTitle !== savedSnapshotRef.current.title || bodyDraft !== savedSnapshotRef.current.body
    if (!dirty) return
    scheduleAutosave()
    return (): void => {
      if (autosaveTimerRef.current != null) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [bodyDraft, scheduleAutosave, titleDraft, untitled])

  const patchDisplay = useCallback(
    async (patch: { iconId?: string | null; iconColor?: string | null }): Promise<void> => {
      try {
        const next = await window.mailClient.notes.patchDisplay({
          noteId: note.id,
          ...patch
        })
        onNoteChange(next)
      } catch (e) {
        setInlineError(e instanceof Error ? e.message : String(e))
      }
    },
    [note.id, onNoteChange]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border/40 p-4 pb-3">
        <div className="flex items-start gap-2">
          <CalendarEventIconPicker
            layout="compact"
            openOn="doubleClick"
            iconId={note.iconId}
            iconColorHex={resolveEntityIconColor(note.iconColor)}
            title={titleDraft.trim() || displayTitle}
            disabled={saving}
            compactButtonClassName="mt-0.5 h-7 w-7 shrink-0 border-0 bg-transparent shadow-none hover:bg-secondary/60"
            triggerIcon={<NoteDisplayIcon note={note} className="h-4 w-4" />}
            onIconChange={(iconId): void => void patchDisplay({ iconId: iconId ?? null })}
            footer={
              <IconColorPickerFooter
                iconColor={note.iconColor}
                onIconColorChange={(iconColor): void => void patchDisplay({ iconColor })}
              />
            }
          />
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={titleDraft}
              disabled={saving}
              onChange={(e): void => setTitleDraft(e.target.value)}
              onBlur={(): void => void flushSave()}
              className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground outline-none hover:border-border/60 focus:border-border focus:bg-background focus:ring-2 focus:ring-ring/30"
            />
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>
                {t(`notes.kind.${note.kind}`)}
                {' · '}
                {formatNoteDate(note.updatedAt, i18n.language)}
              </span>
              {saving ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  {t('notes.editor.saving')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {inlineError ? <p className="text-[11px] text-destructive">{inlineError}</p> : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-3">
        <MarkdownNoteEditor
          value={bodyDraft}
          onChange={setBodyDraft}
          placeholder={t('notes.editor.placeholder')}
          fillHeight
          minHeight={160}
          layout="live"
          preview="live"
          disabled={saving}
          className="min-h-0 flex-1"
        />
      </div>

      <p className={cn('shrink-0 px-4 pb-2 text-[11px] text-muted-foreground')}>
        {t('notes.editor.markdownHint')}
      </p>
    </div>
  )
}
