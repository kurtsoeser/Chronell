import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NoteSection, UserNote, UserNoteListItem } from '@shared/types'
import { NotesPagesPane } from '@/app/notes/NotesPagesPane'
import { sortNotesPages, readNotesPagesSort, type NotesPagesSortKey } from '@/lib/notes-pages-sort'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/app-mode'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'

const AUTOSAVE_MS = 800
const EMPTY_NOTE_SELECTION: ReadonlySet<number> = new Set()

function userNoteToListItem(note: UserNote): UserNoteListItem {
  return {
    ...note,
    mailSubject: null,
    mailAccountId: null,
    mailFromAddr: null,
    mailFromName: null,
    mailSnippet: null,
    mailSentAt: null,
    mailReceivedAt: null,
    mailIsRead: null,
    mailHasAttachments: null,
    primaryLinkKind: null
  }
}

async function persistNoteBody(
  note: UserNoteListItem,
  body: string
): Promise<void> {
  if (note.kind === 'standalone') {
    await window.mailClient.notes.updateStandalone({
      id: note.id,
      title: note.title ?? '',
      body
    })
    return
  }
  if (note.kind === 'mail' && note.messageId != null) {
    await window.mailClient.notes.upsertMail({
      messageId: note.messageId,
      title: note.title ?? '',
      body
    })
    return
  }
  if (
    note.kind === 'calendar' &&
    note.accountId &&
    note.calendarSource &&
    note.calendarRemoteId &&
    note.eventRemoteId
  ) {
    await window.mailClient.notes.upsertCalendar({
      accountId: note.accountId,
      calendarSource: note.calendarSource,
      calendarRemoteId: note.calendarRemoteId,
      eventRemoteId: note.eventRemoteId,
      title: note.title ?? '',
      body,
      eventTitleSnapshot: note.eventTitleSnapshot,
      eventStartIsoSnapshot: note.eventStartIsoSnapshot
    })
  }
}

