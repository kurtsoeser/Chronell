import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  HorizontalSplitter,
  useResizableHeight
} from '@/components/ResizableSplitter'
import {
  MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_DEFAULT,
  MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_KEY,
  MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_MIN,
  mailNotesSidebarEditorHeightMax
} from '@/app/layout/mail-right-sidebar/mail-notes-sidebar-storage'
import type { NoteSection, UserNoteListItem } from '@shared/types'
import { useNoteBodyEditing } from '@/app/notes/hooks/use-note-body-editing'
import { NotesPagesPane } from '@/app/notes/NotesPagesPane'
import { ComposeEditorThemeToggle } from '@/components/ComposeEditorThemeToggle'
import { TipTapNoteEditorLazy } from '@/components/TipTapNoteEditorLazy'
import { getNoteByIdCached } from '@/lib/note-get-by-id-cache'
import { persistNoteListItemBody, userNoteToListItem } from '@/lib/note-body-persist'
import { readNotesPagesSort, type NotesPagesSortKey } from '@/lib/notes-pages-sort'
import { buildNotesPageRows } from '@/lib/notes-page-tree'
import {
  readNotesPageTreeCollapsed,
  toggleNotesPageTreeCollapsed,
  persistNotesPageTreeCollapsed
} from '@/lib/notes-page-collapse-storage'
import { safeMoveNoteToParent } from '@/lib/notes-ipc-client'
import { resolveNotePageTemplate, type NotePageTemplateId } from '@/lib/note-page-templates'
import type { NotePageCreateOverride } from '@/lib/note-page-create'
import { useCustomNotePageTemplates } from '@/hooks/use-custom-note-page-templates'
import { useNotesSettingsPrefs } from '@/lib/use-notes-settings-prefs'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/app-mode'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'

const EMPTY_NOTE_SELECTION: ReadonlySet<number> = new Set()

