import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  ChevronDown,
  Clock,
  Filter,
  LayoutGrid,
  ListTodo,
  Loader2,
  Mail,
  Paperclip,
  Search,
  StickyNote,
  Users,
  X,
  type LucideProps
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarEventView,
  GlobalSearchContactHit,
  GlobalSearchKind,
  GlobalSearchNoteHit,
  GlobalSearchResult,
  GlobalSearchTaskHit,
  SearchHit
} from '@shared/types'
import { wellKnownFolderTitle } from '@shared/well-known-folder-title'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import {
  pushRecentSearch,
  readRecentSearches
} from '@/app/home/dashboard-recent-searches'
import { FOCUS_MAIN_SEARCH_EVENT } from '@/lib/search-focus'
import { useSearchDropdownPortal } from '@/lib/use-search-dropdown-portal'
import { useAccountsStore } from '@/stores/accounts'
import { useAppModeStore } from '@/stores/app-mode'
import { useCalendarEventSearchStore } from '@/stores/calendar-event-search'
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'
import { useNotesListSearchStore } from '@/stores/notes-list-search'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import { usePeoplePendingFocusStore } from '@/stores/people-pending-focus'
import { useMailPendingFocusStore } from '@/stores/mail-pending-focus'
import { useMailStore } from '@/stores/mail'
import { useTasksListSearchStore } from '@/stores/tasks-list-search'
import { useTasksPendingFocusStore } from '@/stores/tasks-pending-focus'
import { persistTasksViewSelection } from '@/app/tasks/tasks-view-storage'
import { useIdBulkSelection } from '@/lib/id-bulk-selection'
import { cn } from '@/lib/utils'
import {
  draftToAdvancedCriteria,
  emptyAdvancedSearchDraft,
  TopbarAdvancedSearchPanel,
  type AdvancedSearchDraft
} from '@/app/layout/TopbarAdvancedSearchPanel'

type SearchResultTab = 'all' | GlobalSearchKind

function hasAnyResults(result: GlobalSearchResult | null): boolean {
  if (!result) return false
  return (
    result.mails.length > 0 ||
    result.notes.length > 0 ||
    result.calendarEvents.length > 0 ||
    result.tasks.length > 0 ||
    result.contacts.length > 0
  )
}

function countForTab(result: GlobalSearchResult | null, tab: SearchResultTab): number {
  if (!result) return 0
  if (tab === 'all') {
    return (
      result.mails.length +
      result.notes.length +
      result.calendarEvents.length +
      result.tasks.length +
      result.contacts.length
    )
  }
  if (tab === 'mails') return result.mails.length
  if (tab === 'notes') return result.notes.length
  if (tab === 'calendarEvents') return result.calendarEvents.length
  if (tab === 'tasks') return result.tasks.length
  return result.contacts.length
}

function SearchSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): JSX.Element | null {
  if (!children) return null
  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  )
}

