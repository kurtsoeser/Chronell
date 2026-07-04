import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { NoteMeetingInsertResult } from '@/app/notes/NoteMeetingInsertDialog'
import type { NotePageTemplateId } from '@/lib/note-page-templates'
import type { NotePageCreateOverride } from '@/lib/note-page-create'
import type { NoteScheduleDraft } from '@/app/notes/shell/notes-shell-types'
import {
  persistUserNoteEdits,
  readNoteEditingUnsavedChanges
} from '@/app/notes/shell/notes-shell-persist'
import { buildNoteBreadcrumb } from '@/lib/notes-page-tree'
import {
  normalizeNoteBodyForStorage,
  prepareNoteBodyForEditor,
  storedBodyFromEditorHtml
} from '@/lib/note-body-html'
import { resolveNotePageTemplate } from '@/lib/note-page-templates'
import { sectionIdForNewNote, type NotesNavSelection } from '@/lib/notes-nav-selection'
import type { NoteEmbedInsertTarget } from '@shared/note-embed-insert'
import { insertNoteEmbedInEditor, resolveNoteEmbedInsertTarget } from '@/lib/note-embed-insert'
import { getNoteByIdCached, invalidateNoteGetByIdCache } from '@/lib/note-get-by-id-cache'
import type { NoteEditorSaveStatus } from '@/lib/note-editor-save-status'
import { noteSaveConflictDetected } from '@/lib/note-save-conflict'
import { withNoteSaveRetry } from '@/lib/note-save-with-retry'
import { refreshNoteMeetingDetailsInHtml } from '@/lib/note-meeting-refresh'
import { noteHtmlHasMeetingBlocks } from '@shared/note-meeting-sync'
import { runScreenClipCapture } from '@/lib/note-screen-clip'
import { GLOBAL_CREATE_EVENT, useGlobalCreateNavigateStore } from '@/lib/global-create'
import { registerNotesEditorFlush } from '@/lib/notes-editor-flush-bridge'
import {
  NOTES_AUTOSAVE_DEBOUNCE_MS,
  NOTES_LINKS_BODY_DEBOUNCE_MS
} from '@/lib/notes-autosave'
import { useNoteInkDraw } from '@/app/notes/use-note-ink-draw'
import { useNoteCloudTask } from '@/app/notes/use-note-cloud-task'
import { useNoteCalendarEvent } from '@/app/notes/use-note-calendar-event'
import { useNoteCloudTaskSync } from '@/app/notes/use-note-cloud-task-sync'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import type { ConnectedAccount, NoteSection, UserNote, UserNoteListItem } from '@shared/types'
import type { NotesSidebarListMode } from '@/lib/notes-sidebar-storage'
import type { CustomNotePageTemplate } from '@/lib/note-page-templates-custom'
import type { NotesSettingsPrefsV1 } from '@/lib/notes-settings-prefs'
import type { Locale } from 'date-fns'
import { persistNotesActiveShellView } from '@/app/notes/notes-active-shell-view-storage'
import {
  persistLastOpenedNoteId,
  readLastOpenedNoteId
} from '@/app/notes/notes-last-opened-note-storage'
import type { NotesShellView } from '@/app/notes/NotesShellViewToggle'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'

export interface UseNotesEditorSessionOptions {
  notes: UserNoteListItem[]
  sections: NoteSection[]
  applyNotePatch: (note: UserNote | UserNoteListItem) => void
  load: () => Promise<void>
  loadSections: () => Promise<void>
  notesSettings: NotesSettingsPrefsV1
  accounts: ConnectedAccount[]
  customTemplates: CustomNotePageTemplate[]
  listMode: NotesSidebarListMode
  navSelection: NotesNavSelection
  clearSelectedMessage: () => void
  selectMessageWithThreadPreview: (messageId: number) => void
  pushToast: (input: { label: string; variant: 'success' | 'error' | 'info' }) => void
  t: (key: string, options?: Record<string, unknown>) => string
  dfLocale: Locale
  onShellViewChange: (view: NotesShellView) => void
  reloadLinksBundle: (noteId: number) => Promise<void>
  expandParentPage: (parentId: number) => void
  notesLoading: boolean
}