export function MailNotesSidebar(): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const setPendingNoteId = useNotesPendingFocusStore((s) => s.setPendingNoteId)

  const [notes, setNotes] = useState<UserNoteListItem[]>([])
  const [sections, setSections] = useState<NoteSection[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pagesSort, setPagesSort] = useState<NotesPagesSortKey>(() => readNotesPagesSort())
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [composeNote, setComposeNote] = useState<UserNoteListItem | null>(null)
  const [bodyDraft, setBodyDraft] = useState('')
  const [savingBody, setSavingBody] = useState(false)

  const savedBodyRef = useRef('')
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.mailClient.notes.list({
        kinds: [],
        accountIds: [],
        dateFrom: null,
        dateTo: null,
        scheduledOnly: false,
        limit: 400
      })
      setNotes(result)
    } catch {
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSections = useCallback(async (): Promise<void> => {
    try {
      const rows = await window.mailClient.notes.sections.list()
      setSections(rows)
    } catch {
      setSections([])
    }
  }, [])

  useEffect(() => {
    void load()
    void loadSections()
  }, [load, loadSections])

  useEffect(() => {
    const off = window.mailClient.events.onNotesChanged(() => {
      void load()
      void loadSections()
    })
    return off
  }, [load, loadSections])

  const pagesNotes = useMemo(() => sortNotesPages(notes, pagesSort, t('notes.shell.untitled')), [notes, pagesSort, t])

  const beginCompose = useCallback((note: UserNoteListItem): void => {
    setActiveNoteId(note.id)
    setComposeNote(note)
    setBodyDraft(note.body)
    savedBodyRef.current = note.body
  }, [])

  useEffect(() => {
    if (composeNote == null) return
    const fresh = notes.find((n) => n.id === composeNote.id)
    if (fresh != null && fresh.body !== composeNote.body && fresh.body === savedBodyRef.current) {
      setComposeNote(fresh)
      setBodyDraft(fresh.body)
      savedBodyRef.current = fresh.body
    }
  }, [composeNote, notes])

  const flushBodySave = useCallback(async (): Promise<void> => {
    if (autosaveTimerRef.current != null) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    if (composeNote == null || bodyDraft === savedBodyRef.current) return
    setSavingBody(true)
    try {
      await persistNoteBody(composeNote, bodyDraft)
      savedBodyRef.current = bodyDraft
      setNotes((prev) =>
        prev.map((n) => (n.id === composeNote.id ? { ...n, body: bodyDraft } : n))
      )
      setComposeNote((prev) => (prev != null ? { ...prev, body: bodyDraft } : prev))
    } catch {
      // ignore
    } finally {
      setSavingBody(false)
    }
  }, [bodyDraft, composeNote])

  const scheduleBodyAutosave = useCallback((): void => {
    if (autosaveTimerRef.current != null) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void flushBodySave()
    }, AUTOSAVE_MS)
  }, [flushBodySave])

  useEffect(() => {
    if (composeNote == null) return
    if (bodyDraft === savedBodyRef.current) return
    scheduleBodyAutosave()
    return (): void => {
      if (autosaveTimerRef.current != null) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [bodyDraft, composeNote, scheduleBodyAutosave])

  const openNote = useCallback(
    (note: UserNoteListItem): void => {
      beginCompose(note)
    },
    [beginCompose]
  )

  const openInNotesModule = useCallback(
    async (noteId?: number): Promise<void> => {
      await flushBodySave()
      if (noteId != null) setPendingNoteId(noteId)
      setAppMode('notes')
    },
    [flushBodySave, setAppMode, setPendingNoteId]
  )

  const patchNoteDisplayInList = useCallback(
    async (note: UserNoteListItem, patch: { iconId?: string | null; iconColor?: string | null }): Promise<void> => {
      try {
        const next = await window.mailClient.notes.patchDisplay({ noteId: note.id, ...patch })
        setNotes((prev) => prev.map((n) => (n.id === next.id ? ({ ...n, ...next } as UserNoteListItem) : n)))
      } catch {
        // ignore
      }
    },
    []
  )

  const renameNoteTitleInList = useCallback(async (note: UserNoteListItem, title: string): Promise<void> => {
    try {
      if (note.kind === 'standalone') {
        await window.mailClient.notes.updateStandalone({ id: note.id, title, body: note.body })
      } else if (note.kind === 'mail' && note.messageId != null) {
        await window.mailClient.notes.upsertMail({ messageId: note.messageId, title, body: note.body })
      } else if (
        note.kind === 'calendar' &&
        note.accountId &&
        note.calendarSource &&
        note.calendarRemoteId &&
        note.eventRemoteId
      ) {
        await window.mailClient.notes.upsertCalendar({
          accountId: note.accountId,
          calendarSource: note.calendarSource,
          calendarRemoteId: note.calendarRemoteId,
          eventRemoteId: note.eventRemoteId,
          title,
          body: note.body,
          eventTitleSnapshot: note.eventTitleSnapshot,
          eventStartIsoSnapshot: note.eventStartIsoSnapshot
        })
      }
      void load()
    } catch {
      // ignore
    }
  }, [load])

  const deleteNote = useCallback(async (note: UserNoteListItem): Promise<void> => {
    try {
      await window.mailClient.notes.delete(note.id)
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
      setActiveNoteId((id) => (id === note.id ? null : id))
      setComposeNote((current) => (current?.id === note.id ? null : current))
    } catch {
      // ignore
    }
  }, [])

  const isNoteExiting = useCallback((_noteId: number): boolean => false, [])

  const copyNote = useCallback(async (note: UserNoteListItem): Promise<void> => {
    try {
      const full = (await window.mailClient.notes.getById(note.id)) ?? note
      await window.mailClient.notes.createStandalone({
        title: full.title?.trim()
          ? `${full.title.trim()}${t('calendar.context.duplicateSuffix')}`
          : t('notes.shell.newStandaloneTitle'),
        body: full.body,
        sectionId: full.sectionId ?? note.sectionId ?? null
      })
      void load()
    } catch {
      // ignore
    }
  }, [load, t])

  const moveNote = useCallback(async (note: UserNoteListItem, sectionId: number | null): Promise<void> => {
    try {
      await window.mailClient.notes.moveToSection({ noteId: note.id, sectionId })
      void load()
      void loadSections()
    } catch {
      // ignore
    }
  }, [load, loadSections])

  const createStandalone = useCallback(async (): Promise<void> => {
    setCreating(true)
    try {
      await flushBodySave()
      const note = await window.mailClient.notes.createStandalone({
        title: t('notes.shell.newStandaloneTitle'),
        body: '',
        sectionId: null
      })
      beginCompose(userNoteToListItem(note))
      void load()
      void loadSections()
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  }, [beginCompose, flushBodySave, load, loadSections, t])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {composeNote != null ? (
        <div className="shrink-0 border-b border-border/40 bg-card px-2 py-2">
          <textarea
            value={bodyDraft}
            onChange={(e): void => setBodyDraft(e.target.value)}
            onBlur={(): void => void flushBodySave()}
            placeholder={t('mail.rightSidebar.quickComposePlaceholder')}
            rows={4}
            disabled={savingBody}
            className={cn(
              'w-full resize-none rounded-md border border-border/60 bg-background/80 px-2 py-1.5',
              'text-xs leading-relaxed text-foreground outline-none',
              'placeholder:text-muted-foreground focus:border-border focus:ring-2 focus:ring-ring/30'
            )}
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2">
            {savingBody ? (
              <span className="mr-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {t('notes.editor.saving')}
              </span>
            ) : null}
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1',
                'text-2xs font-medium text-foreground hover:bg-secondary/60'
              )}
              onClick={(): void => void openInNotesModule(composeNote.id)}
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              {t('mail.rightSidebar.openNoteInModule')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <NotesPagesPane
          title={t('notes.sections.allNotes')}
          notes={pagesNotes}
          sections={sections}
          showSectionLabels={false}
          loading={loading}
          activeNoteId={activeNoteId}
          selectedNoteIds={EMPTY_NOTE_SELECTION}
          onOpenNote={(n): void => openNote(n)}
          onRenameNoteTitle={renameNoteTitleInList}
          onPatchNoteDisplay={patchNoteDisplayInList}
          onDeleteNote={deleteNote}
          isNoteExiting={isNoteExiting}
          onCopyNote={copyNote}
          onMoveNote={moveNote}
          onCreateNote={(): void => void createStandalone()}
          creating={creating}
          pagesSort={pagesSort}
          onPagesSortChange={setPagesSort}
          headerTrailing={
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1',
                'text-2xs font-medium text-foreground hover:bg-secondary/60'
              )}
              onClick={(): void => void openInNotesModule()}
              title={t('mail.rightSidebar.openNotes')}
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              {t('mail.rightSidebar.openNotes')}
            </button>
          }
        />
      </div>
    </div>
  )
}
