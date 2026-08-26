import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { endOfDay, parseISO, startOfDay } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount, NoteSection, NotesChangedPayload, UserNote, UserNoteListItem } from '@shared/types'
import { initialNotesDateRangeFromPrefs } from '@/lib/notes-initial-date-range'
import { noteKindsForFilter } from '@/lib/notes-settings-prefs'
import {
  defaultNavSelection,
  navSelectionLabel,
  notesForNavSelection,
  persistNotesNavSelection,
  readNotesNavSelection,
  type NotesNavSelection
} from '@/lib/notes-nav-selection'
import { buildNotesPageRows } from '@/lib/notes-page-tree'
import {
  readNotesPageTreeCollapsed,
  toggleNotesPageTreeCollapsed,
  persistNotesPageTreeCollapsed
} from '@/lib/notes-page-collapse-storage'
import {
  readNotesPagesSort,
  type NotesPagesSortKey
} from '@/lib/notes-pages-sort'
import {
  readNotesSidebarListMode,
  persistNotesSidebarListMode,
  type NotesSidebarListMode
} from '@/lib/notes-sidebar-storage'
import { invalidateNoteGetByIdCache } from '@/lib/note-get-by-id-cache'
import { LOCAL_NOTES_ACCOUNT_KEY, buildNoteAccountBuckets } from '@/lib/notes-sidebar-accounts'
import { useIdBulkSelection } from '@/lib/id-bulk-selection'
import { useNotesSettingsPrefs } from '@/lib/use-notes-settings-prefs'
import { useNotesListSearchStore } from '@/stores/notes-list-search'
import {
  applyNotesMiniCalendarRange,
  clearNotesDateRange,
  notesDateRangeLabel,
  notesSelectedRange
} from '@/app/notes/shell/notes-shell-date-range'