export function useNotesEditorSession({
  notes,
  sections,
  applyNotePatch,
  load,
  loadSections,
  notesSettings,
  accounts,
  customTemplates,
  listMode,
  navSelection,
  clearSelectedMessage,
  selectMessageWithThreadPreview,
  pushToast,
  t,
  dfLocale,
  onShellViewChange,
  reloadLinksBundle,
  expandParentPage,
  notesLoading
}: UseNotesEditorSessionOptions) {
  const pendingNoteId = useNotesPendingFocusStore((s) => s.pendingNoteId)
  const takePendingNoteId = useNotesPendingFocusStore((s) => s.takePendingNoteId)

  const [editing, setEditing] = useState<UserNote | null>(null)
  const [editorSeedHtml, setEditorSeedHtml] = useState('')
  const [linksBodyHtml, setLinksBodyHtml] = useState('')
  const [scheduleDraft, setScheduleDraft] = useState<NoteScheduleDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [openingNote, setOpeningNote] = useState(false)
  const [saveStatus, setSaveStatus] = useState<NoteEditorSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meetingInsertOpen, setMeetingInsertOpen] = useState(false)
  const [meetingRefreshBusy, setMeetingRefreshBusy] = useState(false)
  const [hasMeetingBlocks, setHasMeetingBlocks] = useState(false)
  const [embedInsertOpen, setEmbedInsertOpen] = useState(false)

  const editTitleRef = useRef('')
  const editBodyRef = useRef('')
  const editorFlushRef = useRef<(() => void) | null>(null)
  const editorInsertHtmlRef = useRef<((html: string) => void) | null>(null)
  const editorInsertEmbedRef = useRef<((target: NoteEmbedInsertTarget) => boolean) | null>(null)
  const editorReplaceInkRef = useRef<((inkJsonAttachmentId: number, html: string) => void) | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const editorFocusedRef = useRef(false)
  const lastSavedTitleRef = useRef('')
  const lastSavedBodyRef = useRef('')
  const lastSyncedUpdatedAtRef = useRef('')
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingRef = useRef<UserNote | null>(null)
  const openEditGenerationRef = useRef(0)
  const lastOpenedNoteRestoredRef = useRef(false)
  const scheduleDraftRef = useRef<NoteScheduleDraft | null>(null)
  const savingRef = useRef(false)
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const linksBodyHtmlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  editingRef.current = editing
  scheduleDraftRef.current = scheduleDraft

  const taskAccounts = useMemo(
    () => accounts.filter(accountSupportsCloudTasks),
    [accounts]
  )

  const noteInk = useNoteInkDraw({
    noteId: editing?.id,
    insertHtmlRef: editorInsertHtmlRef,
    replaceInkSnapshotRef: editorReplaceInkRef,
    onError: (message): void => {
      pushToast({ label: message, variant: 'error' })
    },
    onSuccess: (message): void => {
      pushToast({ label: message, variant: 'success' })
    }
  })

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes])

  const editingBreadcrumb = useMemo(() => {
    if (!editing) return []
    return buildNoteBreadcrumb(editing.id, notesById)
  }, [editing, notesById])

  const editingSectionName = useMemo(() => {
    if (!editing?.sectionId) return null
    return sections.find((s) => s.id === editing.sectionId)?.name ?? null
  }, [editing?.sectionId, sections])

  const flushAutosaveTimer = useCallback((): void => {
    if (autosaveTimerRef.current != null) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }, [])

  const readCurrentUnsavedChanges = useCallback((): boolean => {
    const note = editingRef.current
    if (!note) return false
    return readNoteEditingUnsavedChanges(note, {
      editTitle: editTitleRef.current,
      editBodyHtml: editBodyRef.current,
      lastSavedTitle: lastSavedTitleRef.current,
      lastSavedBody: lastSavedBodyRef.current,
      scheduleDraft: scheduleDraftRef.current
    })
  }, [])

  const syncSaveStatusFromDraft = useCallback((): void => {
    if (!editingRef.current) return
    if (readCurrentUnsavedChanges()) {
      setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'))
    } else {
      setSaveStatus('saved')
    }
  }, [readCurrentUnsavedChanges])

  const applySavedNoteToEditorRefs = useCallback((saved: UserNote): void => {
    const prepared = prepareNoteBodyForEditor(saved.body)
    editBodyRef.current = prepared.html
    lastSavedBodyRef.current = saved.body
    editTitleRef.current = saved.title ?? ''
    lastSavedTitleRef.current = saved.title ?? ''
    lastSyncedUpdatedAtRef.current = saved.updatedAt
  }, [])

  const flushPendingNoteSave = useCallback(
    async (opts?: { silent?: boolean; manual?: boolean }): Promise<void> => {
      if (saveInFlightRef.current) {
        await saveInFlightRef.current
      }
      const note = editingRef.current
      if (!note || savingRef.current) return
      editorFlushRef.current?.()
      const draft = scheduleDraftRef.current
      if (
        !readNoteEditingUnsavedChanges(note, {
          editTitle: editTitleRef.current,
          editBodyHtml: editBodyRef.current,
          lastSavedTitle: lastSavedTitleRef.current,
          lastSavedBody: lastSavedBodyRef.current,
          scheduleDraft: draft
        })
      ) {
        setSaveStatus('saved')
        if (opts?.manual && !opts?.silent) {
          pushToast({ label: t('notes.editor.saved'), variant: 'success' })
        }
        return
      }

      const savePromise = (async (): Promise<void> => {
        const noteToSave = editingRef.current
        if (!noteToSave) return
        setSaving(true)
        savingRef.current = true
        setSaveStatus('saving')
        setError(null)
        try {
          editorFlushRef.current?.()
          invalidateNoteGetByIdCache(noteToSave.id)
          const remote = await window.mailClient.notes.getById(noteToSave.id)
          if (
            remote &&
            noteSaveConflictDetected(lastSyncedUpdatedAtRef.current, remote.updatedAt)
          ) {
            setSaveStatus('conflict')
            setError(t('notes.editor.conflict'))
            return
          }
          const saved = await withNoteSaveRetry(() =>
            persistUserNoteEdits(t('notes.shell.invalidNote'), noteToSave, {
              title: editTitleRef.current,
              bodyHtml: editBodyRef.current,
              scheduleDraft: scheduleDraftRef.current
            })
          )
          applySavedNoteToEditorRefs(saved)
          setLastSavedAt(saved.updatedAt)
          setSaveStatus('saved')
          if (editingRef.current?.id === noteToSave.id) {
            setEditing((prev) => (prev?.id === noteToSave.id ? { ...prev, ...saved } : prev))
            applyNotePatch(saved)
            if (!opts?.silent) {
              pushToast({ label: t('notes.editor.saved'), variant: 'success' })
            }
            setScheduleDraft(null)
          } else {
            applyNotePatch(saved)
          }
        } catch (e) {
          setSaveStatus('error')
          if (editingRef.current?.id === noteToSave.id) {
            setError(e instanceof Error ? e.message : String(e))
          }
        } finally {
          savingRef.current = false
          setSaving(false)
        }
      })()

      saveInFlightRef.current = savePromise
      try {
        await savePromise
      } finally {
        if (saveInFlightRef.current === savePromise) {
          saveInFlightRef.current = null
        }
      }
    },
    [applyNotePatch, applySavedNoteToEditorRefs, pushToast, t]
  )

  const flushAllNoteEdits = useCallback(
    async (opts?: { silent?: boolean; force?: boolean; manual?: boolean }): Promise<void> => {
      if (!opts?.force && notesSettings.autosaveMode === 'off') return
      if (autosaveTimerRef.current != null) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await flushPendingNoteSave(opts)
        const note = editingRef.current
        if (!note) return
        editorFlushRef.current?.()
        if (
          !readNoteEditingUnsavedChanges(note, {
            editTitle: editTitleRef.current,
            editBodyHtml: editBodyRef.current,
            lastSavedTitle: lastSavedTitleRef.current,
            lastSavedBody: lastSavedBodyRef.current,
            scheduleDraft: scheduleDraftRef.current
          })
        ) {
          return
        }
      }
    },
    [flushPendingNoteSave, notesSettings.autosaveMode]
  )

  const persistMigratedBody = useCallback(
    async (note: UserNote, body: string): Promise<UserNote | null> => {
      try {
        if (note.kind === 'standalone') {
          return await window.mailClient.notes.updateStandalone({ id: note.id, body })
        }
        if (note.kind === 'mail' && note.messageId != null) {
          return await window.mailClient.notes.upsertMail({
            messageId: note.messageId,
            title: note.title ?? undefined,
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
          return await window.mailClient.notes.upsertCalendar({
            accountId: note.accountId,
            calendarSource: note.calendarSource,
            calendarRemoteId: note.calendarRemoteId,
            eventRemoteId: note.eventRemoteId,
            title: note.title ?? undefined,
            body,
            eventTitleSnapshot: note.eventTitleSnapshot,
            eventStartIsoSnapshot: note.eventStartIsoSnapshot
          })
        }
        return null
      } catch {
        return null
      }
    },
    []
  )

  const openEdit = useCallback(
    (note: UserNoteListItem | UserNote): void => {
      const generation = ++openEditGenerationRef.current
      setOpeningNote(true)
      void (async (): Promise<void> => {
        try {
          if (autosaveTimerRef.current != null) {
            clearTimeout(autosaveTimerRef.current)
            autosaveTimerRef.current = null
          }
          if (linksBodyHtmlDebounceRef.current != null) {
            clearTimeout(linksBodyHtmlDebounceRef.current)
            linksBodyHtmlDebounceRef.current = null
          }
          await flushAllNoteEdits({ silent: true })
          if (generation !== openEditGenerationRef.current) return
          let resolved: UserNoteListItem = note as UserNoteListItem
          try {
            invalidateNoteGetByIdCache(note.id)
            const fresh = await getNoteByIdCached(note.id)
            if (generation !== openEditGenerationRef.current) return
            if (fresh) resolved = fresh
          } catch {
            // Liste nutzen wenn getById fehlschlaegt.
          }
          const prepared = prepareNoteBodyForEditor(resolved.body)
          const editorHtml = prepared.html
          applySavedNoteToEditorRefs(resolved)
          persistLastOpenedNoteId(resolved.id)
          setEditing(resolved)
          setEditorSeedHtml(editorHtml)
          setLinksBodyHtml(editorHtml)
          setHasMeetingBlocks(noteHtmlHasMeetingBlocks(editorHtml))
          setScheduleDraft(null)
          setLastSavedAt(resolved.updatedAt)
          setSaveStatus('saved')
          setError(null)
          if (prepared.migratedFromMarkdown) {
            const stored = normalizeNoteBodyForStorage(editorHtml)
            const saved = await persistMigratedBody(resolved, stored)
            if (generation !== openEditGenerationRef.current) return
            if (saved) {
              applySavedNoteToEditorRefs(saved)
              setLastSavedAt(saved.updatedAt)
              setSaveStatus('saved')
              applyNotePatch(saved)
              setEditing({ ...resolved, ...saved })
            }
          }
          if (resolved.kind === 'mail' && resolved.messageId != null) {
            void selectMessageWithThreadPreview(resolved.messageId)
          } else {
            clearSelectedMessage()
          }
        } finally {
          if (generation === openEditGenerationRef.current) {
            setOpeningNote(false)
          }
        }
      })()
    },
    [applyNotePatch, applySavedNoteToEditorRefs, clearSelectedMessage, flushAllNoteEdits, persistMigratedBody, selectMessageWithThreadPreview]
  )

  const openNoteById = useCallback(
    async (id: number): Promise<void> => {
      try {
        const note = await getNoteByIdCached(id)
        if (note) {
          openEdit(note)
          return
        }
      } catch {
        // ignore
      }
      const fromList = notes.find((n) => n.id === id)
      if (fromList) openEdit(fromList)
    },
    [notes, openEdit]
  )

  const openNoteInListFromCalendar = useCallback(
    (note: UserNoteListItem): void => {
      onShellViewChange('list')
      persistNotesActiveShellView('list')
      openEdit(note)
    },
    [onShellViewChange, openEdit]
  )

  const closeEditor = useCallback((): void => {
    void (async (): Promise<void> => {
      await flushAllNoteEdits({ silent: true })
      setEditing(null)
      setScheduleDraft(null)
      setSaveStatus('idle')
      setLastSavedAt(null)
      clearSelectedMessage()
    })()
  }, [clearSelectedMessage, flushAllNoteEdits])

  const patchNoteDisplay = useCallback(
    async (patch: { iconId?: string | null; iconColor?: string | null }): Promise<void> => {
      if (!editing) return
      try {
        const next = await window.mailClient.notes.patchDisplay({
          noteId: editing.id,
          ...patch
        })
        applyNotePatch(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [editing, applyNotePatch]
  )

  const patchNoteDisplayInList = useCallback(
    async (
      note: UserNoteListItem,
      patch: { iconId?: string | null; iconColor?: string | null }
    ): Promise<void> => {
      try {
        const next = await window.mailClient.notes.patchDisplay({
          noteId: note.id,
          ...patch
        })
        applyNotePatch(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [applyNotePatch]
  )

  const renameNoteTitleInList = useCallback(
    async (note: UserNoteListItem, title: string): Promise<void> => {
      setError(null)
      try {
        let saved: UserNote
        if (note.kind === 'standalone') {
          saved = await window.mailClient.notes.updateStandalone({
            id: note.id,
            title,
            body: note.body
          })
        } else if (note.kind === 'mail' && note.messageId != null) {
          saved = await window.mailClient.notes.upsertMail({
            messageId: note.messageId,
            title,
            body: note.body
          })
        } else if (
          note.kind === 'calendar' &&
          note.accountId &&
          note.calendarSource &&
          note.calendarRemoteId &&
          note.eventRemoteId
        ) {
          saved = await window.mailClient.notes.upsertCalendar({
            accountId: note.accountId,
            calendarSource: note.calendarSource,
            calendarRemoteId: note.calendarRemoteId,
            eventRemoteId: note.eventRemoteId,
            title,
            body: note.body,
            eventTitleSnapshot: note.eventTitleSnapshot,
            eventStartIsoSnapshot: note.eventStartIsoSnapshot
          })
        } else {
          throw new Error(t('notes.shell.invalidNote'))
        }
        applyNotePatch(saved)
        if (editing?.id === note.id) editTitleRef.current = title
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [applyNotePatch, editing?.id, t]
  )

  const createStandalone = useCallback(
    async (
      templateId: NotePageTemplateId = notesSettings.defaultNotePageTemplateId,
      override?: NotePageCreateOverride
    ): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        const template = resolveNotePageTemplate(templateId, customTemplates, t)
        const sectionId = listMode === 'sections' ? sectionIdForNewNote(navSelection) : null
        const title =
          override?.title ??
          (template.id === 'blank' ? t('notes.shell.newStandaloneTitle') : template.title)
        const note = await window.mailClient.notes.createStandalone({
          title,
          body: storedBodyFromEditorHtml(override?.bodyHtml ?? template.bodyHtml),
          sectionId
        })
        clearSelectedMessage()
        if (notesSettings.openNoteAfterCreate) {
          openEdit(note)
        } else {
          await load()
          await loadSections()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSaving(false)
      }
    },
    [
      t,
      clearSelectedMessage,
      openEdit,
      listMode,
      navSelection,
      notesSettings.openNoteAfterCreate,
      notesSettings.defaultNotePageTemplateId,
      customTemplates,
      load,
      loadSections
    ]
  )

  const autosaveRef = useRef({ run: async (): Promise<void> => {} })
  autosaveRef.current = {
    run: async (): Promise<void> => {
      if (notesSettings.autosaveMode === 'off') return
      await flushPendingNoteSave({ silent: true })
    }
  }

  const scheduleAutosave = useCallback((): void => {
    if (notesSettings.autosaveMode !== 'on_change' || !editingRef.current) return
    flushAutosaveTimer()
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void autosaveRef.current.run()
    }, NOTES_AUTOSAVE_DEBOUNCE_MS)
  }, [flushAutosaveTimer, notesSettings.autosaveMode])

  const handleTitleChange = useCallback(
    (title: string): void => {
      editTitleRef.current = title
      syncSaveStatusFromDraft()
      if (readCurrentUnsavedChanges()) scheduleAutosave()
    },
    [readCurrentUnsavedChanges, scheduleAutosave, syncSaveStatusFromDraft]
  )

  const scheduleLinksBodyHtmlUpdate = useCallback((html: string): void => {
    if (linksBodyHtmlDebounceRef.current != null) {
      clearTimeout(linksBodyHtmlDebounceRef.current)
    }
    linksBodyHtmlDebounceRef.current = setTimeout(() => {
      linksBodyHtmlDebounceRef.current = null
      setLinksBodyHtml(html)
    }, NOTES_LINKS_BODY_DEBOUNCE_MS)
  }, [])

  const handleEditBodyChangeWithAutosave = useCallback(
    (html: string): void => {
      editBodyRef.current = html
      setHasMeetingBlocks(noteHtmlHasMeetingBlocks(html))
      scheduleLinksBodyHtmlUpdate(html)
      syncSaveStatusFromDraft()
      if (readCurrentUnsavedChanges()) scheduleAutosave()
    },
    [readCurrentUnsavedChanges, scheduleAutosave, scheduleLinksBodyHtmlUpdate, syncSaveStatusFromDraft]
  )

  const handleCloudTaskSyncHtml = useCallback(
    (html: string): void => {
      editBodyRef.current = html
      setEditorSeedHtml(html)
      setHasMeetingBlocks(noteHtmlHasMeetingBlocks(html))
      scheduleLinksBodyHtmlUpdate(html)
      scheduleAutosave()
    },
    [scheduleAutosave, scheduleLinksBodyHtmlUpdate]
  )

  const embedMeetingMediaUrls = useCallback(
    async (urls: string[]): Promise<void> => {
      if (urls.length === 0) return
      for (const url of urls) {
        try {
          const target = await resolveNoteEmbedInsertTarget(url)
          if (target) {
            const inserted = editorInsertEmbedRef.current?.(target)
            if (!inserted) {
              const editor = editorRef.current
              if (editor && !editor.isDestroyed) {
                insertNoteEmbedInEditor(editor, target, handleEditBodyChangeWithAutosave)
              }
            }
          }
        } catch {
          // Einzelnes Embed still ignorieren
        }
      }
    },
    [handleEditBodyChangeWithAutosave]
  )

  const handleMeetingInsert = useCallback(
    async (result: NoteMeetingInsertResult, html: string): Promise<void> => {
      if (!editing) return
      editorInsertHtmlRef.current?.(html)
      const embedUrls: string[] = []
      if (result.embedRecording && result.recordingUrl) embedUrls.push(result.recordingUrl)
      if (result.embedRecap && result.recapUrl) embedUrls.push(result.recapUrl)
      if (embedUrls.length > 0) {
        await embedMeetingMediaUrls(embedUrls)
      }
      setHasMeetingBlocks(noteHtmlHasMeetingBlocks(editBodyRef.current))
      if (result.scheduleNote) {
        setScheduleDraft({
          scheduledStartIso: result.event.startIso,
          scheduledEndIso: result.event.endIso,
          scheduledAllDay: result.event.isAllDay
        })
      }
      if (result.linkToEvent && result.event.graphEventId?.trim()) {
        try {
          await window.mailClient.notes.links.add({
            fromNoteId: editing.id,
            target: {
              kind: 'calendar_event',
              accountId: result.event.accountId,
              graphEventId: result.event.graphEventId
            }
          })
          await reloadLinksBundle(editing.id)
        } catch (e) {
          pushToast({
            label: e instanceof Error ? e.message : String(e),
            variant: 'error'
          })
        }
      }
      pushToast({ label: t('notes.meetingInsert.insertedToast'), variant: 'success' })
    },
    [editing, embedMeetingMediaUrls, pushToast, reloadLinksBundle, t]
  )

  const reloadNoteLinks = useCallback((): void => {
    if (!editing) return
    void reloadLinksBundle(editing.id)
  }, [editing, reloadLinksBundle])

  const noteCloudTask = useNoteCloudTask({
    noteId: editing?.id,
    taskAccounts,
    insertHtmlRef: editorInsertHtmlRef,
    getEditor: (): Editor | null => editorRef.current,
    onLinksChanged: reloadNoteLinks,
    onError: (message): void => {
      pushToast({ label: message, variant: 'error' })
    },
    onSuccess: (message): void => {
      pushToast({ label: message, variant: 'success' })
    }
  })

  const noteCalendarEvent = useNoteCalendarEvent({
    noteId: editing?.id,
    accounts,
    insertHtmlRef: editorInsertHtmlRef,
    getEditor: (): Editor | null => editorRef.current,
    onLinksChanged: reloadNoteLinks,
    onError: (message): void => {
      pushToast({ label: message, variant: 'error' })
    },
    onSuccess: (message): void => {
      pushToast({ label: message, variant: 'success' })
    }
  })

  useNoteCloudTaskSync({
    noteId: editing?.id,
    getBodyHtml: (): string => editBodyRef.current,
    onApplyHtml: handleCloudTaskSyncHtml,
    flushRef: editorFlushRef,
    editorFocusedRef,
    enabled: Boolean(editing)
  })

  const handleMeetingDetailsRefresh = useCallback(async (): Promise<void> => {
    if (!editing) return
    editorFlushRef.current?.()
    setMeetingRefreshBusy(true)
    try {
      const labels = {
        date: t('notes.meetingInsert.fieldDate'),
        location: t('notes.meetingInsert.fieldLocation'),
        organizer: t('notes.meetingInsert.fieldOrganizer'),
        attendees: t('notes.meetingInsert.fieldAttendees'),
        onlineMeeting: t('notes.meetingInsert.fieldOnlineMeeting'),
        joinMeeting: t('notes.meetingInsert.joinMeeting'),
        meetingRecap: t('notes.meetingInsert.fieldMeetingRecap'),
        viewRecap: t('notes.meetingInsert.viewRecap'),
        meetingRecording: t('notes.meetingInsert.fieldMeetingRecording'),
        viewRecording: t('notes.meetingInsert.viewRecording'),
        agenda: t('notes.meetingInsert.agenda'),
        notes: t('notes.meetingInsert.notes'),
        nextSteps: t('notes.meetingInsert.nextSteps')
      }
      const result = await refreshNoteMeetingDetailsInHtml(
        editBodyRef.current,
        labels,
        dfLocale,
        t('notes.meetingInsert.allDay')
      )
      if (result.updatedCount === 0 && result.newEmbeds.length === 0) {
        pushToast({ label: t('notes.meetingRefresh.nothingToUpdate'), variant: 'info' })
        return
      }
      handleCloudTaskSyncHtml(result.html)
      if (result.newEmbeds.length > 0) {
        await embedMeetingMediaUrls(result.newEmbeds)
      }
      pushToast({ label: t('notes.meetingRefresh.updatedToast'), variant: 'success' })
    } catch (e) {
      pushToast({
        label: e instanceof Error ? e.message : String(e),
        variant: 'error'
      })
    } finally {
      setMeetingRefreshBusy(false)
    }
  }, [dfLocale, editing, embedMeetingMediaUrls, handleCloudTaskSyncHtml, pushToast, t])

  const handleScreenClip = useCallback((): void => {
    void runScreenClipCapture({
      activeNoteId: editing?.id ?? null,
      insertHtml: (html): void => {
        editorInsertHtmlRef.current?.(html)
      }
    })
  }, [editing?.id])

  const handleInkImageDoubleClick = useCallback(
    (inkJsonAttachmentId: number): void => {
      void noteInk.openInkEdit(inkJsonAttachmentId)
    },
    [noteInk]
  )

  const noteExportPayload = useCallback((): { title: string; bodyHtml: string } | null => {
    if (!editing) return null
    editorFlushRef.current?.()
    const title = editTitleRef.current.trim() || t('notes.shell.untitled')
    return { title, bodyHtml: editBodyRef.current }
  }, [editing, t])

  const handleExportPdf = useCallback((): void => {
    const payload = noteExportPayload()
    if (!payload) return
    void (async (): Promise<void> => {
      setError(null)
      const res = await window.mailClient.notes.exportPdf({
        ...payload,
        suggestedFileName: `${payload.title}.pdf`
      })
      if (!res.ok && !res.cancelled && res.error) setError(res.error)
    })()
  }, [noteExportPayload])

  const handlePrintPage = useCallback((): void => {
    const payload = noteExportPayload()
    if (!payload) return
    void (async (): Promise<void> => {
      setError(null)
      const res = await window.mailClient.notes.printPage(payload)
      if (!res.ok && res.error) setError(res.error)
    })()
  }, [noteExportPayload])

  const saveEditing = useCallback(
    async (opts?: { silent?: boolean }): Promise<void> => {
      if (!editingRef.current) return
      editorFlushRef.current?.()
      syncSaveStatusFromDraft()
      await flushAllNoteEdits({
        ...opts,
        force: true,
        manual: opts?.silent !== true
      })
    },
    [flushAllNoteEdits, syncSaveStatusFromDraft]
  )

  useEffect(() => {
    if (!editing) return
    const fresh = notes.find((n) => n.id === editing.id)
    if (!fresh) return
    setEditing((prev) => {
      if (prev?.id !== fresh.id) return prev
      if (
        readNoteEditingUnsavedChanges(prev, {
          editTitle: editTitleRef.current,
          editBodyHtml: editBodyRef.current,
          lastSavedTitle: lastSavedTitleRef.current,
          lastSavedBody: lastSavedBodyRef.current,
          scheduleDraft: scheduleDraftRef.current
        })
      ) {
        return { ...fresh, body: prev.body, title: prev.title }
      }
      return fresh
    })
  }, [notes, editing?.id])

  useEffect(() => {
    if (pendingNoteId == null) return
    const pendingId = takePendingNoteId()
    if (pendingId == null) return
    lastOpenedNoteRestoredRef.current = true
    void openNoteById(pendingId)
  }, [pendingNoteId, notes, takePendingNoteId, openNoteById])

  useEffect(() => {
    if (lastOpenedNoteRestoredRef.current) return
    if (!notesSettings.rememberLastOpenNote) {
      lastOpenedNoteRestoredRef.current = true
      return
    }
    if (pendingNoteId != null) return
    if (editing != null) {
      lastOpenedNoteRestoredRef.current = true
      return
    }
    if (notesLoading) return
    if (useGlobalCreateNavigateStore.getState().pendingAfterNavigate != null) {
      lastOpenedNoteRestoredRef.current = true
      return
    }

    lastOpenedNoteRestoredRef.current = true
    const storedId = readLastOpenedNoteId()
    if (storedId == null) return

    const fromList = notes.find((n) => n.id === storedId)
    if (!fromList) {
      persistLastOpenedNoteId(null)
      return
    }

    if (fromList.parentNoteId != null) {
      expandParentPage(fromList.parentNoteId)
    }
    void openNoteById(storedId)
  }, [
    notes,
    notesLoading,
    notesSettings.rememberLastOpenNote,
    pendingNoteId,
    editing,
    expandParentPage,
    openNoteById
  ])

  useEffect(() => {
    const pending = useGlobalCreateNavigateStore.getState().takePendingAfterNavigate()
    if (pending === 'note') {
      window.setTimeout((): void => void createStandalone(notesSettings.defaultNotePageTemplateId), 0)
    }
  }, [createStandalone, notesSettings.defaultNotePageTemplateId])

  useEffect(() => {
    function onGlobalCreate(e: Event): void {
      const ce = e as CustomEvent<{ kind?: string }>
      if (ce.detail?.kind !== 'note') return
      void createStandalone(notesSettings.defaultNotePageTemplateId)
    }
    window.addEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
    return (): void => window.removeEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
  }, [createStandalone, notesSettings.defaultNotePageTemplateId])

  useEffect(() => {
    if (!editing || scheduleDraft == null) return
    syncSaveStatusFromDraft()
    if (readCurrentUnsavedChanges()) scheduleAutosave()
  }, [scheduleDraft, editing?.id, readCurrentUnsavedChanges, scheduleAutosave, syncSaveStatusFromDraft])

  useEffect(() => {
    if (notesSettings.autosaveMode !== 'interval' || !editing) return
    const id = window.setInterval(() => {
      void autosaveRef.current.run()
    }, notesSettings.autosaveIntervalSeconds * 1000)
    return (): void => clearInterval(id)
  }, [notesSettings.autosaveMode, notesSettings.autosaveIntervalSeconds, editing?.id])

  useEffect(() => {
    const noteId = editing?.id
    if (noteId == null) return
    return (): void => {
      void flushAllNoteEdits({ silent: true })
    }
  }, [editing?.id, flushAllNoteEdits])

  useEffect(() => {
    return registerNotesEditorFlush(() => flushAllNoteEdits({ silent: true }))
  }, [flushAllNoteEdits])

  useEffect(() => {
    if (notesSettings.autosaveMode === 'off') return
    const onVisibilityChange = (): void => {
      if (document.visibilityState !== 'hidden') return
      void flushAllNoteEdits({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return (): void => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [flushAllNoteEdits, notesSettings.autosaveMode])

  useEffect(() => {
    if (notesSettings.autosaveMode === 'off') return
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      const note = editingRef.current
      if (!note) return
      editorFlushRef.current?.()
      if (
        !readNoteEditingUnsavedChanges(note, {
          editTitle: editTitleRef.current,
          editBodyHtml: editBodyRef.current,
          lastSavedTitle: lastSavedTitleRef.current,
          lastSavedBody: lastSavedBodyRef.current,
          scheduleDraft: scheduleDraftRef.current
        })
      ) {
        return
      }
      e.preventDefault()
      e.returnValue = ''
      void flushAllNoteEdits({ silent: true })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return (): void => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [flushAllNoteEdits, notesSettings.autosaveMode])

  useEffect(() => {
    const onScreenClip = (): void => {
      handleScreenClip()
    }
    window.addEventListener('notes:screen-clip-request', onScreenClip)
    return (): void => window.removeEventListener('notes:screen-clip-request', onScreenClip)
  }, [handleScreenClip])

  return {
    editing,
    setEditing,
    editorSeedHtml,
    linksBodyHtml,
    scheduleDraft,
    setScheduleDraft,
    saving,
    openingNote,
    saveStatus,
    lastSavedAt,
    setSaving,
    error,
    setError,
    meetingInsertOpen,
    setMeetingInsertOpen,
    meetingRefreshBusy,
    hasMeetingBlocks,
    embedInsertOpen,
    setEmbedInsertOpen,
    editTitleRef,
    editBodyRef,
    editorFlushRef,
    editorInsertHtmlRef,
    editorInsertEmbedRef,
    editorReplaceInkRef,
    editorRef,
    editorFocusedRef,
    editingBreadcrumb,
    editingSectionName,
    noteInk,
    noteCloudTask,
    noteCalendarEvent,
    openEdit,
    openNoteById,
    openNoteInListFromCalendar,
    closeEditor,
    createStandalone,
    patchNoteDisplay,
    patchNoteDisplayInList,
    renameNoteTitleInList,
    handleTitleChange,
    handleEditBodyChangeWithAutosave,
    handleMeetingInsert,
    handleMeetingDetailsRefresh,
    handleScreenClip,
    handleInkImageDoubleClick,
    handleExportPdf,
    handlePrintPage,
    saveEditing,
    flushAllNoteEdits
  }
}
