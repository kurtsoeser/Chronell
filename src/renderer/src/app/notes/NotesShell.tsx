import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type FullCalendar from '@fullcalendar/react'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  CalendarDays,
  Loader2,
  X
} from 'lucide-react'
import {
  addMonths,
  compareAsc,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfMonth
} from 'date-fns'
import { resolveDateFnsLocale } from '@/lib/date-fns-locale'
import { useTranslation } from 'react-i18next'
import type { NoteEntityLinkedItem, NoteLinksBundle } from '@shared/note-entity-links'
import type {
  ConnectedAccount,
  NoteSection,
  NotesChangedPayload,
  UserNote,
  UserNoteListItem
} from '@shared/types'
import type { MiniMonthSelectedRange } from '@/app/calendar/MiniMonthGrid'
import type { NotesCalendarDateMode } from '@/app/calendar/notes-calendar'
import { ModuleNavMiniMonth } from '@/components/ModuleNavMiniMonth'
import {
  moduleNavColumnClass,
  modulePaneStackClass,
  moduleShellClass
} from '@/components/module-shell-layout'
import { NotesCalendarPane } from '@/app/notes/NotesCalendarPane'
import { NotesCalendarToolbar } from '@/app/notes/NotesCalendarToolbar'
import { NotesShellNoteEditorColumn } from '@/app/notes/NotesShellNoteEditorColumn'
import { NotesLinkedPreviewPane } from '@/app/notes/NotesLinkedPreviewPane'
import { buildNotesPreviewLinkEntries, linkedItemToPreviewEntry } from '@/app/notes/notes-link-preview-items'
import {
  persistNotesLinkedPreviewOpen,
  persistNotesLinkedPreviewPlacement,
  readNotesLinkedPreviewOpen,
  readNotesLinkedPreviewPlacement
} from '@/app/notes/notes-shell-storage'
import { readNotesActiveFcView } from '@/app/notes/notes-active-fc-view-storage'
import { readNotesCalendarDateMode } from '@/app/notes/notes-calendar-date-mode-storage'
import {
  persistNotesActiveShellView,
  readNotesActiveShellView
} from '@/app/notes/notes-active-shell-view-storage'
import { noteTitle } from '@/app/notes/notes-display-helpers'
import {
  readNotesPagesSort,
  type NotesPagesSortKey
} from '@/lib/notes-pages-sort'
import { NoteMeetingInsertDialog, type NoteMeetingInsertResult } from '@/app/notes/NoteMeetingInsertDialog'
import { NoteEmbedInsertDialog } from '@/app/notes/NoteEmbedInsertDialog'
import { insertNoteEmbedInEditor, resolveNoteEmbedInsertTarget } from '@/lib/note-embed-insert'
import { refreshNoteMeetingDetailsInHtml } from '@/lib/note-meeting-refresh'
import { noteHtmlHasMeetingBlocks } from '@shared/note-meeting-sync'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import { useNoteInkDraw } from '@/app/notes/use-note-ink-draw'
import { useNoteCloudTask } from '@/app/notes/use-note-cloud-task'
import { useNoteCalendarEvent } from '@/app/notes/use-note-calendar-event'
import { useNoteCloudTaskSync } from '@/app/notes/use-note-cloud-task-sync'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import { NotesPagesPane } from '@/app/notes/NotesPagesPane'
import { NotesSidebarList } from '@/app/notes/NotesSidebarList'
import { NotesShellSearch } from '@/app/notes/NotesShellSearch'
import { NotesShellViewToggle, type NotesShellView } from '@/app/notes/NotesShellViewToggle'
import {
  NotePageTemplateEditDialog,
  type NotePageTemplateEditorState
} from '@/components/NotePageTemplateEditDialog'
import {
  loadCustomNotePageTemplates,
  upsertCustomNotePageTemplate
} from '@/lib/note-page-templates-custom'
import {
  normalizeNoteBodyForStorage,
  prepareNoteBodyForEditor,
  storedBodyFromEditorHtml
} from '@/lib/note-body-html'
import { listAllNotePageTemplates, resolveNotePageTemplate, type NotePageTemplateId } from '@/lib/note-page-templates'
import { useCustomNotePageTemplates } from '@/hooks/use-custom-note-page-templates'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderOutlineSmClass,
  moduleColumnHeaderShellBarClass,
  moduleColumnHeaderSubToolbarClass,
  moduleColumnHeaderTitleClass
} from '@/components/ModuleColumnHeader'
import { useResizableWidth, VerticalSplitter } from '@/components/ResizableSplitter'
import {
  MODULE_NAV_COLUMN_LEGACY_KEYS,
  MODULE_NAV_COLUMN_WIDTH_MAX,
  MODULE_NAV_COLUMN_WIDTH_MIN,
  useModuleNavColumnWidth
} from '@/lib/module-nav-column-width'
import { initialNotesDateRangeFromPrefs } from '@/lib/notes-initial-date-range'
import { noteKindsForFilter } from '@/lib/notes-settings-prefs'
import {
  defaultNavSelection,
  navSelectionLabel,
  notesForNavSelection,
  persistNotesNavSelection,
  readNotesNavSelection,
  sectionIdForNewNote,
  type NotesNavSelection,
  type NotesSectionsNavScope
} from '@/lib/notes-nav-selection'
import {
  buildNoteBreadcrumb,
  buildNotesPageRows
} from '@/lib/notes-page-tree'
import {
  readNotesPageTreeCollapsed,
  toggleNotesPageTreeCollapsed,
  persistNotesPageTreeCollapsed
} from '@/lib/notes-page-collapse-storage'
import {
  collectDistinctNoteCategories,
  resolveNoteCategoryAccountId
} from '@/lib/note-category-account'
import {
  safeMoveNoteToParent,
  safeSetNoteCategories,
  safeSetNotePinned
} from '@/lib/notes-ipc-client'
import { NoteCategoriesPopover } from '@/components/NoteCategoriesPopover'
import { NoteSectionPopover } from '@/components/NoteSectionPopover'
import { parseNoteDragId, parseNoteNavDropId } from '@/lib/notes-sidebar-dnd'
import {
  readNotesSidebarListMode,
  type NotesSidebarListMode,
  persistNotesSidebarListMode
} from '@/lib/notes-sidebar-storage'
import { LOCAL_NOTES_ACCOUNT_KEY, buildNoteAccountBuckets } from '@/lib/notes-sidebar-accounts'
import { runScreenClipCapture } from '@/lib/note-screen-clip'
import { GLOBAL_CREATE_EVENT, useGlobalCreateNavigateStore } from '@/lib/global-create'
import { cn } from '@/lib/utils'
import { useExitingIds } from '@/lib/use-exiting-ids'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import { showAppConfirm } from '@/stores/app-dialog'
import { useUndoStore } from '@/stores/undo'
import { useNotesSettingsPrefs } from '@/lib/use-notes-settings-prefs'
import {
  NOTES_AUTOSAVE_DEBOUNCE_MS,
  noteEditingHasUnsavedChanges
} from '@/lib/notes-autosave'
import { registerNotesEditorFlush } from '@/lib/notes-editor-flush-bridge'
import { useIdBulkSelection } from '@/lib/id-bulk-selection'
import { useBulkListKeyboardShortcuts } from '@/lib/use-bulk-list-keyboard-shortcuts'