export function useNotesListData(
  accounts: ConnectedAccount[],
  editingNoteIdRef?: MutableRefObject<number | null | undefined>
) {
  const { t, i18n } = useTranslation()
  const notesSettings = useNotesSettingsPrefs()
  const listSearchQuery = useNotesListSearchStore((s) => s.query)
  const clearListSearch = useNotesListSearchStore((s) => s.clear)
  const initialDateRange = useMemo(() => initialNotesDateRangeFromPrefs(), [])

  const [notes, setNotes] = useState<UserNoteListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sections, setSections] = useState<NoteSection[]>([])
  const [dateFrom, setDateFrom] = useState(initialDateRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialDateRange.dateTo)
  const [miniMonth, setMiniMonth] = useState(initialDateRange.miniMonth)
  const [listMode, setListMode] = useState<NotesSidebarListMode>(() => readNotesSidebarListMode())
  const [navSelection, setNavSelection] = useState<NotesNavSelection>(() =>
    readNotesNavSelection(readNotesSidebarListMode())
  )
  const [pagesSort, setPagesSort] = useState<NotesPagesSortKey>(() => readNotesPagesSort())
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<number>>(() =>
    readNotesPageTreeCollapsed()
  )
  const [categoryColorByName, setCategoryColorByName] = useState(() => new Map<string, string>())

  const notesChangedReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduledOnlyFilter = notesSettings.defaultDateFilterMode === 'scheduled_only'

  const loadSections = useCallback(async (): Promise<void> => {
    try {
      setSections(await window.mailClient.notes.sections.list())
    } catch {
      setSections([])
    }
  }, [])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const kinds = noteKindsForFilter(notesSettings.defaultNoteKindsFilter)
      const searchQ = listSearchQuery.trim()
      if (searchQ.length >= 2) {
        const hits = await window.mailClient.notes.search({
          query: searchQ,
          kinds,
          limit: 100
        })
        setNotes(hits)
        try {
          setSections(await window.mailClient.notes.sections.list())
        } catch {
          /* keep previous sections */
        }
        return
      }
      const result = await window.mailClient.notes.listShellBootstrap({
        kinds,
        accountIds: [],
        dateFrom: dateFrom ? startOfDay(parseISO(dateFrom)).toISOString() : null,
        dateTo: dateTo ? endOfDay(parseISO(dateTo)).toISOString() : null,
        scheduledOnly: scheduledOnlyFilter,
        limit: notesSettings.notesListFetchLimit,
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
  }, [
    dateFrom,
    dateTo,
    listSearchQuery,
    notesSettings.defaultNoteKindsFilter,
    notesSettings.notesListFetchLimit,
    scheduledOnlyFilter
  ])

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

  const applyNotePatch = useCallback((note: UserNote | UserNoteListItem): void => {
    invalidateNoteGetByIdCache(note.id)
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === note.id)
      if (!exists) {
        return [note as UserNoteListItem, ...prev]
      }
      return prev.map((n) => (n.id === note.id ? ({ ...n, ...note } as UserNoteListItem) : n))
    })
  }, [])

  const applyNotesChangedDelta = useCallback((detail: NotesChangedPayload): boolean => {
    const noteId = detail.noteId
    if (noteId == null) return false

    if (detail.deleted) {
      invalidateNoteGetByIdCache(noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      return true
    }

    if (detail.patch) {
      invalidateNoteGetByIdCache(noteId)
      setNotes((prev) => {
        const exists = prev.some((n) => n.id === noteId)
        if (!exists && detail.scope === 'structure') {
          return [{ ...detail.patch, id: noteId } as UserNoteListItem, ...prev]
        }
        if (!exists) return prev
        return prev.map((n) =>
          n.id === noteId ? ({ ...n, ...detail.patch, id: noteId } as UserNoteListItem) : n
        )
      })
      return true
    }

    return false
  }, [])

  const onSectionsChanged = useCallback((): void => {
    void loadSections()
    scheduleNotesListReload()
  }, [loadSections, scheduleNotesListReload])

  const onNotesChanged = useCallback(
    (detail: NotesChangedPayload): void => {
      const noteId = detail.noteId
      const scope = detail.scope ?? 'content'
      const editingNoteId = editingNoteIdRef?.current

      if (
        noteId != null &&
        editingNoteId === noteId &&
        (scope === 'content' || scope === 'meta')
      ) {
        return
      }
      if (scope === 'attachments' || scope === 'links') {
        return
      }
      if (applyNotesChangedDelta(detail)) {
        return
      }
      if (noteId != null && (scope === 'meta' || scope === 'content')) {
        void window.mailClient.notes
          .getById(noteId)
          .then((note) => {
            if (note) applyNotePatch(note)
          })
          .catch(() => {
            scheduleNotesListReload()
          })
        return
      }
      scheduleNotesListReload()
    },
    [applyNotePatch, applyNotesChangedDelta, scheduleNotesListReload, editingNoteIdRef]
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

  const selectedRange = useMemo(
    () => notesSelectedRange(dateFrom, dateTo),
    [dateFrom, dateTo]
  )

  const dateRangeLabel = useMemo(
    () => notesDateRangeLabel(dateFrom, dateTo, i18n.language),
    [dateFrom, dateTo, i18n.language]
  )

  const searchActive = listSearchQuery.trim().length >= 2

  const pagesNotes = useMemo(
    () => (searchActive ? notes : notesForNavSelection(notes, navSelection)),
    [notes, navSelection, searchActive]
  )

  const untitledLabel = t('notes.shell.untitled')

  const pageRows = useMemo(
    () => buildNotesPageRows(pagesNotes, pagesSort, collapsedParentIds, untitledLabel),
    [pagesNotes, pagesSort, collapsedParentIds, untitledLabel]
  )

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes])

  const pagesSelection = useIdBulkSelection(
    useMemo(() => pagesNotes.map((n) => n.id), [pagesNotes]),
    useMemo(() => {
      if (searchActive) return `search:${listSearchQuery.trim()}:${pagesSort}`
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
    }, [navSelection, pagesSort, dateFrom, dateTo, searchActive, listSearchQuery])
  )

  const showSectionLabelsInPages =
    notesSettings.showSectionLabelsInPages ||
    (navSelection.kind === 'sections' && navSelection.scope === 'all')

  const pagesColumnTitle = useMemo(
    () =>
      searchActive
        ? t('notes.shell.searchTitle', { query: listSearchQuery.trim() })
        : navSelectionLabel(navSelection, sections, accounts, t),
    [searchActive, listSearchQuery, navSelection, sections, accounts, t]
  )

  const togglePageCollapse = useCallback((note: UserNoteListItem): void => {
    setCollapsedParentIds(toggleNotesPageTreeCollapsed(note.id))
  }, [])

  const expandParentPage = useCallback((parentId: number): void => {
    const nextCollapsed = readNotesPageTreeCollapsed()
    nextCollapsed.delete(parentId)
    persistNotesPageTreeCollapsed(nextCollapsed)
    setCollapsedParentIds(new Set(nextCollapsed))
  }, [])

  return {
    t,
    notesSettings,
    notes,
    setNotes,
    loading,
    sections,
    load,
    loadSections,
    applyNotePatch,
    onSectionsChanged,
    dateFrom,
    dateTo,
    miniMonth,
    setDateFrom,
    setDateTo,
    setMiniMonth,
    selectedRange,
    dateRangeLabel,
    applyNotesMiniCalendarRange,
    clearNotesDateRange,
    listMode,
    setListMode,
    navSelection,
    setNavSelection,
    pagesSort,
    setPagesSort,
    collapsedParentIds,
    pageRows,
    pagesNotes,
    pagesSelection,
    notesById,
    showSectionLabelsInPages,
    pagesColumnTitle,
    categoryColorByName,
    togglePageCollapse,
    expandParentPage,
    listSearchQuery,
    searchActive,
    clearListSearch
  }
}
