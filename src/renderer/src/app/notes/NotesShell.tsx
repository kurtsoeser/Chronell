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
  Loader2,
  PanelRightOpen,
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
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
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
import { NotesAttachmentsPanel } from '@/app/notes/NotesAttachmentsPanel'
import { NotesPagesPane } from '@/app/notes/NotesPagesPane'
import {
  readNotesPagesSort,
  sortNotesPages,
  type NotesPagesSortKey
} from '@/lib/notes-pages-sort'
import { NotesNoteScheduleBlock } from '@/app/notes/NotesNoteScheduleBlock'
import { NotesSidebarList } from '@/app/notes/NotesSidebarList'
import { NotesShellSearch } from '@/app/notes/NotesShellSearch'
import { NotesShellViewToggle, type NotesShellView } from '@/app/notes/NotesShellViewToggle'
import { formatNoteDate, noteKindLabel, noteTitle } from '@/app/notes/notes-display-helpers'
import { NoteDisplayIcon } from '@/components/NoteDisplayIcon'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { IconColorPickerFooter } from '@/components/IconColorPickerFooter'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import { MarkdownNoteEditor } from '@/components/MarkdownNoteEditor'
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
import type { NotesEditorPreviewMode } from '@/lib/notes-settings-prefs'
import {
  defaultNavSelection,
  navSelectionLabel,
  notesForNavSelection,
  persistNotesNavSelection,
  readNotesNavSelection,
  sectionIdForNewNote,
  type NotesNavSelection
} from '@/lib/notes-nav-selection'
import { parseNoteDragId, parseNoteNavDropId } from '@/lib/notes-sidebar-dnd'
import {
  readNotesSidebarListMode,
  type NotesSidebarListMode,
  persistNotesSidebarListMode
} from '@/lib/notes-sidebar-storage'
import { LOCAL_NOTES_ACCOUNT_KEY, buildNoteAccountBuckets } from '@/lib/notes-sidebar-accounts'
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

const NOTES_DETAIL_WIDTH_KEY = 'mailclient.notesShell.detailWidth'
const NOTES_NAV_WIDTH_KEY = 'mailclient.notesShell.navWidth.v2'
const NOTES_PREVIEW_DOCK_WIDTH_KEY = 'mailclient.notesShell.previewDockWidth'

