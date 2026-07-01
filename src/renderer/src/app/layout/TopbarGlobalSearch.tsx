import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  ListTodo,
  Loader2,
  Paperclip,
  Search,
  StickyNote,
  Users,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarEventView,
  GlobalSearchContactHit,
  GlobalSearchNoteHit,
  GlobalSearchResult,
  GlobalSearchTaskHit,
  SearchHit
} from '@shared/types'
import { wellKnownFolderTitle } from '@shared/well-known-folder-title'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { pushRecentSearch } from '@/app/home/dashboard-recent-searches'
import { FOCUS_MAIN_SEARCH_EVENT } from '@/lib/search-focus'
import { useSearchDropdownPortal } from '@/lib/use-search-dropdown-portal'
import { useAccountsStore } from '@/stores/accounts'
import { useAppModeStore } from '@/stores/app-mode'
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import { usePeoplePendingFocusStore } from '@/stores/people-pending-focus'
import { useMailPendingFocusStore } from '@/stores/mail-pending-focus'
import { useTasksPendingFocusStore } from '@/stores/tasks-pending-focus'
import { persistTasksViewSelection } from '@/app/tasks/tasks-view-storage'
import { useIdBulkSelection } from '@/lib/id-bulk-selection'
import { cn } from '@/lib/utils'
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

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelStyle = useSearchDropdownPortal(containerRef, open && query.trim().length >= 2, {
    width: Math.min(420, window.innerWidth - 16),
    align: 'left'
  })

  const folderLabel = useCallback(
    (hit: SearchHit): string => {
      if (!hit.folderName && !hit.folderWellKnown) return `(${t('common.folder')})`
      return wellKnownFolderTitle(hit.folderWellKnown, hit.folderName ?? `(${t('common.folder')})`, t)
    },
    [t]
  )

  const dateLocale = i18n.language.startsWith('de') ? 'de-DE' : 'en-US'
  const accountColorById = new Map(accounts.map((a) => [a.id, a.color] as const))

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
        const res = await window.mailClient.app.globalSearch({ query: q, limitPerKind: 8 })
        setResults(res)
      } catch (e) {
        console.warn('[global-search] failed', e)
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 180)
    return (): void => window.clearTimeout(handle)
  }, [query])

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return (): void => window.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function onFocusSearch(): void {
      setOpen(true)
      window.requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
    window.addEventListener(FOCUS_MAIN_SEARCH_EVENT, onFocusSearch)
    return (): void => window.removeEventListener(FOCUS_MAIN_SEARCH_EVENT, onFocusSearch)
  }, [])

  function closeSearch(): void {
    setOpen(false)
    setQuery('')
    setResults(null)
  }

  function handleSelectMail(hit: SearchHit): void {
    const q = query.trim()
    if (q.length >= 2) pushRecentSearch(q)
    useMailPendingFocusStore.getState().setPendingMessageId(hit.id)
    setAppMode('mail')
    closeSearch()
  }

  function handleSelectNote(note: GlobalSearchNoteHit): void {
    const q = query.trim()
    if (q.length >= 2) pushRecentSearch(q)
    useNotesPendingFocusStore.getState().setPendingNoteId(note.id)
    setAppMode('notes')
    closeSearch()
  }

  function handleSelectCalendar(ev: CalendarEventView): void {
    const q = query.trim()
    if (q.length >= 2) pushRecentSearch(q)
    useCalendarPendingFocusStore.getState().queueFocusEvent(ev)
    setAppMode('calendar')
    closeSearch()
  }

  function handleSelectTask(task: GlobalSearchTaskHit): void {
    const q = query.trim()
    if (q.length >= 2) pushRecentSearch(q)
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
    if (q.length >= 2) pushRecentSearch(q)
    usePeoplePendingFocusStore.getState().setPendingContactId(contact.id)
    setAppMode('people')
    closeSearch()
  }

  function reset(): void {
    setQuery('')
    setResults(null)
    inputRef.current?.focus()
  }

  const showPanel = open && query.trim().length >= 2

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

  const searchSelection = useIdBulkSelection(searchRowKeys, query.trim())

  return (
    <div ref={containerRef} className="relative w-full min-w-0 max-w-[28rem]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e): void => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e): void => {
          if (e.key !== 'Enter') return
          const q = query.trim()
          if (q.length < 2) return
          pushRecentSearch(q)
        }}
        onFocus={(): void => setOpen(true)}
        placeholder={t('topbar.searchPlaceholder')}
        className="glass-input h-8 w-full rounded-sm pl-9 pr-14 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {query && !loading ? (
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
            title={t('topbar.searchClearTitle')}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
        <kbd className="hidden rounded-sm border border-white/10 bg-secondary/50 px-1 text-[9px] text-muted-foreground/80 lg:inline">
          {t('topbar.ctrlK')}
        </kbd>
      </div>

      {showPanel &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label={t('topbar.searchPlaceholder')}
            className="chronell-acrylic-popover glass-animate-in overflow-y-auto text-popover-foreground"
            style={panelStyle}
          >
            {loading && !hasAnyResults(results) ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('topbar.searching')}
              </div>
            ) : null}
            {!loading && !hasAnyResults(results) ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t('topbar.searchNoHits', { query: query.trim() })}
              </div>
            ) : null}

            {results && results.mails.length > 0 ? (
              <SearchSection title={t('topbar.searchSectionMail')}>
                {results.mails.map((hit) => {
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
                        if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
                          handleSelectMail(hit)
                        }
                      }}
                      className={cn(
                        'flex w-full items-start gap-2 border-b border-border/50 px-3 py-1.5 text-left text-xs transition-colors last:border-b-0 hover:bg-secondary/60',
                        bulkSelected && 'bg-primary/10 ring-1 ring-primary/20 ring-inset'
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
                          <span className="flex-1 truncate font-medium text-foreground">
                            {hit.fromName || hit.fromAddr || `(${t('common.unknown')})`}
                          </span>
                          {hit.hasAttachments ? (
                            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                          ) : null}
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                            {date}
                          </span>
                        </div>
                        <div className="truncate text-foreground/80">
                          {hit.subject || t('common.noSubject')}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {folderLabel(hit)} · {hit.snippet ?? ''}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </SearchSection>
            ) : null}

            {results && results.notes.length > 0 ? (
              <SearchSection title={t('topbar.searchSectionNotes')}>
                {results.notes.map((note) => {
                  const rowKey = `note:${note.id}`
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
                      if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
                        handleSelectNote(note)
                      }
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60',
                      bulkSelected && 'bg-primary/10 ring-1 ring-primary/20 ring-inset'
                    )}
                  >
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{note.title}</span>
                  </button>
                  )
                })}
              </SearchSection>
            ) : null}

            {results && results.calendarEvents.length > 0 ? (
              <SearchSection title={t('topbar.searchSectionCalendar')}>
                {results.calendarEvents.map((ev) => {
                  const rowKey = `cal:${ev.id}`
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
                      if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
                        handleSelectCalendar(ev)
                      }
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60',
                      bulkSelected && 'bg-primary/10 ring-1 ring-primary/20 ring-inset'
                    )}
                  >
                    <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{ev.title}</span>
                      {ev.location ? (
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {ev.location}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  )
                })}
              </SearchSection>
            ) : null}

            {results && results.tasks.length > 0 ? (
              <SearchSection title={t('topbar.searchSectionTasks')}>
                {results.tasks.map((task) => {
                  const rowKey = `task:${task.accountId}:${task.listId}:${task.taskId}`
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
                        if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
                          handleSelectTask(task)
                        }
                      }}
                      className={cn(
                        'flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60',
                        bulkSelected && 'bg-primary/10 ring-1 ring-primary/20 ring-inset'
                      )}
                    >
                      <ListTodo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                    </button>
                  )
                })}
              </SearchSection>
            ) : null}

            {results && results.contacts.length > 0 ? (
              <SearchSection title={t('topbar.searchSectionContacts')}>
                {results.contacts.map((c) => {
                  const rowKey = `contact:${c.id}`
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
                        if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
                          handleSelectContact(c)
                        }
                      }}
                      className={cn(
                        'flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60',
                        bulkSelected && 'bg-primary/10 ring-1 ring-primary/20 ring-inset'
                      )}
                    >
                      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {c.displayName || c.primaryEmail || t('common.unknown')}
                        </span>
                        {c.primaryEmail ? (
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {c.primaryEmail}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </SearchSection>
            ) : null}
          </div>,
          document.body
        )}
    </div>
  )
}
