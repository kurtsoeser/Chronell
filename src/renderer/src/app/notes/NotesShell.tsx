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
  FileDown,
  FilePlus2,
  Loader2,
  PanelRightOpen,
  Printer,
  Trash2,
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
import type { NoteLinksBundle } from '@shared/note-entity-links'
import type {
  ConnectedAccount,
  NoteSection,
  UserNote,
  UserNoteListItem
} from '@shared/types'
import type { MiniMonthSelectedRange } from '@/app/calendar/MiniMonthGrid'
import { ModuleNavMiniMonth } from '@/components/ModuleNavMiniMonth'
import {
  moduleNavColumnClass,
  modulePaneStackClass,
  moduleShellClass
} from '@/components/module-shell-layout'
import { NotesCalendarPane } from '@/app/notes/NotesCalendarPane'
import { NotesCalendarToolbar } from '@/app/notes/NotesCalendarToolbar'
import { NotesLinkedPreviewPane } from '@/app/notes/NotesLinkedPreviewPane'
import { buildNotesPreviewLinkEntries } from '@/app/notes/notes-link-preview-items'
import {
  persistNotesLinkedPreviewOpen,
  persistNotesLinkedPreviewPlacement,
  readNotesLinkedPreviewOpen,
  readNotesLinkedPreviewPlacement
} from '@/app/notes/notes-shell-storage'
import { readNotesActiveFcView } from '@/app/notes/notes-active-fc-view-storage'
import {
  persistNotesActiveShellView,
  readNotesActiveShellView
} from '@/app/notes/notes-active-shell-view-storage'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import { NotesOneNotePageHeader } from '@/app/notes/NotesOneNotePageHeader'
import { NotesShellEditorPane } from '@/app/notes/NotesShellEditorPane'
import { noteTitle } from '@/app/notes/notes-display-helpers'
import {
  readNotesPagesSort,
  compareNotesPagesSibling,
  type NotesPagesSortKey
} from '@/lib/notes-pages-sort'
import { NoteMeetingInsertDialog, type NoteMeetingInsertResult } from '@/app/notes/NoteMeetingInsertDialog'
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
import { NotesChildPagesBar } from '@/app/notes/NotesChildPagesBar'
import {
  buildNoteBreadcrumb,
  buildNotesPageRows,
  listDirectChildNotes
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
import { ContentCrossfade } from '@/components/motion/ContentCrossfade'
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
import { useIdBulkSelection } from '@/lib/id-bulk-selection'
import { useBulkListKeyboardShortcuts } from '@/lib/use-bulk-list-keyboard-shortcuts'

const NOTES_DETAIL_WIDTH_KEY = 'mailclient.notesShell.detailWidth'
const NOTES_NAV_WIDTH_KEY = 'mailclient.notesShell.navWidth.v2'
const NOTES_PREVIEW_DOCK_WIDTH_KEY = 'mailclient.notesShell.previewDockWidth'
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

export function NotesShell(): JSX.Element {
  const { t, i18n } = useTranslation()
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
  const editBodyRef = useRef('')
  const editorFlushRef = useRef<(() => void) | null>(null)
  const editorInsertHtmlRef = useRef<((html: string) => void) | null>(null)
  const lastSavedTitleRef = useRef('')
  const lastSavedBodyRef = useRef('')
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [meetingInsertOpen, setMeetingInsertOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateFromNoteOpen, setTemplateFromNoteOpen] = useState<NotePageTemplateEditorState | null>(
    null
  )
  const [shellView, setShellView] = useState<NotesShellView>(() => readNotesActiveShellView())
  const [sections, setSections] = useState<NoteSection[]>([])
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null)
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

  const onNotesChanged = useCallback((): void => {
    void load()
    void loadSections()
  }, [load, loadSections])

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

  const editingChildNotes = useMemo(() => {
    if (!editing) return []
    const compare = (a: UserNoteListItem, b: UserNoteListItem): number =>
      compareNotesPagesSibling(a, b, pagesSort, untitledLabel)
    return listDirectChildNotes(editing.id, pagesNotes, compare)
  }, [editing, pagesNotes, pagesSort, untitledLabel])

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

  const handleMeetingInsert = useCallback(
    async (result: NoteMeetingInsertResult, html: string): Promise<void> => {
      if (!editing) return
      editorInsertHtmlRef.current?.(html)
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
    [editing, pushToast, t]
  )

  const handleScreenClip = useCallback((): void => {
    void runScreenClipCapture({
      activeNoteId: editing?.id ?? null,
      insertHtml: (html): void => {
        editorInsertHtmlRef.current?.(html)
      }
    })
  }, [editing?.id])

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

  useEffect(() => {
    if (!editing) return
    const fresh = notes.find((n) => n.id === editing.id)
    if (fresh) {
      setEditing((prev) => (prev?.id === fresh.id ? fresh : prev))
    }
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
        flushAutosaveTimer()
        setEditing(resolved)
        setEditorSeedHtml(editorHtml)
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
    [applyNotePatch, clearSelectedMessage, flushAutosaveTimer, persistMigratedBody, selectMessageWithThreadPreview]
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
    editorFlushRef.current?.()
    const bodyToSave = normalizeNoteBodyForStorage(editBodyRef.current)
    setSaving(true)
    setError(null)
    const schedule = scheduleFieldsFromDraft(scheduleDraft)
    try {
      let saved: UserNote
      if (editing.kind === 'standalone') {
        saved = await window.mailClient.notes.updateStandalone({
          id: editing.id,
          title: editTitleRef.current,
          body: bodyToSave,
          ...(schedule.clearSchedule ? { clearSchedule: true } : {}),
          ...(!schedule.clearSchedule && scheduleDraft
            ? {
                scheduledStartIso: schedule.scheduledStartIso,
                scheduledEndIso: schedule.scheduledEndIso,
                scheduledAllDay: schedule.scheduledAllDay
              }
            : {})
        })
      } else if (editing.kind === 'mail' && editing.messageId != null) {
        saved = await window.mailClient.notes.upsertMail({
          messageId: editing.messageId,
          title: editTitleRef.current,
          body: bodyToSave,
          ...(scheduleDraft
            ? {
                scheduledStartIso: schedule.scheduledStartIso,
                scheduledEndIso: schedule.scheduledEndIso,
                scheduledAllDay: schedule.scheduledAllDay
              }
            : {})
        })
      } else if (
        editing.kind === 'calendar' &&
        editing.accountId &&
        editing.calendarSource &&
        editing.calendarRemoteId &&
        editing.eventRemoteId
      ) {
        saved = await window.mailClient.notes.upsertCalendar({
          accountId: editing.accountId,
          calendarSource: editing.calendarSource,
          calendarRemoteId: editing.calendarRemoteId,
          eventRemoteId: editing.eventRemoteId,
          title: editTitleRef.current,
          body: bodyToSave,
          eventTitleSnapshot: editing.eventTitleSnapshot,
          eventStartIsoSnapshot: editing.eventStartIsoSnapshot,
          ...(scheduleDraft
            ? {
                scheduledStartIso: schedule.scheduledStartIso,
                scheduledEndIso: schedule.scheduledEndIso,
                scheduledAllDay: schedule.scheduledAllDay
              }
            : {})
        })
      } else {
        throw new Error(t('notes.shell.invalidNote'))
      }
      setEditing({ ...editing, ...saved })
      editTitleRef.current = saved.title ?? ''
      lastSavedTitleRef.current = saved.title ?? ''
      lastSavedBodyRef.current = saved.body
      if (opts?.silent) {
        applyNotePatch(saved)
      } else {
        const editorHtml = prepareNoteBodyForEditor(saved.body).html
        editBodyRef.current = editorHtml
        setEditorSeedHtml(editorHtml)
        await load()
        await loadSections()
        pushToast({ label: t('notes.editor.saved'), variant: 'success' })
      }
      setScheduleDraft(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const autosaveRef = useRef({ run: async (): Promise<void> => {} })
  autosaveRef.current = {
    run: async (): Promise<void> => {
      if (!editing || saving) return
      editorFlushRef.current?.()
      const scheduleNote = scheduleDraft && !scheduleDraft.clearSchedule
        ? {
            scheduledStartIso: scheduleDraft.scheduledStartIso,
            scheduledEndIso: scheduleDraft.scheduledEndIso,
            scheduledAllDay: scheduleDraft.scheduledAllDay
          }
        : editing
      if (
        !noteEditingHasUnsavedChanges({
          editTitle: editTitleRef.current,
          editBodyHtml: editBodyRef.current,
          lastSavedTitle: lastSavedTitleRef.current,
          lastSavedBody: lastSavedBodyRef.current,
          scheduleDraft,
          note: scheduleNote
        })
      ) {
        return
      }
      await saveEditing({ silent: true })
    }
  }

  const scheduleAutosave = useCallback((): void => {
    if (notesSettings.autosaveMode !== 'on_change' || !editing) return
    flushAutosaveTimer()
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void autosaveRef.current.run()
    }, NOTES_AUTOSAVE_DEBOUNCE_MS)
  }, [editing, flushAutosaveTimer, notesSettings.autosaveMode])

  const handleTitleChange = useCallback(
    (title: string): void => {
      editTitleRef.current = title
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const handleEditBodyChangeWithAutosave = useCallback(
    (html: string): void => {
      editBodyRef.current = html
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

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
    return (): void => {
      flushAutosaveTimer()
      if (notesSettings.autosaveMode === 'off') return
      void autosaveRef.current.run()
    }
  }, [editing?.id, flushAutosaveTimer, notesSettings.autosaveMode])

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
                onSectionsChanged={onNotesChanged}
              />
            )}
          </div>
        ) : null}
    </aside>
  )

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

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className={cn(moduleColumnHeaderShellBarClass, 'min-w-0')}>
              <div className={cn(moduleColumnHeaderTitleClass, 'min-w-0 truncate text-left')}>
                {editing
                  ? noteTitle(editing, t('notes.shell.untitled'))
                  : t('notes.shell.selectNote')}
              </div>
              <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                <NotesShellSearch
                  sections={sections}
                  accounts={accounts}
                  onOpenNote={openEdit}
                />
                <NotesShellViewToggle value={shellView} onChange={onShellViewChange} />
                {editing && previewEntries.length > 0 ? (
                  <ModuleColumnHeaderIconButton
                    type="button"
                    onClick={(): void => {
                      const next = !linkedPreviewOpen
                      setLinkedPreviewOpen(next)
                      persistNotesLinkedPreviewOpen(next)
                    }}
                    aria-label={t('notes.preview.togglePane')}
                    title={t('notes.preview.togglePaneShort')}
                  >
                    <PanelRightOpen
                      className={cn(
                        moduleColumnHeaderIconGlyphClass,
                        linkedPreviewOpen && 'text-primary'
                      )}
                    />
                  </ModuleColumnHeaderIconButton>
                ) : null}
                {editing ? (
                  <ModuleColumnHeaderIconButton
                    type="button"
                    onClick={(): void => {
                      setEditing(null)
                      setScheduleDraft(null)
                      clearSelectedMessage()
                    }}
                    aria-label={t('common.close')}
                  >
                    <X className={moduleColumnHeaderIconGlyphClass} />
                  </ModuleColumnHeaderIconButton>
                ) : null}
              </div>
            </header>

            {error ? (
              <div className="border-b border-border px-4 py-2 text-xs text-destructive">{error}</div>
            ) : null}

            {!editing ? (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                {t('notes.shell.selectNoteHint')}
              </div>
            ) : (
              <ContentCrossfade contentKey={editing.id} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-muted/15">
                  <div className="note-onenote-page flex w-full min-w-0 flex-1 flex-col bg-card px-5 py-4 sm:px-6">
                    <NotesOneNotePageHeader
                      key={editing.id}
                      note={editing}
                      noteId={editing.id}
                      categories={(editing as UserNoteListItem).categories ?? []}
                      categoryColorByName={categoryColorByName}
                      sectionName={editingSectionName}
                      initialTitle={editing.title ?? ''}
                      onTitleChange={handleTitleChange}
                      disabled={saving}
                      breadcrumb={editingBreadcrumb.map((crumb) => ({
                        id: crumb.id,
                        title: noteTitle(crumb, t('notes.shell.untitled'))
                      }))}
                      onBreadcrumbNavigate={(id): void => {
                        const crumb = notesById.get(id)
                        if (crumb) openEdit(crumb)
                      }}
                      onOpenCategories={setCategoryPopover}
                      onOpenSection={setSectionPopover}
                      onIconChange={(iconId): void => void patchNoteDisplay({ iconId: iconId ?? null })}
                      onIconColorChange={(iconColor): void => void patchNoteDisplay({ iconColor })}
                      scheduleNote={
                        scheduleDraft && !scheduleDraft.clearSchedule
                          ? {
                              scheduledStartIso: scheduleDraft.scheduledStartIso,
                              scheduledEndIso: scheduleDraft.scheduledEndIso,
                              scheduledAllDay: scheduleDraft.scheduledAllDay
                            }
                          : editing
                      }
                      defaultScheduleDurationMinutes={notesSettings.defaultScheduleDurationMinutes}
                      onScheduleChange={(value): void => setScheduleDraft(value)}
                    />

                    <NotesChildPagesBar
                      childNotes={editingChildNotes}
                      activeNoteId={editing.id}
                      onOpenNote={(note): void => openEdit(note)}
                      onCreateSubPage={(): void => void createSubPage(editing as UserNoteListItem)}
                      disabled={saving}
                    />

                    <NotesShellEditorPane
                      noteId={editing.id}
                      editorSeedHtml={editorSeedHtml}
                      onChangeHtml={handleEditBodyChangeWithAutosave}
                      flushRef={editorFlushRef}
                      insertHtmlRef={editorInsertHtmlRef}
                      onOpenLinkedNote={(id): void => void openNoteById(id)}
                      onOpenMeetingInsert={(): void => setMeetingInsertOpen(true)}
                      onOpenScreenClip={handleScreenClip}
                      saving={saving}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-1 border-t border-border/60 bg-background px-4 pb-2 pt-2">
                    <div className="text-xs text-muted-foreground">
                      {notesSettings.autosaveMode === 'on_change'
                        ? t('notes.editor.autosaveHint')
                        : t('notes.editor.wysiwygHint')}
                    </div>

                    <EntityContextBlock
                      anchor={{ kind: 'note', noteId: editing.id }}
                      showObjectNote={false}
                      contentPaddingClass="px-0"
                      sectionCollapsedDefault={notesSettings.entityContextCollapsedDefault}
                      className="border-t border-border/60"
                    />

                    <footer className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(): void => void deleteNote(editing as UserNoteListItem)}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('common.delete')}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(): void =>
                            setTemplateFromNoteOpen({
                              mode: 'create',
                              name: editTitleRef.current.trim() || t('notes.shell.untitled'),
                              description: '',
                              bodyHtml: editBodyRef.current
                            })
                          }
                          className={cn(
                            moduleColumnHeaderOutlineSmClass,
                            'px-3 py-2 text-sm font-medium'
                          )}
                        >
                          {t('notes.templates.saveFromNote')}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(): void => void createSubPage(editing as UserNoteListItem)}
                          className={cn(
                            moduleColumnHeaderOutlineSmClass,
                            'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium'
                          )}
                        >
                          <FilePlus2 className="h-4 w-4" />
                          {t('notes.subPages.create')}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handlePrintPage}
                          className={cn(
                            moduleColumnHeaderOutlineSmClass,
                            'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium'
                          )}
                        >
                          <Printer className="h-4 w-4" />
                          {t('notes.export.print')}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleExportPdf}
                          className={cn(
                            moduleColumnHeaderOutlineSmClass,
                            'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium'
                          )}
                        >
                          <FileDown className="h-4 w-4" />
                          {t('notes.export.pdf')}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(): void => void saveEditing()}
                        disabled={saving}
                        className={cn(
                          moduleColumnHeaderOutlineSmClass,
                          'min-w-28 justify-center px-4 py-2 text-sm font-semibold'
                        )}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {t('common.save')}
                      </button>
                    </footer>
                  </div>

              </ContentCrossfade>
            )}
      </main>

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
          onDockWidthDrag={(delta): void => setPreviewDockWidth((w) => w + delta)}
          floatDefaultWidth={notesSettings.defaultFloatPreviewWidth}
          floatDefaultHeight={notesSettings.defaultFloatPreviewHeight}
        />
      ) : null}
    </div>
  )

  const notesCalendarWorkspace = (
    <div className={cn(modulePaneStackClass, 'flex-col')}>
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
        />
        <NotesCalendarPane
          onSelectNote={openEdit}
          fcView={calendarFcView}
          fullCalendarRef={notesCalendarRef}
          onViewMeta={(meta): void => setCalendarTitle(meta.title)}
          selectedNoteId={editing?.id ?? null}
          className="min-h-0 min-w-0 flex-1"
        />
      </div>
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
    </section>
  )
}