export function MailNotesSidebar(): JSX.Element {
  const { t } = useTranslation()
  const notesSettings = useNotesSettingsPrefs()
  const { customTemplates } = useCustomNotePageTemplates()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const setPendingNoteId = useNotesPendingFocusStore((s) => s.setPendingNoteId)

  const [notes, setNotes] = useState<UserNoteListItem[]>([])
  const [sections, setSections] = useState<NoteSection[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pagesSort, setPagesSort] = useState<NotesPagesSortKey>(() => readNotesPagesSort())
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<number>>(() =>
    readNotesPageTreeCollapsed()
  )
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [composeNote, setComposeNote] = useState<UserNoteListItem | null>(null)

  const bodyEditing = useNoteBodyEditing({
    note: composeNote,
    autosaveMs: 800,
    persistBody: persistNoteListItemBody,
    onSaved: (saved): void => {
      setNotes((prev) => prev.map((n) => (n.id === saved.id ? { ...n, ...saved } : n)))
      setComposeNote((prev) => (prev != null ? { ...prev, ...saved } : prev))
    }
  })

  const {
    editorFlushRef,
    editorSeedHtml,
    saving: savingBody,
    handleBodyChange,
    flushSave: flushBodySave,
    loadNoteBody,
    savedBodyRef
  } = bodyEditing

  const editorPaneHeightMax = mailNotesSidebarEditorHeightMax()
  const [editorPaneHeight, setEditorPaneHeight] = useResizableHeight({
    storageKey: MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_KEY,
    defaultHeight: MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_DEFAULT,
    minHeight: MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_MIN,
    maxHeight: editorPaneHeightMax
  })

  useEffect(() => {
    const clamp = (): void => {
      const max = mailNotesSidebarEditorHeightMax()
      setEditorPaneHeight((h) =>
        Math.min(max, Math.max(MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_MIN, h))
      )
    }
    window.addEventListener('resize', clamp)
    return (): void => window.removeEventListener('resize', clamp)
  }, [setEditorPaneHeight])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.mailClient.notes.listShellBootstrap({
        kinds: [],
        accountIds: [],
        dateFrom: null,
        dateTo: null,
        scheduledOnly: false,
        limit: 400,
        omitBody: true
      })
      setNotes(result.notes)
      setSections(result.sections)
    } catch {
      setNotes([])
      try {
        setSections(await window.mailClient.notes.sections.list())
      } catch {
        setSections([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const off = window.mailClient.events.onNotesChanged((detail) => {
      if (detail.deleted && detail.noteId != null) {
        setNotes((prev) => prev.filter((n) => n.id !== detail.noteId))
        return
      }
      if (detail.patch && detail.noteId != null) {
        setNotes((prev) => {
          const exists = prev.some((n) => n.id === detail.noteId)
          if (!exists && detail.scope === 'structure') {
            return [{ ...detail.patch, id: detail.noteId } as UserNoteListItem, ...prev]
          }
          if (!exists) return prev
          return prev.map((n) =>
            n.id === detail.noteId ? ({ ...n, ...detail.patch, id: detail.noteId! } as UserNoteListItem) : n
          )
        })
        return
      }
      void load()
    })
    return off
  }, [load])

  const pagesNotes = useMemo(() => notes, [notes])
  const pageRows = useMemo(
    () => buildNotesPageRows(pagesNotes, pagesSort, collapsedParentIds, t('notes.shell.untitled')),
    [pagesNotes, pagesSort, collapsedParentIds, t]
  )

  useEffect(() => {
    if (composeNote == null) return
    const fresh = notes.find((n) => n.id === composeNote.id)
    if (
      fresh != null &&
      fresh.updatedAt !== composeNote.updatedAt
    ) {
      void getNoteByIdCached(fresh.id).then((full) => {
        if (!full || full.updatedAt === composeNote.updatedAt) return
        if (full.body === savedBodyRef.current) {
          setComposeNote(full)
          void loadNoteBody(full)
        }
      })
    }
  }, [composeNote, loadNoteBody, notes, savedBodyRef])

  const beginCompose = useCallback(
    (note: UserNoteListItem): void => {
      void (async (): Promise<void> => {
        await flushBodySave()
        const full = (await getNoteByIdCached(note.id)) ?? note
        setActiveNoteId(full.id)
        setComposeNote(full)
        await loadNoteBody(full)
      })()
    },
    [flushBodySave, loadNoteBody]
  )

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
      const body =
        composeNote?.id === note.id
          ? savedBodyRef.current
          : ((await getNoteByIdCached(note.id)) ?? note).body
      if (note.kind === 'standalone') {
        await window.mailClient.notes.updateStandalone({ id: note.id, title, body })
      } else if (note.kind === 'mail' && note.messageId != null) {
        await window.mailClient.notes.upsertMail({ messageId: note.messageId, title, body })
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
          body,
          eventTitleSnapshot: note.eventTitleSnapshot,
          eventStartIsoSnapshot: note.eventStartIsoSnapshot
        })
      }
      void load()
    } catch {
      // ignore
    }
  }, [composeNote?.id, load, savedBodyRef])

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
      void load()
    } catch {
      // ignore
    }
  }, [load])

  const createSubPage = useCallback(
    async (parent: UserNoteListItem): Promise<void> => {
      setCreating(true)
      try {
        await flushBodySave()
        const note = await window.mailClient.notes.createStandalone({
          title: t('notes.shell.newSubPageTitle'),
          sectionId: parent.sectionId ?? null,
          parentNoteId: parent.id
        })
        const nextCollapsed = readNotesPageTreeCollapsed()
        nextCollapsed.delete(parent.id)
        persistNotesPageTreeCollapsed(nextCollapsed)
        setCollapsedParentIds(new Set(nextCollapsed))
        beginCompose(userNoteToListItem(note))
        void load()
      } catch {
        // ignore
      } finally {
        setCreating(false)
      }
    },
    [beginCompose, flushBodySave, load, t]
  )

  const moveNoteToParent = useCallback(
    async (note: UserNoteListItem, parentNoteId: number | null): Promise<void> => {
      try {
        await safeMoveNoteToParent({ noteId: note.id, parentNoteId })
        void load()
      } catch {
        // ignore
      }
    },
    [load]
  )

  const togglePageCollapse = useCallback((note: UserNoteListItem): void => {
    setCollapsedParentIds(toggleNotesPageTreeCollapsed(note.id))
  }, [])

  const createStandalone = useCallback(
    async (
      templateId: NotePageTemplateId = notesSettings.defaultNotePageTemplateId,
      override?: NotePageCreateOverride
    ): Promise<void> => {
    setCreating(true)
    try {
      await flushBodySave()
      const template = resolveNotePageTemplate(templateId, customTemplates, t)
      const title =
        override?.title ??
        (template.id === 'blank'
          ? t('notes.shell.newStandaloneTitle')
          : template.title)
      const note = await window.mailClient.notes.createStandalone({
        title,
        body: storedBodyFromEditorHtml(override?.bodyHtml ?? template.bodyHtml),
        sectionId: null
      })
      beginCompose(userNoteToListItem(note))
      void load()
      void load()
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  },
    [beginCompose, customTemplates, flushBodySave, load, notesSettings.defaultNotePageTemplateId, t]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {composeNote != null ? (
        <>
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden border-b border-border/40 bg-card"
            style={{ height: Math.min(editorPaneHeight, editorPaneHeightMax) }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">
              <TipTapNoteEditorLazy
                key={composeNote.id}
                valueHtml={editorSeedHtml}
                onChangeHtml={handleBodyChange}
                placeholder={t('mail.rightSidebar.quickComposePlaceholder')}
                variant="compact"
                fillHeight
                minHeight={120}
                flushRef={editorFlushRef}
                showThemeToggle={false}
                currentNoteId={composeNote.id}
                className="min-h-0 w-full flex-1"
              />
              <div className="mt-1.5 flex shrink-0 flex-wrap items-center justify-end gap-2">
                {savingBody ? (
                  <span className="mr-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    {t('notes.editor.saving')}
                  </span>
                ) : (
                  <ComposeEditorThemeToggle compact className="mr-auto" />
                )}
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
          </div>
          <HorizontalSplitter
            variant="subtle"
            ariaLabel={t('mail.rightSidebar.notesEditorSplitterAria')}
            onDrag={(deltaY): void => {
              setEditorPaneHeight((h) => {
                const max = mailNotesSidebarEditorHeightMax()
                return Math.min(
                  max,
                  Math.max(MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_MIN, h + deltaY)
                )
              })
            }}
          />
        </>
      ) : null}

      <div className="min-h-0 flex-1">
        <NotesPagesPane
          title={t('notes.sections.allNotes')}
          pageRows={pageRows}
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
          onCreateSubPage={createSubPage}
          onMoveToParent={moveNoteToParent}
          onTogglePageCollapse={togglePageCollapse}
          onCreateNote={(templateId, override): void => void createStandalone(templateId, override)}
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