const NOTES_DETAIL_WIDTH_KEY = 'mailclient.notesShell.detailWidth'
const NOTES_NAV_WIDTH_KEY = 'mailclient.notesShell.navWidth.v2'
const NOTES_PREVIEW_DOCK_WIDTH_KEY = 'mailclient.notesShell.previewDockWidth'
const NOTES_CALENDAR_PREVIEW_WIDTH_KEY = 'mailclient.notesShell.calendarPreviewWidth'
type ScheduleDraft = {
  scheduledStartIso: string | null
  scheduledEndIso: string | null
  scheduledAllDay: boolean
  clearSchedule?: boolean
}

function notesSelectedRange(dateFrom: string, dateTo: string): MiniMonthSelectedRange | null {
  if (!dateFrom.trim() && !dateTo.trim()) return null
  const from = dateFrom.trim() || dateTo.trim()
  const to = dateTo.trim() || dateFrom.trim()
  const start = startOfDay(parseISO(from))
  const end = startOfDay(parseISO(to))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return compareAsc(start, end) <= 0
    ? { startInclusive: start, endInclusive: end }
    : { startInclusive: end, endInclusive: start }
}

function notesDateRangeLabel(dateFrom: string, dateTo: string, locale: string): string {
  const range = notesSelectedRange(dateFrom, dateTo)
  if (!range) return ''
  const dfLocale = resolveDateFnsLocale(locale)
  const sameDay = range.startInclusive.getTime() === range.endInclusive.getTime()
  if (sameDay) {
    return format(range.startInclusive, 'd. MMM yyyy', { locale: dfLocale })
  }
  return `${format(range.startInclusive, 'd. MMM', { locale: dfLocale })} – ${format(range.endInclusive, 'd. MMM yyyy', { locale: dfLocale })}`
}

function applyNotesMiniCalendarRange(
  startInclusive: Date,
  endInclusive: Date,
  setDateFrom: (v: string) => void,
  setDateTo: (v: string) => void,
  setMiniMonth: (v: Date | ((prev: Date) => Date)) => void
): void {
  const lo = compareAsc(startInclusive, endInclusive) <= 0 ? startInclusive : endInclusive
  const hi = compareAsc(startInclusive, endInclusive) <= 0 ? endInclusive : startInclusive
  setDateFrom(format(lo, 'yyyy-MM-dd'))
  setDateTo(format(hi, 'yyyy-MM-dd'))
  setMiniMonth(startOfMonth(lo))
}

function clearNotesDateRange(
  setDateFrom: (v: string) => void,
  setDateTo: (v: string) => void
): void {
  setDateFrom('')
  setDateTo('')
}

function scheduleFieldsFromDraft(draft: ScheduleDraft | null): UserNoteScheduleFieldsForSave {
  if (!draft) return {}
  if (draft.clearSchedule) {
    return {
      scheduledStartIso: null,
      scheduledEndIso: null,
      scheduledAllDay: false,
      clearSchedule: true
    }
  }
  return {
    scheduledStartIso: draft.scheduledStartIso,
    scheduledEndIso: draft.scheduledEndIso,
    scheduledAllDay: draft.scheduledAllDay
  }
}

type UserNoteScheduleFieldsForSave = {
  scheduledStartIso?: string | null
  scheduledEndIso?: string | null
  scheduledAllDay?: boolean
  clearSchedule?: boolean
}

async function persistUserNoteEdits(
  invalidNoteMessage: string,
  note: UserNote,
  input: {
    title: string
    bodyHtml: string
    scheduleDraft: ScheduleDraft | null
  }
): Promise<UserNote> {
  const bodyToSave = normalizeNoteBodyForStorage(input.bodyHtml)
  const schedule = scheduleFieldsFromDraft(input.scheduleDraft)

  if (note.kind === 'standalone') {
    return window.mailClient.notes.updateStandalone({
      id: note.id,
      title: input.title,
      body: bodyToSave,
      ...(schedule.clearSchedule ? { clearSchedule: true } : {}),
      ...(!schedule.clearSchedule && input.scheduleDraft
        ? {
            scheduledStartIso: schedule.scheduledStartIso,
            scheduledEndIso: schedule.scheduledEndIso,
            scheduledAllDay: schedule.scheduledAllDay
          }
        : {})
    })
  }
  if (note.kind === 'mail' && note.messageId != null) {
    return window.mailClient.notes.upsertMail({
      messageId: note.messageId,
      title: input.title,
      body: bodyToSave,
      ...(input.scheduleDraft
        ? {
            scheduledStartIso: schedule.scheduledStartIso,
            scheduledEndIso: schedule.scheduledEndIso,
            scheduledAllDay: schedule.scheduledAllDay
          }
        : {})
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
      title: input.title,
      body: bodyToSave,
      eventTitleSnapshot: note.eventTitleSnapshot,
      eventStartIsoSnapshot: note.eventStartIsoSnapshot,
      ...(input.scheduleDraft
        ? {
            scheduledStartIso: schedule.scheduledStartIso,
            scheduledEndIso: schedule.scheduledEndIso,
            scheduledAllDay: schedule.scheduledAllDay
          }
        : {})
    })
  }
  throw new Error(invalidNoteMessage)
}

function readNoteEditingUnsavedChanges(
  note: UserNote,
  input: {
    editTitle: string
    editBodyHtml: string
    lastSavedTitle: string
    lastSavedBody: string
    scheduleDraft: ScheduleDraft | null
  }
): boolean {
  const scheduleNote =
    input.scheduleDraft && !input.scheduleDraft.clearSchedule
      ? {
          scheduledStartIso: input.scheduleDraft.scheduledStartIso,
          scheduledEndIso: input.scheduleDraft.scheduledEndIso,
          scheduledAllDay: input.scheduleDraft.scheduledAllDay
        }
      : note
  return noteEditingHasUnsavedChanges({
    editTitle: input.editTitle,
    editBodyHtml: input.editBodyHtml,
    lastSavedTitle: input.lastSavedTitle,
    lastSavedBody: input.lastSavedBody,
    scheduleDraft: input.scheduleDraft,
    note: scheduleNote
  })
}