export function TopbarGlobalSearch(): JSX.Element {
  const { t, i18n } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const setAppMode = useAppModeStore((s) => s.setMode)
  const appMode = useAppModeStore((s) => s.mode)
  const mailListKind = useMailStore((s) => s.listKind)
  const mailSearchQuery = useMailStore((s) => s.mailSearchQuery)
  const selectSearchView = useMailStore((s) => s.selectSearchView)
  const selectAdvancedSearchView = useMailStore((s) => s.selectAdvancedSearchView)
  const clearMailSearch = useMailStore((s) => s.clearMailSearch)
  const calendarSearchQuery = useCalendarEventSearchStore((s) => s.query)
  const setCalendarSearchQuery = useCalendarEventSearchStore((s) => s.setQuery)
  const clearCalendarSearch = useCalendarEventSearchStore((s) => s.clear)
  const notesSearchQuery = useNotesListSearchStore((s) => s.query)
  const setNotesSearchQuery = useNotesListSearchStore((s) => s.setQuery)
  const clearNotesSearch = useNotesListSearchStore((s) => s.clear)
  const tasksSearchQuery = useTasksListSearchStore((s) => s.query)
  const setTasksSearchQuery = useTasksListSearchStore((s) => s.setQuery)
  const clearTasksSearch = useTasksListSearchStore((s) => s.clear)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  /** Suchfeld ist aufgeklappt (Popover); zugeklappt nur farbiges Icon. */
  const [expanded, setExpanded] = useState(false)
  const [resultTab, setResultTab] = useState<SearchResultTab>('all')
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedDraft, setAdvancedDraft] = useState<AdvancedSearchDraft>(() => emptyAdvancedSearchDraft())
  const [recents, setRecents] = useState<string[]>(() => readRecentSearches())

  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelStyle = useSearchDropdownPortal(containerRef, expanded, {
    width: Math.min(520, window.innerWidth - 16),
    align: 'right'
  })

  const filterActive = Boolean(
    query.trim() ||
      (appMode === 'mail' && mailListKind === 'search') ||
      (appMode === 'calendar' && calendarSearchQuery.trim()) ||
      (appMode === 'notes' && notesSearchQuery.trim()) ||
      (appMode === 'tasks' && tasksSearchQuery.trim())
  )

  function openExpanded(): void {
    setExpanded(true)
    setRecents(readRecentSearches())
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  function collapseExpanded(): void {
    if (advancedOpen) return
    setExpanded(false)
    setScopeMenuOpen(false)
  }
  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    if (appMode === 'mail' && mailListKind === 'search' && mailSearchQuery) {
      setQuery(mailSearchQuery)
      return
    }
    if (appMode === 'calendar' && calendarSearchQuery.trim()) {
      setQuery(calendarSearchQuery)
      return
    }
    if (appMode === 'notes' && notesSearchQuery.trim()) {
      setQuery(notesSearchQuery)
      return
    }
    if (appMode === 'tasks' && tasksSearchQuery.trim()) {
      setQuery(tasksSearchQuery)
    }
  }, [
    appMode,
    mailListKind,
    mailSearchQuery,
    calendarSearchQuery,
    notesSearchQuery,
    tasksSearchQuery
  ])

  const folderLabel = useCallback(
    (hit: SearchHit): string => {
      if (!hit.folderName && !hit.folderWellKnown) return `(${t('common.folder')})`
      return wellKnownFolderTitle(hit.folderWellKnown, hit.folderName ?? `(${t('common.folder')})`, t)
    },
    [t]
  )

  const dateLocale = i18n.language.startsWith('de') ? 'de-DE' : 'en-US'
  const accountColorById = new Map(accounts.map((a) => [a.id, a.color] as const))

  const apiKinds = useMemo((): GlobalSearchKind[] | undefined => {
    if (resultTab === 'all') return undefined
    return [resultTab]
  }, [resultTab])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const handle = window.setTimeout(async () => {
      try {
        const limitPerKind = resultTab === 'all' ? 8 : 24
        const res = await window.mailClient.app.globalSearch({
          query: q,
          limitPerKind,
          kinds: apiKinds
        })
        setResults(res)
      } catch (e) {
        console.warn('[global-search] failed', e)
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 180)
    return (): void => window.clearTimeout(handle)
  }, [query, apiKinds, resultTab])

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      collapseExpanded()
    }
    window.addEventListener('mousedown', onDown)
    return (): void => window.removeEventListener('mousedown', onDown)
  }, [advancedOpen])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openExpanded()
      } else if (e.key === 'Escape' && expanded) {
        e.preventDefault()
        if (scopeMenuOpen) {
          setScopeMenuOpen(false)
          return
        }
        collapseExpanded()
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [expanded, scopeMenuOpen, advancedOpen])

  useEffect(() => {
    function onFocusSearch(): void {
      openExpanded()
    }
    window.addEventListener(FOCUS_MAIN_SEARCH_EVENT, onFocusSearch)
    return (): void => window.removeEventListener(FOCUS_MAIN_SEARCH_EVENT, onFocusSearch)
  }, [])

  function closeSearch(): void {
    setExpanded(false)
    setScopeMenuOpen(false)
    setQuery('')
    setResults(null)
  }

  function applyViewFilter(q: string): void {
    pushRecentSearch(q)
    setRecents(readRecentSearches())
    if (appMode === 'mail' || resultTab === 'mails') {
      void selectSearchView(q)
      setAppMode('mail')
      setExpanded(false)
      inputRef.current?.blur()
      return
    }
    if (appMode === 'calendar' || resultTab === 'calendarEvents') {
      setCalendarSearchQuery(q)
      setAppMode('calendar')
      setExpanded(false)
      inputRef.current?.blur()
      return
    }
    if (appMode === 'notes' || resultTab === 'notes') {
      setNotesSearchQuery(q)
      setAppMode('notes')
      setExpanded(false)
      inputRef.current?.blur()
      return
    }
    if (appMode === 'tasks' || resultTab === 'tasks') {
      setTasksSearchQuery(q)
      setAppMode('tasks')
      setExpanded(false)
      inputRef.current?.blur()
    }
  }

  function handleSelectMail(hit: SearchHit): void {
    const q = query.trim()
    if (q.length >= 2) {
      pushRecentSearch(q)
      setRecents(readRecentSearches())
    }
    useMailPendingFocusStore.getState().setPendingMessageId(hit.id)
    setAppMode('mail')
    closeSearch()
  }

  function handleSelectNote(note: GlobalSearchNoteHit): void {
    const q = query.trim()
    if (q.length >= 2) {
      pushRecentSearch(q)
      setRecents(readRecentSearches())
    }
    useNotesPendingFocusStore.getState().setPendingNoteId(note.id)
    setAppMode('notes')
    closeSearch()
  }

  function handleSelectCalendar(ev: CalendarEventView): void {
    const q = query.trim()
    if (q.length >= 2) {
      pushRecentSearch(q)
      setRecents(readRecentSearches())
    }
    useCalendarPendingFocusStore.getState().queueFocusEvent(ev)
    setAppMode('calendar')
    closeSearch()
  }

  function handleSelectTask(task: GlobalSearchTaskHit): void {
    const q = query.trim()
    if (q.length >= 2) {
      pushRecentSearch(q)
      setRecents(readRecentSearches())
    }
    useTasksPendingFocusStore.getState().queueTask({
      accountId: task.accountId,
      listId: task.listId,
      taskId: task.taskId
    })
    persistTasksViewSelection({
      kind: 'list',
      accountId: task.accountId,
      listId: task.listId
    })
    setAppMode('tasks')
    closeSearch()
  }

  function handleSelectContact(contact: GlobalSearchContactHit): void {
    const q = query.trim()
    if (q.length >= 2) {
      pushRecentSearch(q)
      setRecents(readRecentSearches())
    }
    usePeoplePendingFocusStore.getState().setPendingContactId(contact.id)
    setAppMode('people')
    closeSearch()
  }

  function reset(): void {
    const mode = useAppModeStore.getState().mode
    if (mode === 'mail' && useMailStore.getState().listKind === 'search') {
      void clearMailSearch()
    }
    if (mode === 'calendar' && useCalendarEventSearchStore.getState().query.trim()) {
      clearCalendarSearch()
    }
    if (mode === 'notes' && useNotesListSearchStore.getState().query.trim()) {
      clearNotesSearch()
    }
    if (mode === 'tasks' && useTasksListSearchStore.getState().query.trim()) {
      clearTasksSearch()
    }
    setQuery('')
    setResults(null)
    setResultTab('all')
    setAdvancedDraft(emptyAdvancedSearchDraft())
    inputRef.current?.focus()
  }

  function runAdvancedSearch(): void {
    const criteria = draftToAdvancedCriteria(advancedDraft)
    const hasAny = Object.keys(criteria).length > 0
    if (!hasAny) return
    const label =
      criteria.keywords ||
      criteria.subjectContains ||
      criteria.fromContains ||
      criteria.toContains ||
      t('topbar.advancedSearchTitle')
    pushRecentSearch(String(label))
    setRecents(readRecentSearches())
    setAppMode('mail')
    void selectAdvancedSearchView(criteria)
    setAdvancedOpen(false)
    setExpanded(false)
    setQuery(String(label))
  }

  const showResults = expanded && query.trim().length >= 2
  const showRecents = expanded && query.trim().length < 2
  const viewFilterHint =
    appMode === 'mail' || resultTab === 'mails'
      ? t('topbar.searchApplyMailHint')
      : appMode === 'calendar' || resultTab === 'calendarEvents'
        ? t('topbar.searchApplyCalendarHint')
        : appMode === 'notes' || resultTab === 'notes'
          ? t('topbar.searchApplyNotesHint')
          : appMode === 'tasks' || resultTab === 'tasks'
            ? t('topbar.searchApplyTasksHint')
            : null

  const searchRowKeys = useMemo((): string[] => {
    if (!results) return []
    const keys: string[] = []
    for (const hit of results.mails) keys.push(`mail:${hit.id}`)
    for (const note of results.notes) keys.push(`note:${note.id}`)
    for (const ev of results.calendarEvents) keys.push(`cal:${ev.id}`)
    for (const task of results.tasks) {
      keys.push(`task:${task.accountId}:${task.listId}:${task.taskId}`)
    }
    for (const c of results.contacts) keys.push(`contact:${c.id}`)
    return keys
  }, [results])

  const searchSelection = useIdBulkSelection(searchRowKeys, `${query.trim()}:${resultTab}`)

  const tabDefs = useMemo(
    (): Array<{ id: SearchResultTab; label: string; Icon: ComponentType<LucideProps> }> => [
      { id: 'all', label: t('topbar.searchTabAll'), Icon: LayoutGrid },
      { id: 'mails', label: t('topbar.searchSectionMail'), Icon: Mail },
      { id: 'notes', label: t('topbar.searchSectionNotes'), Icon: StickyNote },
      { id: 'tasks', label: t('topbar.searchSectionTasks'), Icon: ListTodo },
      { id: 'calendarEvents', label: t('topbar.searchSectionCalendar'), Icon: Calendar },
      { id: 'contacts', label: t('topbar.searchSectionContacts'), Icon: Users }
    ],
    [t]
  )

  const scopeLabel =
    resultTab === 'all'
      ? t('topbar.searchScopeAll')
      : tabDefs.find((x) => x.id === resultTab)?.label ?? t('topbar.searchScopeAll')

  function renderMailHits(): React.ReactNode {
    if (!results || results.mails.length === 0) return null
    return results.mails.map((hit) => {
      const rowKey = `mail:${hit.id}`
      const color = accountColorById.get(hit.accountId)
      const date = hit.receivedAt
        ? new Date(hit.receivedAt).toLocaleDateString(dateLocale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : ''
      const bulkSelected = searchSelection.isSelected(rowKey)
      return (
        <button
          key={rowKey}
          type="button"
          onClick={(e): void => {
            searchSelection.handlePointerDown(rowKey, {
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey
            })
            if (!(e.shiftKey || e.ctrlKey || e.metaKey)) handleSelectMail(hit)
          }}
          className={cn(
            'flex w-full items-start gap-2 border-b border-border/40 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-secondary/50',
            bulkSelected && 'bg-primary/10'
          )}
        >
          {color ? (
            <span
              className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: resolvedAccountColorCss(color) }}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="flex-1 truncate font-medium">
                {hit.fromName || hit.fromAddr || `(${t('common.unknown')})`}
              </span>
              {hit.hasAttachments ? <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{date}</span>
            </div>
            <div className="truncate text-foreground/80">{hit.subject || t('common.noSubject')}</div>
            <div className="truncate text-[10px] text-muted-foreground">
              {folderLabel(hit)} · {hit.snippet ?? ''}
            </div>
          </div>
        </button>
      )
    })
  }

  function renderNoteHits(): React.ReactNode {
    if (!results?.notes.length) return null
    return results.notes.map((note) => (
      <button
        key={`note:${note.id}`}
        type="button"
        onClick={(): void => handleSelectNote(note)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/50"
      >
        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{note.title}</span>
      </button>
    ))
  }

  function renderCalendarHits(): React.ReactNode {
    if (!results?.calendarEvents.length) return null
    return results.calendarEvents.map((ev) => (
      <button
        key={`cal:${ev.id}`}
        type="button"
        onClick={(): void => handleSelectCalendar(ev)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/50"
      >
        <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{ev.title}</span>
          {ev.location ? (
            <span className="block truncate text-[10px] text-muted-foreground">{ev.location}</span>
          ) : null}
        </span>
      </button>
    ))
  }

  function renderTaskHits(): React.ReactNode {
    if (!results?.tasks.length) return null
    return results.tasks.map((task) => (
      <button
        key={`task:${task.accountId}:${task.listId}:${task.taskId}`}
        type="button"
        onClick={(): void => handleSelectTask(task)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/50"
      >
        <ListTodo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      </button>
    ))
  }

  function renderContactHits(): React.ReactNode {
    if (!results?.contacts.length) return null
    return results.contacts.map((c) => (
      <button
        key={`contact:${c.id}`}
        type="button"
        onClick={(): void => handleSelectContact(c)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/50"
      >
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {c.displayName || c.primaryEmail || t('common.unknown')}
          </span>
          {c.primaryEmail ? (
            <span className="block truncate text-[10px] text-muted-foreground">{c.primaryEmail}</span>
          ) : null}
        </span>
      </button>
    ))
  }

  function renderTabBody(): React.ReactNode {
    if (resultTab === 'mails') return renderMailHits()
    if (resultTab === 'notes') return renderNoteHits()
    if (resultTab === 'tasks') return renderTaskHits()
    if (resultTab === 'calendarEvents') return renderCalendarHits()
    if (resultTab === 'contacts') return renderContactHits()
    return (
      <>
        {results && results.mails.length > 0 ? (
          <SearchSection title={t('topbar.searchSectionMail')}>{renderMailHits()}</SearchSection>
        ) : null}
        {results && results.notes.length > 0 ? (
          <SearchSection title={t('topbar.searchSectionNotes')}>{renderNoteHits()}</SearchSection>
        ) : null}
        {results && results.calendarEvents.length > 0 ? (
          <SearchSection title={t('topbar.searchSectionCalendar')}>{renderCalendarHits()}</SearchSection>
        ) : null}
        {results && results.tasks.length > 0 ? (
          <SearchSection title={t('topbar.searchSectionTasks')}>{renderTaskHits()}</SearchSection>
        ) : null}
        {results && results.contacts.length > 0 ? (
          <SearchSection title={t('topbar.searchSectionContacts')}>{renderContactHits()}</SearchSection>
        ) : null}
      </>
    )
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(): void => {
          if (expanded) collapseExpanded()
          else openExpanded()
        }}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          filterActive || expanded
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-primary/15 text-primary hover:bg-primary/25'
        )}
        title={`${t('topbar.searchPlaceholderShort')} (${t('topbar.ctrlK')})`}
        aria-label={t('topbar.searchPlaceholderShort')}
        aria-expanded={expanded}
      >
        <Search className="h-4 w-4" />
        {filterActive && !expanded ? (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary-foreground ring-1 ring-primary" />
        ) : null}
      </button>

      {expanded
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={t('topbar.searchPlaceholder')}
              className="chronell-acrylic-popover glass-animate-in flex flex-col overflow-hidden text-popover-foreground"
              style={panelStyle}
            >
              <div className="flex shrink-0 items-center gap-1 border-b border-border/70 p-2">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(): void => setScopeMenuOpen((o) => !o)}
                    className="inline-flex h-8 max-w-[7.5rem] items-center gap-1 rounded-md border border-border/80 bg-background/80 px-2 text-[11px] font-medium text-foreground hover:bg-secondary/70"
                    aria-expanded={scopeMenuOpen}
                    aria-haspopup="listbox"
                  >
                    <span className="min-w-0 truncate">{scopeLabel}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                  {scopeMenuOpen ? (
                    <div
                      className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-md"
                      role="listbox"
                    >
                      {tabDefs.map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          role="option"
                          aria-selected={resultTab === id}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/70',
                            resultTab === id && 'bg-secondary/50 font-medium'
                          )}
                          onClick={(): void => {
                            setResultTab(id)
                            setScopeMenuOpen(false)
                            inputRef.current?.focus()
                          }}
                        >
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="relative min-w-0 flex-1">
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e): void => setQuery(e.target.value)}
                    onKeyDown={(e): void => {
                      if (e.key !== 'Enter') return
                      const q = query.trim()
                      if (q.length < 2) return
                      e.preventDefault()
                      applyViewFilter(q)
                    }}
                    placeholder={t('topbar.searchPlaceholderShort')}
                    className="h-8 w-full rounded-md border border-border/80 bg-background px-3 pr-16 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                  />
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : null}
                    {query ? (
                      <button
                        type="button"
                        onClick={reset}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title={t('topbar.searchClearTitle')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={(): void => {
                        setAdvancedOpen(true)
                        setExpanded(false)
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title={t('topbar.advancedSearchTitle')}
                      aria-label={t('topbar.advancedSearchTitle')}
                    >
                      <Filter className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(): void => {
                        const q = query.trim()
                        if (q.length >= 2) applyViewFilter(q)
                        else inputRef.current?.focus()
                      }}
                      className="rounded border border-border/70 p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title={t('topbar.searchSubmitTitle')}
                      aria-label={t('topbar.searchSubmitTitle')}
                    >
                      <Search className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-0 overflow-x-auto border-b border-border/70 px-2">
                {tabDefs.map(({ id, label }) => {
                  const count = countForTab(results, id)
                  const active = resultTab === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={(): void => setResultTab(id)}
                      className={cn(
                        'relative shrink-0 px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground',
                        active && 'text-foreground'
                      )}
                    >
                      {label}
                      {showResults ? (
                        <span className="ml-1 text-[10px] tabular-nums opacity-60">{count}</span>
                      ) : null}
                      {active ? (
                        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground" />
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {showRecents ? (
                  <div className="py-1">
                    {recents.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-muted-foreground">
                        {t('topbar.searchRecentsEmpty')}
                      </div>
                    ) : (
                      recents.map((term) => (
                        <button
                          key={term}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/50"
                          onClick={(): void => {
                            setQuery(term)
                            inputRef.current?.focus()
                          }}
                        >
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 truncate">{term}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}

                {showResults ? (
                  <>
                    {loading && !hasAnyResults(results) ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t('topbar.searching')}
                      </div>
                    ) : null}
                    {!loading && countForTab(results, resultTab) === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        {t('topbar.searchNoHits', { query: query.trim() })}
                      </div>
                    ) : null}
                    {viewFilterHint ? (
                      <button
                        type="button"
                        className="w-full border-b border-border/50 px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                        onClick={(): void => applyViewFilter(query.trim())}
                      >
                        {viewFilterHint}
                      </button>
                    ) : null}
                    {renderTabBody()}
                  </>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}

      <TopbarAdvancedSearchPanel
        open={advancedOpen}
        draft={advancedDraft}
        onDraftChange={setAdvancedDraft}
        onClose={(): void => setAdvancedOpen(false)}
        onSearch={runAdvancedSearch}
        onClear={(): void => setAdvancedDraft(emptyAdvancedSearchDraft())}
      />
    </div>
  )
}