function editorPropsFromPreviewMode(mode: NotesEditorPreviewMode, toggleTab: 'edit' | 'preview'): {
  layout: 'live' | 'toggle'
  preview: 'live' | 'edit' | 'preview'
  initialToggleTab: 'edit' | 'preview'
} {
  if (mode === 'toggle') {
    return { layout: 'toggle', preview: 'edit', initialToggleTab: toggleTab }
  }
  return { layout: 'live', preview: mode, initialToggleTab: toggleTab }
}
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
  const dfLocale = locale.startsWith('de') ? deFns : enUSFns
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
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shellView, setShellView] = useState<NotesShellView>(() => readNotesActiveShellView())
  const [sections, setSections] = useState<NoteSection[]>([])
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null)
  const [listMode, setListMode] = useState<NotesSidebarListMode>(() => readNotesSidebarListMode())
  const [navSelection, setNavSelection] = useState<NotesNavSelection>(() =>
    readNotesNavSelection(readNotesSidebarListMode())
  )
  const [pagesSort, setPagesSort] = useState<NotesPagesSortKey>(() => readNotesPagesSort())

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

  const pagesNotes = useMemo(() => {
    const filtered = notesForNavSelection(notes, navSelection)
    return sortNotesPages(filtered, pagesSort, t('notes.shell.untitled'))
  }, [notes, navSelection, pagesSort, t])

  const showSectionLabelsInPages =
    notesSettings.showSectionLabelsInPages ||
    (navSelection.kind === 'sections' && navSelection.scope === 'all')

  const previewEntries = useMemo(() => {
    if (!editing || !linksBundle) return []
    return buildNotesPreviewLinkEntries(editing, linksBundle, t)
  }, [editing, linksBundle, t])

  const editorUi = useMemo(
    () =>
      editorPropsFromPreviewMode(
        notesSettings.defaultEditorPreviewMode,
        notesSettings.defaultEditorToggleTab
      ),
    [notesSettings.defaultEditorPreviewMode, notesSettings.defaultEditorToggleTab]
  )

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
      const exists = sections.some((s) => s.id === sectionScope.sectionId)
      if (!exists) {
        setNavSelection(defaultNavSelection('sections'))
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
        if (editing?.id === note.id) setEditTitle(title)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [applyNotePatch, editing?.id, t]
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
        setEditing(resolved)
        setEditTitle(resolved.title ?? '')
        setEditBody(resolved.body)
        setScheduleDraft(null)
        if (resolved.kind === 'mail' && resolved.messageId != null) {
          void selectMessageWithThreadPreview(resolved.messageId)
        } else {
          clearSelectedMessage()
        }
      })()
    },
    [clearSelectedMessage, selectMessageWithThreadPreview]
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

  const createStandalone = useCallback(async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const sectionId =
        listMode === 'sections' ? sectionIdForNewNote(navSelection) : null
      const note = await window.mailClient.notes.createStandalone({
        title: t('notes.shell.newStandaloneTitle'),
        body: '',
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
  }, [
    t,
    clearSelectedMessage,
    openEdit,
    listMode,
    navSelection,
    notesSettings.openNoteAfterCreate,
    load,
    loadSections
  ])

  useEffect(() => {
    const pending = useGlobalCreateNavigateStore.getState().takePendingAfterNavigate()
    if (pending === 'note') {
      window.setTimeout((): void => void createStandalone(), 0)
    }
  }, [createStandalone])

  useEffect(() => {
    function onGlobalCreate(e: Event): void {
      const ce = e as CustomEvent<{ kind?: string }>
      if (ce.detail?.kind !== 'note') return
      void createStandalone()
    }
    window.addEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
    return (): void => window.removeEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
  }, [createStandalone])

  const isEditingDirty = useMemo(() => {
    if (!editing) return false
    if (scheduleDraft) return true
    return editTitle !== (editing.title ?? '') || editBody !== editing.body
  }, [editing, editTitle, editBody, scheduleDraft])

  async function saveEditing(opts?: { silent?: boolean }): Promise<void> {
    if (!editing) return
    setSaving(true)
    setError(null)
    const schedule = scheduleFieldsFromDraft(scheduleDraft)
    try {
      let saved: UserNote
      if (editing.kind === 'standalone') {
        saved = await window.mailClient.notes.updateStandalone({
          id: editing.id,
          title: editTitle,
          body: editBody,
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
          title: editTitle,
          body: editBody,
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
          title: editTitle,
          body: editBody,
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
      setEditTitle(saved.title ?? '')
      setEditBody(saved.body)
      setScheduleDraft(null)
      if (!opts?.silent) {
        pushToast({ label: t('notes.editor.saved'), variant: 'success' })
      }
      await load()
      await loadSections()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const autosaveRef = useRef({ dirty: false, run: async (): Promise<void> => {} })
  autosaveRef.current = {
    dirty: isEditingDirty,
    run: async (): Promise<void> => {
      if (!isEditingDirty || saving) return
      await saveEditing({ silent: true })
    }
  }

  useEffect(() => {
    if (notesSettings.autosaveMode !== 'interval' || !editing) return
    const id = window.setInterval(() => {
      void autosaveRef.current.run()
    }, notesSettings.autosaveIntervalSeconds * 1000)
    return (): void => clearInterval(id)
  }, [notesSettings.autosaveMode, notesSettings.autosaveIntervalSeconds, editing?.id])

  useEffect(() => {
    return (): void => {
      if (notesSettings.autosaveMode !== 'on_leave') return
      if (!autosaveRef.current.dirty) return
      void autosaveRef.current.run()
    }
  }, [editing?.id, notesSettings.autosaveMode])

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
    [t, clearSelectedMessage, openEdit, pushToast, load]
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
          notes={pagesNotes}
          sections={sections}
          showSectionLabels={showSectionLabelsInPages}
          loading={loading}
          activeNoteId={editing?.id ?? null}
          onOpenNote={openEdit}
          onRenameNoteTitle={renameNoteTitleInList}
          onPatchNoteDisplay={patchNoteDisplayInList}
          onDeleteNote={deleteNote}
          isNoteExiting={isNoteExiting}
          onCopyNote={copyNote}
          onMoveNote={moveNote}
          onCreateNote={(): void => void createStandalone()}
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
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="flex shrink-0 flex-col gap-3 overflow-y-auto p-4 pb-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <NoteDisplayIcon note={editing} className="h-4 w-4" />
                      <span>{noteKindLabel(editing, t)}</span>
                      {editing.scheduledStartIso ? (
                        <span className="text-primary">
                          {formatNoteDate(editing.scheduledStartIso, i18n.language)}
                        </span>
                      ) : null}
                      <span>{formatNoteDate(editing.updatedAt, i18n.language)}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <CalendarEventIconPicker
                        layout="compact"
                        openOn="doubleClick"
                        iconId={editing.iconId}
                        iconColorHex={resolveEntityIconColor(editing.iconColor)}
                        title={editTitle.trim() || noteTitle(editing, t('notes.shell.untitled'))}
                        disabled={saving}
                        triggerIcon={<NoteDisplayIcon note={editing} className="h-4 w-4" />}
                        onIconChange={(iconId): void => void patchNoteDisplay({ iconId: iconId ?? null })}
                        footer={
                          <IconColorPickerFooter
                            iconColor={editing.iconColor}
                            onIconColorChange={(iconColor): void =>
                              void patchNoteDisplay({ iconColor })
                            }
                          />
                        }
                      />
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e): void => setEditTitle(e.target.value)}
                        placeholder={t('notes.shell.titlePlaceholder')}
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-base font-semibold outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                      />
                    </div>

                    <NotesNoteScheduleBlock
                      note={
                        scheduleDraft && !scheduleDraft.clearSchedule
                          ? {
                              scheduledStartIso: scheduleDraft.scheduledStartIso,
                              scheduledEndIso: scheduleDraft.scheduledEndIso,
                              scheduledAllDay: scheduleDraft.scheduledAllDay
                            }
                          : editing
                      }
                      defaultExpanded={notesSettings.scheduleBlockExpandedDefault}
                      defaultDurationMinutes={notesSettings.defaultScheduleDurationMinutes}
                      disabled={saving}
                      onChange={(value): void => setScheduleDraft(value)}
                    />

                    <NotesAttachmentsPanel noteId={editing.id} />
                  </div>

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4">
                    <MarkdownNoteEditor
                      value={editBody}
                      onChange={setEditBody}
                      placeholder={t('notes.editor.placeholder')}
                      fillHeight
                      minHeight={200}
                      className="min-h-0 flex-1"
                      {...editorUi}
                    />
                  </div>

                  <div className="flex shrink-0 flex-col gap-1 px-4 pb-2">
                    <div className="text-xs text-muted-foreground">{t('notes.editor.markdownHint')}</div>

                    <EntityContextBlock
                      anchor={{ kind: 'note', noteId: editing.id }}
                      showObjectNote={false}
                      contentPaddingClass="px-0"
                      sectionCollapsedDefault={notesSettings.entityContextCollapsedDefault}
                      className="border-t border-border/60"
                    />

                    <footer className="flex justify-between gap-3 pt-1">
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
    </section>
  )
}