export function NotesShell(): JSX.Element {
  const { t, i18n } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const notesSettings = useNotesSettingsPrefs()
  const { customTemplates } = useCustomNotePageTemplates()
  const accounts = useAccountsStore((s) => s.accounts)
  const selectMessageWithThreadPreview = useMailStore((s) => s.selectMessageWithThreadPreview)
  const clearSelectedMessage = useMailStore((s) => s.clearSelectedMessage)
  const pushToast = useUndoStore((s) => s.pushToast)
  const pendingNoteId = useNotesPendingFocusStore((s) => s.pendingNoteId)
  const takePendingNoteId = useNotesPendingFocusStore((s) => s.takePendingNoteId)
  const { isExiting: isNoteExiting, markExiting: markNoteExiting } = useExitingIds<number>()

  const initialDateRange = useMemo(() => initialNotesDateRangeFromPrefs(), [])

  const [notes, setNotes] = useState<UserNoteListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState(initialDateRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialDateRange.dateTo)
  const [miniMonth, setMiniMonth] = useState(initialDateRange.miniMonth)
  const scheduledOnlyFilter =
    notesSettings.defaultDateFilterMode === 'scheduled_only'
  const [editing, setEditing] = useState<UserNote | null>(null)
  const editTitleRef = useRef('')
  const [editorSeedHtml, setEditorSeedHtml] = useState('')
  const [linksBodyHtml, setLinksBodyHtml] = useState('')
  const editBodyRef = useRef('')
  const editorFlushRef = useRef<(() => void) | null>(null)
  const editorInsertHtmlRef = useRef<((html: string) => void) | null>(null)
  const editorReplaceInkRef = useRef<((inkJsonAttachmentId: number, html: string) => void) | null>(
    null
  )
  const editorRef = useRef<import('@tiptap/react').Editor | null>(null)
  const taskAccounts = useMemo(
    () => accounts.filter(accountSupportsCloudTasks),
    [accounts]
  )
  const lastSavedTitleRef = useRef('')
  const lastSavedBodyRef = useRef('')
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingRef = useRef<UserNote | null>(null)
  const scheduleDraftRef = useRef<ScheduleDraft | null>(null)
  const savingRef = useRef(false)
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const notesChangedReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linksBodyHtmlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  editingRef.current = editing
  const [meetingInsertOpen, setMeetingInsertOpen] = useState(false)
  const [meetingRefreshBusy, setMeetingRefreshBusy] = useState(false)
  const [hasMeetingBlocks, setHasMeetingBlocks] = useState(false)
  const [embedInsertOpen, setEmbedInsertOpen] = useState(false)
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateFromNoteOpen, setTemplateFromNoteOpen] = useState<NotePageTemplateEditorState | null>(
    null
  )
  const [shellView, setShellView] = useState<NotesShellView>(() => readNotesActiveShellView())
  const [sections, setSections] = useState<NoteSection[]>([])
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null)
  scheduleDraftRef.current = scheduleDraft
  const [listMode, setListMode] = useState<NotesSidebarListMode>(() => readNotesSidebarListMode())
  const [navSelection, setNavSelection] = useState<NotesNavSelection>(() =>
    readNotesNavSelection(readNotesSidebarListMode())
  )
  const [pagesSort, setPagesSort] = useState<NotesPagesSortKey>(() => readNotesPagesSort())
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<number>>(() =>
    readNotesPageTreeCollapsed()
  )
  const [categoryColorByName, setCategoryColorByName] = useState(() => new Map<string, string>())
  const [categoryPopover, setCategoryPopover] = useState<{ x: number; y: number } | null>(null)
  const [sectionPopover, setSectionPopover] = useState<{ x: number; y: number } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const notesCalendarRef = useRef<FullCalendar | null>(null)
  const [calendarFcView, setCalendarFcView] = useState(() => readNotesActiveFcView())
  const [calendarDateMode, setCalendarDateMode] = useState<NotesCalendarDateMode>(() =>
    readNotesCalendarDateMode()
  )
  const [calendarTitle, setCalendarTitle] = useState('')

  const [globalNavWidth, setGlobalNavWidth] = useModuleNavColumnWidth()
  const [notesNavWidth, setNotesNavWidth] = useResizableWidth({
    storageKey: NOTES_NAV_WIDTH_KEY,
    defaultWidth: notesSettings.defaultNavColumnWidth,
    minWidth: MODULE_NAV_COLUMN_WIDTH_MIN,
    maxWidth: MODULE_NAV_COLUMN_WIDTH_MAX,
    legacyStorageKeys: MODULE_NAV_COLUMN_LEGACY_KEYS
  })
  const navWidth = notesSettings.useGlobalModuleNavWidth ? globalNavWidth : notesNavWidth
  const setNavWidth = notesSettings.useGlobalModuleNavWidth ? setGlobalNavWidth : setNotesNavWidth

  const [linkedPreviewOpen, setLinkedPreviewOpen] = useState(() => readNotesLinkedPreviewOpen())
  const [linkedPreviewPlacement, setLinkedPreviewPlacement] = useState(() =>
    readNotesLinkedPreviewPlacement()
  )
  const [linkedPreviewKey, setLinkedPreviewKey] = useState<string | null>(null)
  const [linksBundle, setLinksBundle] = useState<NoteLinksBundle | null>(null)
  const [previewDockWidth, setPreviewDockWidth] = useResizableWidth({
    storageKey: NOTES_PREVIEW_DOCK_WIDTH_KEY,
    defaultWidth: notesSettings.defaultLinkedPreviewDockWidth,
    minWidth: 260,
    maxWidth: 720
  })
  const [calendarEditorWidth, setCalendarEditorWidth] = useResizableWidth({
    storageKey: NOTES_CALENDAR_PREVIEW_WIDTH_KEY,
    defaultWidth: 520,
    minWidth: 320,
    maxWidth: 960
  })

  const [detailColumnWidth, setDetailColumnWidth] = useResizableWidth({
    storageKey: NOTES_DETAIL_WIDTH_KEY,
    defaultWidth: notesSettings.defaultDetailColumnWidth,
    minWidth: 220,
    maxWidth: 480
  })

  const onShellViewChange = useCallback((view: NotesShellView): void => {
    setShellView(view)
    persistNotesActiveShellView(view)
  }, [])

  const onCalendarFcViewChange = useCallback((viewId: string): void => {
    setCalendarFcView(viewId)
  }, [])

  const loadSections = useCallback(async (): Promise<void> => {
    try {
      setSections(await window.mailClient.notes.sections.list())
    } catch {
      setSections([])
    }
  }, [])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.mailClient.notes.list({
        kinds: noteKindsForFilter(notesSettings.defaultNoteKindsFilter),
        accountIds: [],
        dateFrom: dateFrom ? startOfDay(parseISO(dateFrom)).toISOString() : null,
        dateTo: dateTo ? endOfDay(parseISO(dateTo)).toISOString() : null,
        scheduledOnly: scheduledOnlyFilter,
        limit: notesSettings.notesListFetchLimit
      })
      setNotes(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, notesSettings.defaultNoteKindsFilter, notesSettings.notesListFetchLimit, scheduledOnlyFilter])

  const scheduleNotesListReload = useCallback((): void => {
    if (notesChangedReloadTimerRef.current != null) {
      clearTimeout(notesChangedReloadTimerRef.current)
    }
    notesChangedReloadTimerRef.current = setTimeout(() => {
      notesChangedReloadTimerRef.current = null
      void load()
      void loadSections()
    }, 300)
  }, [load, loadSections])

  const onSectionsChanged = useCallback((): void => {
    void loadSections()
    scheduleNotesListReload()
  }, [loadSections, scheduleNotesListReload])

  const onNotesChanged = useCallback(
    (detail: NotesChangedPayload): void => {
      const noteId = detail.noteId
      const scope = detail.scope
      const editingNoteId = editingRef.current?.id

      if (
        (scope === 'content' || scope === 'meta') &&
        noteId != null &&
        editingNoteId === noteId
      ) {
        return
      }
      if (scope === 'attachments' || scope === 'links') {
        return
      }
      scheduleNotesListReload()
    },
    [scheduleNotesListReload]
  )

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 150)
    return (): void => window.clearTimeout(handle)
  }, [load])

  useEffect(() => {
    void loadSections()
  }, [loadSections])

  useEffect(() => {
    const off = window.mailClient.events.onNotesChanged(onNotesChanged)
    return off
  }, [onNotesChanged])

  const selectedRange = useMemo(
    () => notesSelectedRange(dateFrom, dateTo),
    [dateFrom, dateTo]
  )

  const dateRangeLabel = useMemo(
    () => notesDateRangeLabel(dateFrom, dateTo, i18n.language),
    [dateFrom, dateTo, i18n.language]
  )

  const pagesNotes = useMemo(
    () => notesForNavSelection(notes, navSelection),
    [notes, navSelection]
  )

  const untitledLabel = t('notes.shell.untitled')

  const pageRows = useMemo(
    () => buildNotesPageRows(pagesNotes, pagesSort, collapsedParentIds, untitledLabel),
    [pagesNotes, pagesSort, collapsedParentIds, untitledLabel]
  )

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes])

  const editingBreadcrumb = useMemo(() => {
    if (!editing) return []
    return buildNoteBreadcrumb(editing.id, notesById)
  }, [editing, notesById])

  const editingSectionName = useMemo(() => {
    if (!editing?.sectionId) return null
    return sections.find((s) => s.id === editing.sectionId)?.name ?? null
  }, [editing?.sectionId, sections])

  useEffect(() => {
    const ms = accounts.find((a) => a.provider === 'microsoft')
    if (!ms) {
      setCategoryColorByName(new Map())
      return
    }
    let cancelled = false
    void window.mailClient.mail.listMasterCategories(ms.id).then((cats) => {
      if (cancelled) return
      const m = new Map<string, string>()
      for (const c of cats) m.set(c.displayName, c.color)
      setCategoryColorByName(m)
    })
    return (): void => {
      cancelled = true
    }
  }, [accounts])

  const pagesSelection = useIdBulkSelection(
    useMemo(() => pagesNotes.map((n) => n.id), [pagesNotes]),
    useMemo(() => {
      const scopeKey =
        navSelection.kind === 'sections'
          ? typeof navSelection.scope === 'object'
            ? 'sectionId' in navSelection.scope
              ? `section:${navSelection.scope.sectionId}`
              : `category:${navSelection.scope.category}`
            : String(navSelection.scope)
          : ''
      if (navSelection.kind === 'accounts')
        return `acc:${navSelection.accountKey}:${pagesSort}:${dateFrom}:${dateTo}`
      return `sec:${scopeKey}:${pagesSort}:${dateFrom}:${dateTo}`
    }, [navSelection, pagesSort, dateFrom, dateTo])
  )

  const showSectionLabelsInPages =
    notesSettings.showSectionLabelsInPages ||
    (navSelection.kind === 'sections' && navSelection.scope === 'all')

  const previewEntries = useMemo(() => {
    if (!editing || !linksBundle) return []
    return buildNotesPreviewLinkEntries(editing, linksBundle, t)
  }, [editing, linksBundle, t])

  const flushAutosaveTimer = useCallback((): void => {
    if (autosaveTimerRef.current != null) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }, [])

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

  useEffect(() => {
    const onScreenClip = (): void => {
      handleScreenClip()
    }
    window.addEventListener('notes:screen-clip-request', onScreenClip)
    return (): void => window.removeEventListener('notes:screen-clip-request', onScreenClip)
  }, [handleScreenClip])

  useEffect(() => {
    if (!editing) {
      setLinksBundle(null)
      setLinkedPreviewKey(null)
      return
    }
    let cancelled = false
    void window.mailClient.notes.links.list(editing.id).then((bundle) => {
      if (!cancelled) setLinksBundle(bundle)
    })
    return (): void => {
      cancelled = true
    }
  }, [editing?.id])

  useEffect(() => {
    if (previewEntries.length === 0) {
      setLinkedPreviewKey(null)
      return
    }
    setLinkedPreviewKey((prev) =>
      prev && previewEntries.some((e) => e.key === prev) ? prev : (previewEntries[0]?.key ?? null)
    )
  }, [previewEntries])

  useEffect(() => {
    if (shellView !== 'calendar' || !editing || previewEntries.length === 0) return
    setLinkedPreviewOpen(true)
  }, [shellView, editing?.id, previewEntries.length])

  const pagesColumnTitle = useMemo(
    () => navSelectionLabel(navSelection, sections, accounts, t),
    [navSelection, sections, accounts, t]
  )

  useEffect(() => {
    persistNotesSidebarListMode(listMode)
  }, [listMode])

  useEffect(() => {
    persistNotesNavSelection(navSelection)
  }, [navSelection])

  useEffect(() => {
    setNavSelection(readNotesNavSelection(listMode))
  }, [listMode])

  useEffect(() => {
    if (
      listMode === 'sections' &&
      navSelection.kind === 'sections' &&
      typeof navSelection.scope === 'object'
    ) {
      const sectionScope = navSelection.scope
      if ('sectionId' in sectionScope) {
        const exists = sections.some((s) => s.id === sectionScope.sectionId)
        if (!exists) {
          setNavSelection(defaultNavSelection('sections'))
        }
      }
      return
    }
    if (listMode === 'accounts' && navSelection.kind === 'accounts') {
      const buckets = buildNoteAccountBuckets(accounts, notes)
      if (!buckets.some((b) => b.accountId === navSelection.accountKey)) {
        const first = buckets[0]?.accountId ?? LOCAL_NOTES_ACCOUNT_KEY
        setNavSelection({ kind: 'accounts', accountKey: first })
      }
    }
  }, [listMode, navSelection, sections, accounts, notes])

  const applyNotePatch = useCallback((note: UserNote | UserNoteListItem): void => {
    setEditing((prev) => (prev?.id === note.id ? { ...prev, ...note } : prev))
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? ({ ...n, ...note } as UserNoteListItem) : n))
    )
  }, [])

  const flushPendingNoteSave = useCallback(
    async (opts?: { silent?: boolean }): Promise<void> => {
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
        return
      }

      const savePromise = (async (): Promise<void> => {
        const noteToSave = editingRef.current
        if (!noteToSave) return
        setSaving(true)
        savingRef.current = true
        setError(null)
        try {
          editorFlushRef.current?.()
          const saved = await persistUserNoteEdits(t('notes.shell.invalidNote'), noteToSave, {
            title: editTitleRef.current,
            bodyHtml: editBodyRef.current,
            scheduleDraft: scheduleDraftRef.current
          })
          editTitleRef.current = saved.title ?? ''
          lastSavedTitleRef.current = saved.title ?? ''
          lastSavedBodyRef.current = saved.body
          if (editingRef.current?.id === noteToSave.id) {
            setEditing((prev) => (prev?.id === noteToSave.id ? { ...prev, ...saved } : prev))
            if (opts?.silent) {
              applyNotePatch(saved)
            } else {
              const editorHtml = prepareNoteBodyForEditor(saved.body).html
              editBodyRef.current = editorHtml
              setEditorSeedHtml(editorHtml)
              setLinksBodyHtml(editorHtml)
              await load()
              await loadSections()
              pushToast({ label: t('notes.editor.saved'), variant: 'success' })
            }
            setScheduleDraft(null)
          } else {
            setNotes((prev) =>
              prev.map((n) => (n.id === saved.id ? ({ ...n, ...saved } as UserNoteListItem) : n))
            )
          }
        } catch (e) {
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
    [applyNotePatch, load, loadSections, pushToast, t]
  )

  const flushAllNoteEdits = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }): Promise<void> => {
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

  const closeEditor = useCallback((): void => {
    void (async (): Promise<void> => {
      await flushAllNoteEdits({ silent: true })
      setEditing(null)
      setScheduleDraft(null)
      clearSelectedMessage()
    })()
  }, [clearSelectedMessage, flushAllNoteEdits])

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
      void (async (): Promise<void> => {
        if (autosaveTimerRef.current != null) {
          clearTimeout(autosaveTimerRef.current)
          autosaveTimerRef.current = null
        }
        if (linksBodyHtmlDebounceRef.current != null) {
          clearTimeout(linksBodyHtmlDebounceRef.current)
          linksBodyHtmlDebounceRef.current = null
        }
        await flushAllNoteEdits({ silent: true })
        let resolved: UserNoteListItem = note as UserNoteListItem
        try {
          const fresh = await window.mailClient.notes.getById(note.id)
          if (fresh) resolved = fresh
        } catch {
          // Liste/Cache nutzen, wenn getById fehlschlaegt.
        }
        const prepared = prepareNoteBodyForEditor(resolved.body)
        const editorHtml = prepared.html
        editBodyRef.current = editorHtml
        lastSavedTitleRef.current = resolved.title ?? ''
        lastSavedBodyRef.current = resolved.body
        editTitleRef.current = resolved.title ?? ''
        setEditing(resolved)
        setEditorSeedHtml(editorHtml)
        setLinksBodyHtml(editorHtml)
        setHasMeetingBlocks(noteHtmlHasMeetingBlocks(editorHtml))
        setScheduleDraft(null)
        if (prepared.migratedFromMarkdown) {
          const stored = normalizeNoteBodyForStorage(editorHtml)
          const saved = await persistMigratedBody(resolved, stored)
          if (saved) {
            applyNotePatch(saved)
            setEditing({ ...resolved, ...saved })
          }
        }
        if (resolved.kind === 'mail' && resolved.messageId != null) {
          void selectMessageWithThreadPreview(resolved.messageId)
        } else {
          clearSelectedMessage()
        }
      })()
    },
    [
      applyNotePatch,
      clearSelectedMessage,
      flushAllNoteEdits,
      persistMigratedBody,
      selectMessageWithThreadPreview
    ]
  )

  const openNoteInListFromCalendar = useCallback(
    (note: UserNoteListItem): void => {
      setShellView('list')
      persistNotesActiveShellView('list')
      openEdit(note)
    },
    [openEdit]
  )

  const openNoteById = useCallback(
    async (id: number): Promise<void> => {
      try {
        const note = await window.mailClient.notes.getById(id)
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

  useEffect(() => {
    if (pendingNoteId == null) return
    const pendingId = takePendingNoteId()
    if (pendingId == null) return
    void openNoteById(pendingId)
  }, [pendingNoteId, notes, takePendingNoteId, openNoteById])

  const createStandalone = useCallback(
    async (templateId: NotePageTemplateId = notesSettings.defaultNotePageTemplateId): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const template = resolveNotePageTemplate(templateId, customTemplates, t)
      const sectionId =
        listMode === 'sections' ? sectionIdForNewNote(navSelection) : null
      const note = await window.mailClient.notes.createStandalone({
        title:
          template.id === 'blank'
            ? t('notes.shell.newStandaloneTitle')
            : template.title,
        body: storedBodyFromEditorHtml(template.bodyHtml),
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
  ])

  useEffect(() => {
    const pending = useGlobalCreateNavigateStore.getState().takePendingAfterNavigate()
    if (pending === 'note') {
      window.setTimeout((): void => void createStandalone(notesSettings.defaultNotePageTemplateId), 0)
    }
  }, [createStandalone])

  useEffect(() => {
    function onGlobalCreate(e: Event): void {
      const ce = e as CustomEvent<{ kind?: string }>
      if (ce.detail?.kind !== 'note') return
      void createStandalone(notesSettings.defaultNotePageTemplateId)
    }
    window.addEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
    return (): void => window.removeEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
  }, [createStandalone])

  async function saveEditing(opts?: { silent?: boolean }): Promise<void> {
    if (!editing) return
    await flushAllNoteEdits({ ...opts, force: true })
  }

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
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const scheduleLinksBodyHtmlUpdate = useCallback((html: string): void => {
    if (linksBodyHtmlDebounceRef.current != null) {
      clearTimeout(linksBodyHtmlDebounceRef.current)
    }
    linksBodyHtmlDebounceRef.current = setTimeout(() => {
      linksBodyHtmlDebounceRef.current = null
      setLinksBodyHtml(html)
    }, 300)
  }, [])

  const handleEditBodyChangeWithAutosave = useCallback(
    (html: string): void => {
      editBodyRef.current = html
      setHasMeetingBlocks(noteHtmlHasMeetingBlocks(html))
      scheduleLinksBodyHtmlUpdate(html)
      scheduleAutosave()
    },
    [scheduleAutosave, scheduleLinksBodyHtmlUpdate]
  )

  const embedMeetingMediaUrls = useCallback(
    async (urls: string[]): Promise<void> => {
      const editor = editorRef.current
      if (!editor || editor.isDestroyed || urls.length === 0) return
      for (const url of urls) {
        try {
          const target = await resolveNoteEmbedInsertTarget(url)
          if (target) {
            insertNoteEmbedInEditor(editor, target, handleEditBodyChangeWithAutosave)
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
          const bundle = await window.mailClient.notes.links.list(editing.id)
          setLinksBundle(bundle)
        } catch (e) {
          pushToast({
            label: e instanceof Error ? e.message : String(e),
            variant: 'error'
          })
        }
      }
      pushToast({ label: t('notes.meetingInsert.insertedToast'), variant: 'success' })
    },
    [editing, embedMeetingMediaUrls, handleEditBodyChangeWithAutosave, pushToast, t]
  )

  const reloadNoteLinks = useCallback((): void => {
    if (!editing) return
    void window.mailClient.notes.links.list(editing.id).then((bundle) => {
      setLinksBundle(bundle)
    })
  }, [editing])

  const noteCloudTask = useNoteCloudTask({
    noteId: editing?.id,
    taskAccounts,
    insertHtmlRef: editorInsertHtmlRef,
    getEditor: (): import('@tiptap/react').Editor | null => editorRef.current,
    onLinksChanged: reloadNoteLinks,
    onError: (message): void => {
      pushToast({ label: message, variant: 'error' })
    },
    onSuccess: (message): void => {
      pushToast({ label: message, variant: 'success' })
    }
  })
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

  useNoteCloudTaskSync({
    noteId: editing?.id,
    getBodyHtml: (): string => editBodyRef.current,
    onApplyHtml: handleCloudTaskSyncHtml,
    flushRef: editorFlushRef,
    enabled: Boolean(editing)
  })

  const noteCalendarEvent = useNoteCalendarEvent({
    noteId: editing?.id,
    accounts,
    insertHtmlRef: editorInsertHtmlRef,
    getEditor: (): import('@tiptap/react').Editor | null => editorRef.current,
    onLinksChanged: reloadNoteLinks,
    onError: (message): void => {
      pushToast({ label: message, variant: 'error' })
    },
    onSuccess: (message): void => {
      pushToast({ label: message, variant: 'success' })
    }
  })

  useEffect(() => {
    scheduleAutosave()
  }, [scheduleDraft, scheduleAutosave])

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

  async function deleteNote(note: UserNoteListItem): Promise<void> {
    const title = noteTitle(note, t('notes.shell.untitled'))
    const ok = await showAppConfirm(t('notes.shell.deleteConfirm', { title }), {
      title: t('notes.shell.deleteTitle'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      variant: 'danger'
    })
    if (!ok) return

    markNoteExiting(note.id, () => {
      void (async (): Promise<void> => {
        setSaving(true)
        try {
          await window.mailClient.notes.delete(note.id)
          if (editing?.id === note.id) {
            setEditing(null)
            clearSelectedMessage()
          }
          pushToast({ label: t('notes.shell.deleted'), variant: 'success' })
          await load()
          await loadSections()
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        } finally {
          setSaving(false)
        }
      })()
    })
  }

  const deleteCheckedNotes = useCallback(async (): Promise<void> => {
    const ids = [...pagesSelection.selectedIds]
    if (ids.length === 0) return
    const ok = await showAppConfirm(
      t('notes.shell.deleteBulkConfirm', { count: ids.length }),
      {
        title: t('notes.shell.deleteTitle'),
        confirmLabel: t('common.delete'),
        cancelLabel: t('common.cancel'),
        variant: 'danger'
      }
    )
    if (!ok) return

    setSaving(true)
    try {
      for (const id of ids) {
        await window.mailClient.notes.delete(id)
        if (editing?.id === id) {
          setEditing(null)
          clearSelectedMessage()
        }
      }
      pagesSelection.clear()
      pushToast({
        label: t('notes.shell.deletedBulk', { count: ids.length }),
        variant: 'success'
      })
      await load()
      await loadSections()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [
    pagesSelection,
    t,
    editing?.id,
    clearSelectedMessage,
    pushToast,
    load,
    loadSections
  ])

  useBulkListKeyboardShortcuts(pagesSelection.selectedCount, {
    onDelete: (): void => {
      void deleteCheckedNotes()
    },
    onClear: pagesSelection.clear,
    onSelectAll: pagesSelection.selectAllVisible
  })

  const copyNote = useCallback(
    async (note: UserNoteListItem): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        const full = (await window.mailClient.notes.getById(note.id)) ?? note
        const baseTitle = noteTitle(full, t('notes.shell.untitled')).trim()
        const title = baseTitle
          ? `${baseTitle}${t('calendar.context.duplicateSuffix')}`
          : t('notes.shell.newStandaloneTitle')
        let created = await window.mailClient.notes.createStandalone({
          title,
          body: full.body,
          sectionId: full.sectionId ?? note.sectionId ?? null,
          scheduledStartIso: full.scheduledStartIso ?? undefined,
          scheduledEndIso: full.scheduledEndIso ?? undefined,
          scheduledAllDay: full.scheduledAllDay
        })
        if (full.iconId || full.iconColor) {
          created = await window.mailClient.notes.patchDisplay({
            noteId: created.id,
            iconId: full.iconId,
            iconColor: full.iconColor
          })
        }
        const catAccount = resolveNoteCategoryAccountId(full, accounts)
        const cats = full.categories ?? []
        if (catAccount && cats.length > 0) {
          await safeSetNoteCategories({
            noteId: created.id,
            accountId: catAccount,
            categories: cats
          })
        }
        clearSelectedMessage()
        openEdit(created)
        pushToast({ label: t('notes.pagesContextMenu.copied'), variant: 'success' })
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSaving(false)
      }
    },
    [t, clearSelectedMessage, openEdit, pushToast, load, accounts]
  )

  const togglePinNote = useCallback(
    async (note: UserNoteListItem): Promise<void> => {
      setError(null)
      try {
        await safeSetNotePinned({ noteId: note.id, isPinned: !note.isPinned })
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [load]
  )

  const createSubPage = useCallback(
    async (parent: UserNoteListItem): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        const note = await window.mailClient.notes.createStandalone({
          title: t('notes.shell.newSubPageTitle'),
          sectionId: parent.sectionId ?? null,
          parentNoteId: parent.id
        })
        const nextCollapsed = readNotesPageTreeCollapsed()
        nextCollapsed.delete(parent.id)
        persistNotesPageTreeCollapsed(nextCollapsed)
        setCollapsedParentIds(new Set(nextCollapsed))
        clearSelectedMessage()
        openEdit(note)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSaving(false)
      }
    },
    [t, clearSelectedMessage, openEdit, load]
  )

  const togglePageCollapse = useCallback((note: UserNoteListItem): void => {
    setCollapsedParentIds(toggleNotesPageTreeCollapsed(note.id))
  }, [])

  const moveNoteToParent = useCallback(
    async (note: UserNoteListItem, parentNoteId: number | null): Promise<void> => {
      setError(null)
      try {
        await safeMoveNoteToParent({ noteId: note.id, parentNoteId })
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [load]
  )

  const moveNote = useCallback(
    async (note: UserNoteListItem, sectionId: number | null): Promise<void> => {
      setError(null)
      try {
        await window.mailClient.notes.moveToSection({ noteId: note.id, sectionId })
        if (listMode === 'sections') {
          setNavSelection({
            kind: 'sections',
            scope: sectionId == null ? 'ungrouped' : { sectionId }
          })
        }
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [listMode, load]
  )

  const handleNoteDragEnd = useCallback(
    (ev: DragEndEvent): void => {
      if (listMode !== 'sections') return
      const noteId = parseNoteDragId(String(ev.active.id))
      if (noteId == null || !ev.over) return
      const drop = parseNoteNavDropId(String(ev.over.id))
      if (!drop || !('sectionId' in drop)) return
      const note = notes.find((n) => n.id === noteId)
      if (!note) return
      const targetSectionId = drop.sectionId
      if ((note.sectionId ?? null) === targetSectionId) return
      void window.mailClient.notes.moveToSection({ noteId, sectionId: targetSectionId }).then(() => {
        setNavSelection({
          kind: 'sections',
          scope: targetSectionId == null ? 'ungrouped' : { sectionId: targetSectionId }
        })
      })
    },
    [listMode, notes]
  )

  const notesNavColumn = (
    <aside
        className={cn(moduleNavColumnClass, 'shrink-0')}
        style={{ width: navWidth }}
      >
        <ModuleNavMiniMonth
          monthAnchor={miniMonth}
          today={new Date()}
          selectedRange={selectedRange}
          onSelectDayRange={(start, end): void =>
            applyNotesMiniCalendarRange(start, end, setDateFrom, setDateTo, setMiniMonth)
          }
          onPrevMonth={(): void => setMiniMonth((m) => addMonths(m, -1))}
          onNextMonth={(): void => setMiniMonth((m) => addMonths(m, 1))}
          footer={
            selectedRange ? (
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-2xs text-foreground">
                  {t('notes.shell.dateRangeActive', { range: dateRangeLabel })}
                </span>
                <button
                  type="button"
                  onClick={(): void => clearNotesDateRange(setDateFrom, setDateTo)}
                  className="shrink-0 text-2xs font-medium text-primary hover:underline"
                >
                  {t('notes.shell.clearDateRange')}
                </button>
              </div>
            ) : undefined
          }
        />

        {shellView === 'list' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {loading && notes.length === 0 ? (
              <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('common.loading')}
              </div>
            ) : (
              <NotesSidebarList
                accounts={accounts}
                sections={sections}
                notes={notes}
                listMode={listMode}
                onListModeChange={setListMode}
                navSelection={navSelection}
                onSelectScope={(scope): void =>
                  setNavSelection({ kind: 'sections', scope })
                }
                onSelectAccount={(accountKey): void =>
                  setNavSelection({ kind: 'accounts', accountKey })
                }
                onSectionsChanged={onSectionsChanged}
              />
            )}
          </div>
        ) : null}
    </aside>
  )

  const noteEditorColumnSharedProps = {
    editing,
    error,
    saving,
    editorSeedHtml,
    linksBodyHtml,
    scheduleDraft,
    categoryColorByName,
    editingSectionName,
    editingBreadcrumb,
    notesById,
    notesSettings,
    previewEntriesCount: previewEntries.length,
    linkedPreviewKey,
    linkedPreviewOpen,
    onLinkedPreviewToggle: (): void => {
      const next = !linkedPreviewOpen
      setLinkedPreviewOpen(next)
      persistNotesLinkedPreviewOpen(next)
    },
    onSelectLinkForPreview: (item: NoteEntityLinkedItem, direction: 'outgoing' | 'incoming'): void => {
      setLinkedPreviewKey(linkedItemToPreviewEntry(item, direction, t).key)
      setLinkedPreviewOpen(true)
      persistNotesLinkedPreviewOpen(true)
    },
    onLinksLoaded: setLinksBundle,
    onTitleChange: handleTitleChange,
    onOpenNoteById: (id: number): void => {
      void openNoteById(id)
    },
    onOpenCategories: setCategoryPopover,
    onOpenSection: setSectionPopover,
    onIconChange: (iconId: string | undefined): void => {
      void patchNoteDisplay({ iconId: iconId ?? null })
    },
    onIconColorChange: (iconColor: string | null): void => {
      void patchNoteDisplay({ iconColor })
    },
    onScheduleChange: (value: ScheduleDraft): void => setScheduleDraft(value),
    onCreateSubPage: (): void => {
      if (editing) void createSubPage(editing as UserNoteListItem)
    },
    onEditBodyChange: handleEditBodyChangeWithAutosave,
    onOpenMeetingInsert: (): void => setMeetingInsertOpen(true),
    onRefreshMeetingDetails: (): void => {
      void handleMeetingDetailsRefresh()
    },
    canRefreshMeetingDetails: hasMeetingBlocks,
    meetingRefreshBusy,
    onOpenEmbedInsert: (): void => setEmbedInsertOpen(true),
    onOpenScreenClip: handleScreenClip,
    onOpenInkDraw: noteInk.openNew,
    onOpenCloudTaskCreate: (): void => noteCloudTask.openCreateDialog(),
    canCreateCloudTask: noteCloudTask.canCreateCloudTask,
    onOpenCalendarEventCreate: (): void => noteCalendarEvent.openCreateDialog(),
    canCreateCalendarEvent: noteCalendarEvent.canCreateCalendarEvent,
    onCreateCloudTaskFromSelection: noteCloudTask.openCreateFromSelection,
    onCreateCalendarEventFromSelection: noteCalendarEvent.openCreateFromSelection,
    onCloudTaskToggle: noteCloudTask.toggleCloudTaskInEditor,
    onEntityMentionLinkAdded: reloadNoteLinks,
    onEntityMentionLinkError: (message: string): void => {
      pushToast({ label: message, variant: 'error' })
    },
    editorRef,
    onInkImageDoubleClick: handleInkImageDoubleClick,
    onDeleteNote: (): void => {
      if (editing) void deleteNote(editing as UserNoteListItem)
    },
    onSaveTemplateFromNote: (): void =>
      setTemplateFromNoteOpen({
        mode: 'create',
        name: editTitleRef.current.trim() || t('notes.shell.untitled'),
        description: '',
        bodyHtml: editBodyRef.current
      }),
    onPrintPage: handlePrintPage,
    onExportPdf: handleExportPdf,
    onSave: (): void => {
      void saveEditing()
    },
    onClose: closeEditor,
    editorFlushRef,
    editorInsertHtmlRef,
    editorReplaceInkRef
  }

  const notesListWorkspace = (
    <div className={cn(modulePaneStackClass, 'flex-row')}>
      <aside
        className="flex min-h-0 shrink-0 flex-col border-r border-border"
        style={{ width: detailColumnWidth }}
      >
        <NotesPagesPane
          title={pagesColumnTitle}
          pageRows={pageRows}
          sections={sections}
          categoryColorByName={categoryColorByName}
          showSectionLabels={showSectionLabelsInPages}
          loading={loading}
          activeNoteId={editing?.id ?? null}
          selectedNoteIds={pagesSelection.selectedIds}
          onOpenNote={(note, e): void => {
            pagesSelection.handlePointerDown(note.id, {
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey
            })
            openEdit(note)
          }}
          onRenameNoteTitle={renameNoteTitleInList}
          onPatchNoteDisplay={patchNoteDisplayInList}
          onDeleteNote={deleteNote}
          isNoteExiting={isNoteExiting}
          onCopyNote={copyNote}
          onMoveNote={moveNote}
          onTogglePin={togglePinNote}
          onCreateSubPage={createSubPage}
          onMoveToParent={moveNoteToParent}
          onTogglePageCollapse={togglePageCollapse}
          onCreateNote={(templateId): void => void createStandalone(templateId)}
          creating={saving}
          pagesSort={pagesSort}
          onPagesSortChange={setPagesSort}
        />
      </aside>

      <VerticalSplitter
        ariaLabel={t('notes.shell.splitterPagesAria')}
        onDrag={(delta): void => setDetailColumnWidth((w) => w + delta)}
      />

      <NotesShellNoteEditorColumn
        layout="list"
        {...noteEditorColumnSharedProps}
        headerExtras={
          <>
            <NotesShellSearch sections={sections} accounts={accounts} onOpenNote={openEdit} />
            <NotesShellViewToggle value={shellView} onChange={onShellViewChange} />
          </>
        }
      />

      {editing ? (
        <NotesLinkedPreviewPane
          open={linkedPreviewOpen}
          placement={linkedPreviewPlacement}
          onPlacementChange={(placement): void => {
            setLinkedPreviewPlacement(placement)
            persistNotesLinkedPreviewPlacement(placement)
          }}
          onClose={(): void => {
            setLinkedPreviewOpen(false)
            persistNotesLinkedPreviewOpen(false)
          }}
          entries={previewEntries}
          selectedKey={linkedPreviewKey}
          onSelectKey={setLinkedPreviewKey}
          editing={editing}
          accounts={accounts}
          dockWidthPx={previewDockWidth}
          onDockWidthDrag={(delta): void => setPreviewDockWidth((w) => w - delta)}
          floatDefaultWidth={notesSettings.defaultFloatPreviewWidth}
          floatDefaultHeight={notesSettings.defaultFloatPreviewHeight}
        />
      ) : null}
    </div>
  )

  const notesCalendarWorkspace = (
    <div className={cn(modulePaneStackClass, 'flex-row')}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className={cn(moduleColumnHeaderShellBarClass, 'shrink-0 border-b border-border')}>
            <div className={moduleColumnHeaderTitleClass}>{t('notes.shell.selectNote')}</div>
            <div className="flex min-w-0 shrink-0 items-center gap-1.5">
              <NotesShellSearch
                sections={sections}
                accounts={accounts}
                onOpenNote={openEdit}
              />
              <NotesShellViewToggle value={shellView} onChange={onShellViewChange} />
            </div>
          </header>
          <NotesCalendarToolbar
            calendarRef={notesCalendarRef}
            calendarTitle={calendarTitle}
            activeFcView={calendarFcView}
            onActiveFcViewChange={onCalendarFcViewChange}
            dateMode={calendarDateMode}
            onDateModeChange={setCalendarDateMode}
          />
          <NotesCalendarPane
            onPreviewNote={openEdit}
            onOpenNoteInList={openNoteInListFromCalendar}
            fcView={calendarFcView}
            fullCalendarRef={notesCalendarRef}
            onViewMeta={(meta): void => setCalendarTitle(meta.title)}
            previewNoteId={editing?.id ?? null}
            dateMode={calendarDateMode}
            className="min-h-0 min-w-0 flex-1"
          />
      </div>
      {editing ? (
        <>
          <VerticalSplitter
            ariaLabel={t('notes.shell.splitterPreviewAria')}
            onDrag={(delta): void => setCalendarEditorWidth((w) => w - delta)}
          />
          <NotesShellNoteEditorColumn
            layout="calendar"
            widthPx={calendarEditorWidth}
            {...noteEditorColumnSharedProps}
          />
        </>
      ) : null}
      {editing ? (
        <NotesLinkedPreviewPane
          open={linkedPreviewOpen}
          placement={linkedPreviewPlacement}
          onPlacementChange={(placement): void => {
            setLinkedPreviewPlacement(placement)
            persistNotesLinkedPreviewPlacement(placement)
          }}
          onClose={(): void => {
            setLinkedPreviewOpen(false)
            persistNotesLinkedPreviewOpen(false)
          }}
          entries={previewEntries}
          selectedKey={linkedPreviewKey}
          onSelectKey={setLinkedPreviewKey}
          editing={editing}
          accounts={accounts}
          dockWidthPx={previewDockWidth}
          onDockWidthDrag={(delta): void => setPreviewDockWidth((w) => w - delta)}
          floatDefaultWidth={notesSettings.defaultFloatPreviewWidth}
          floatDefaultHeight={notesSettings.defaultFloatPreviewHeight}
        />
      ) : null}
    </div>
  )

  return (
    <section className={moduleShellClass}>
      {notesNavColumn}
      <VerticalSplitter
        variant="moduleNav"
        ariaLabel={t('common.moduleNavSplitter')}
        onDrag={(delta): void => setNavWidth((w) => w + delta)}
      />
      {shellView === 'calendar' ? (
        notesCalendarWorkspace
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleNoteDragEnd}
        >
          {notesListWorkspace}
        </DndContext>
      )}
      {templateFromNoteOpen ? (
        <NotePageTemplateEditDialog
          editorState={templateFromNoteOpen}
          onClose={(): void => setTemplateFromNoteOpen(null)}
          onSave={(entry): void => {
            upsertCustomNotePageTemplate(loadCustomNotePageTemplates(), entry)
            setTemplateFromNoteOpen(null)
            pushToast({ label: t('notes.templates.savedToast'), variant: 'success' })
          }}
        />
      ) : null}
      {editing && categoryPopover ? (
        <NoteCategoriesPopover
          open
          anchor={categoryPopover}
          noteId={editing.id}
          account={
            accounts.find(
              (a) => a.id === resolveNoteCategoryAccountId(editing as UserNoteListItem, accounts)
            ) ?? null
          }
          selectedNames={(editing as UserNoteListItem).categories ?? []}
          onClose={(): void => setCategoryPopover(null)}
          onSaved={(): void => {
            void load().then(() => {
              void window.mailClient.notes.getById(editing.id).then((fresh) => {
                if (fresh) setEditing(fresh)
              })
            })
          }}
        />
      ) : null}
      {editing && sectionPopover ? (
        <NoteSectionPopover
          open
          anchor={sectionPopover}
          noteId={editing.id}
          sections={sections}
          currentSectionId={editing.sectionId ?? null}
          onClose={(): void => setSectionPopover(null)}
          onMoved={(): void => {
            void load().then(() => {
              void window.mailClient.notes.getById(editing.id).then((fresh) => {
                if (fresh) setEditing(fresh)
              })
            })
          }}
        />
      ) : null}
      {editing && meetingInsertOpen ? (
        <NoteMeetingInsertDialog
          open
          accounts={accounts}
          onClose={(): void => setMeetingInsertOpen(false)}
          onInsert={handleMeetingInsert}
        />
      ) : null}
      {editing && embedInsertOpen ? (
        <NoteEmbedInsertDialog
          open
          editorRef={editorRef}
          onClose={(): void => setEmbedInsertOpen(false)}
          onChangeHtml={handleEditBodyChangeWithAutosave}
          onInserted={(): void => {
            pushToast({ label: t('notes.embedInsert.insertedToast'), variant: 'success' })
          }}
          onError={(message): void => {
            pushToast({ label: message, variant: 'error' })
          }}
        />
      ) : null}
      {noteInk.inkDialog}
      {noteCloudTask.cloudTaskDialog}
      {noteCalendarEvent.calendarEventDialog}
    </section>
  )
}
