import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UserNote } from '@shared/types'
import { formatNoteDate, noteTitle } from '@/app/notes/notes-display-helpers'
import { NoteDisplayIcon } from '@/components/NoteDisplayIcon'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { IconColorPickerFooter } from '@/components/IconColorPickerFooter'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import { RichTextNotesPreview } from '@/components/RichTextNotesPreview'
import { useThemeStore } from '@/stores/theme'
import { cn } from '@/lib/utils'

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

type PreviewEditField = 'title' | 'body'

export function ConnectionsNotePreview({
  note,
  onNoteChange
}: {
  note: UserNote
  onNoteChange: (note: UserNote) => void
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const viewerTheme = useThemeStore((s) => s.effective)
  const untitled = t('notes.shell.untitled')
  const displayTitle = noteTitle(note, untitled)

  const [editingField, setEditingField] = useState<PreviewEditField | null>(null)
  const [titleDraft, setTitleDraft] = useState(displayTitle)
  const [bodyDraft, setBodyDraft] = useState(note.body)
  const [saving, setSaving] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const bodyEditorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditingField(null)
    setInlineError(null)
    setTitleDraft(displayTitle)
    setBodyDraft(note.body)
  }, [displayTitle, note.body, note.id])

  useEffect(() => {
    if (editingField === 'title') {
      setTitleDraft(note.title?.trim() ?? displayTitle)
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
    if (editingField === 'body') {
      setBodyDraft(note.body)
      bodyEditorRef.current?.focus()
    }
  }, [displayTitle, editingField, note.body, note.title])

  const cancelInlineEdit = useCallback((): void => {
    setEditingField(null)
    setInlineError(null)
    setTitleDraft(displayTitle)
    setBodyDraft(note.body)
  }, [displayTitle, note.body])

  const commitInlineEdit = useCallback(async (): Promise<void> => {
    if (!editingField) return
    const nextTitle = titleDraft.trim() || untitled
    const nextBody = bodyDraft
    const titleChanged = editingField === 'title' && nextTitle !== displayTitle
    const bodyChanged = editingField === 'body' && nextBody !== note.body
    setEditingField(null)
    if (!titleChanged && !bodyChanged) return
    setSaving(true)
    setInlineError(null)
    try {
      const saved = await persistNote(
        note,
        {
          ...(titleChanged ? { title: nextTitle } : {}),
          ...(bodyChanged ? { body: nextBody } : {})
        },
        t('notes.shell.invalidNote')
      )
      onNoteChange(saved)
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e))
      cancelInlineEdit()
    } finally {
      setSaving(false)
    }
  }, [
    bodyDraft,
    cancelInlineEdit,
    displayTitle,
    editingField,
    note,
    onNoteChange,
    t,
    titleDraft,
    untitled
  ])

  useEffect(() => {
    if (!editingField) return
    function onDocMouseDown(e: globalThis.MouseEvent): void {
      const target = e.target as Node
      if (editingField === 'title' && titleInputRef.current?.contains(target)) return
      if (editingField === 'body' && bodyEditorRef.current?.contains(target)) return
      void commitInlineEdit()
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      e.preventDefault()
      cancelInlineEdit()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown, true)
    return (): void => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [cancelInlineEdit, commitInlineEdit, editingField])

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

  const beginInlineEdit = useCallback(
    (field: PreviewEditField): void => {
      if (saving) return
      setEditingField(field)
    },
    [saving]
  )

  const doubleClickActivate = useCallback(
    (field: PreviewEditField) => ({
      onDoubleClick: (e: { preventDefault: () => void; stopPropagation: () => void }): void => {
        e.preventDefault()
        e.stopPropagation()
        beginInlineEdit(field)
      }
    }),
    [beginInlineEdit]
  )

  const clickableClass =
    'cursor-pointer rounded-sm transition-colors hover:bg-secondary/60'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-start gap-2">
        <CalendarEventIconPicker
          layout="compact"
          openOn="doubleClick"
          iconId={note.iconId}
          iconColorHex={resolveEntityIconColor(note.iconColor)}
          title={displayTitle}
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
          {editingField === 'title' ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              disabled={saving}
              onChange={(e): void => setTitleDraft(e.target.value)}
              onKeyDown={(e): void => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void commitInlineEdit()
                }
              }}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          ) : (
            <div
              title={t('notes.sections.renameDoubleClick')}
              className={cn('text-sm font-semibold text-foreground', clickableClass, '-mx-1 px-1')}
              {...doubleClickActivate('title')}
            >
              {displayTitle}
            </div>
          )}
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {t(`notes.kind.${note.kind}`)}
            {' · '}
            {formatNoteDate(note.updatedAt, i18n.language)}
          </div>
        </div>
      </div>
      {inlineError ? <p className="text-[11px] text-destructive">{inlineError}</p> : null}
      {editingField === 'body' ? (
        <textarea
          ref={bodyEditorRef}
          value={bodyDraft}
          disabled={saving}
          onChange={(e): void => setBodyDraft(e.target.value)}
          rows={12}
          className="min-h-[160px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      ) : (
        <div
          title={t('connections.preview.editNoteBodyDoubleClick')}
          className={cn('min-h-[80px] rounded-md', clickableClass, '-mx-1 px-1 py-1')}
          {...doubleClickActivate('body')}
        >
          {note.body.trim() ? (
            <RichTextNotesPreview notes={note.body} viewerTheme={viewerTheme} />
          ) : (
            <p className="text-xs text-muted-foreground">{t('notes.shell.emptyBody')}</p>
          )}
        </div>
      )}
    </div>
  )
}
