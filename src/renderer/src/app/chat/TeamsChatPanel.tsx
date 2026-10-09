import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PanelRightOpen, RefreshCw, Search, SendHorizonal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderOutlineSmClass,
  moduleColumnHeaderShellBarClass
} from '@/components/ModuleColumnHeader'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import { AccountColorStripe } from '@/components/AccountColorStripe'
import { MAIL_LIST_UNIFIED_INBOX_STRIPE_BAR } from '@/lib/mail-list-ui'
import { useAccountsStore } from '@/stores/accounts'
import type { ConnectedAccount, TeamsChatMessageView, TeamsChatSummary } from '@shared/types'
import { TeamsChatMessageRow, type TeamsChatMessageRowCtx } from './TeamsChatMessageRow'
import {
  chatTitle,
  dayKey,
  formatDay,
  formatTime,
  teamsChatAccountOptionLabel,
  teamsChatSelectionKey,
  titleBucketKey,
  type TeamsChatListEntry,
  type TeamsChatSelection
} from './teams-chat-helpers'
import { useTeamsChatPopoutState } from './use-teams-chat-popout-state'
import { TeamsChatPopoutDock } from './TeamsChatPopoutDock'

interface GraphMe {
  id: string
  displayName?: string
}

type TeamsChatListFilter = 'all' | 'unread' | 'oneOnOne' | 'group' | 'meeting'
type TeamsChatListGroupMode = 'none' | 'by_date' | 'by_title'

const CHAT_LIST_VIEW_STORAGE_KEY = 'mailclient.teamsChat.chatListView'

function loadTeamsChatListPrefs(): { filter: TeamsChatListFilter; groupMode: TeamsChatListGroupMode } {
  try {
    const raw = localStorage.getItem(CHAT_LIST_VIEW_STORAGE_KEY)
    if (!raw) return { filter: 'all', groupMode: 'none' }
    const j = JSON.parse(raw) as { filter?: string; groupMode?: string }
    const filter: TeamsChatListFilter =
      j.filter === 'unread' ||
      j.filter === 'oneOnOne' ||
      j.filter === 'group' ||
      j.filter === 'meeting'
        ? j.filter
        : 'all'
    const groupMode: TeamsChatListGroupMode =
      j.groupMode === 'by_date' || j.groupMode === 'by_title' ? j.groupMode : 'none'
    return { filter, groupMode }
  } catch {
    return { filter: 'all', groupMode: 'none' }
  }
}

function chatMatchesListFilter(c: TeamsChatSummary, f: TeamsChatListFilter): boolean {
  if (f === 'all') return true
  if (f === 'unread') return c.hasUnread === true
  const t = (c.chatType ?? '').toLowerCase()
  if (f === 'oneOnOne') return t === 'oneonone'
  if (f === 'group') return t === 'group'
  if (f === 'meeting') return t === 'meeting'
  return true
}

function sortChatsByLastActivityDesc<T extends TeamsChatSummary>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const tb = b.lastUpdatedDateTime ? Date.parse(b.lastUpdatedDateTime) : 0
    const ta = a.lastUpdatedDateTime ? Date.parse(a.lastUpdatedDateTime) : 0
    return tb - ta
  })
}

function buildChatListDateGroups<T extends TeamsChatSummary>(chats: T[]): {
  dayKey: string
  dayLabel: string
  items: T[]
}[] {
  const byDay = new Map<string, T[]>()
  const keys: string[] = []
  for (const c of chats) {
    const dk = dayKey(c.lastUpdatedDateTime ?? '') || '_nodate'
    if (!byDay.has(dk)) {
      keys.push(dk)
      byDay.set(dk, [])
    }
    byDay.get(dk)!.push(c)
  }
  keys.sort((a, b) => {
    if (a === '_nodate') return 1
    if (b === '_nodate') return -1
    const ta = Date.parse(byDay.get(a)![0]?.lastUpdatedDateTime ?? '') || 0
    const tb = Date.parse(byDay.get(b)![0]?.lastUpdatedDateTime ?? '') || 0
    return tb - ta
  })
  return keys.map((dk) => {
    const items = sortChatsByLastActivityDesc(byDay.get(dk)!)
    const label = dk === '_nodate' ? 'Ohne Datum' : formatDay(items[0]?.lastUpdatedDateTime ?? '')
    return { dayKey: dk, dayLabel: label, items }
  })
}

function buildChatListTitleGroups<T extends TeamsChatSummary>(chats: T[]): {
  bucket: string
  items: T[]
}[] {
  const byBucket = new Map<string, T[]>()
  for (const c of chats) {
    const k = titleBucketKey(c)
    if (!byBucket.has(k)) byBucket.set(k, [])
    byBucket.get(k)!.push(c)
  }
  const keys = [...byBucket.keys()].sort((a, b) => {
    const order = (x: string): number => {
      if (x === '#') return 2
      if (x === '0–9') return 1
      return 0
    }
    const oa = order(a)
    const ob = order(b)
    if (oa !== ob) return oa - ob
    if (a === '0–9' && b === '0–9') return 0
    return a.localeCompare(b, 'de', { sensitivity: 'base' })
  })
  return keys.map((bucket) => ({
    bucket,
    items: [...(byBucket.get(bucket) ?? [])].sort((x, y) =>
      chatTitle(x).localeCompare(chatTitle(y), 'de', { sensitivity: 'base' })
    )
  }))
}

function TeamsChatListRow({
  c,
  active,
  poppedOut,
  accountBadge,
  accountBadgeTitle,
  accountBadgeImageSrc,
  showAccountColorStripe,
  onSelect
}: {
  c: TeamsChatSummary
  active: boolean
  poppedOut?: boolean
  accountBadge?: ConnectedAccount
  accountBadgeTitle?: string
  accountBadgeImageSrc?: string
  showAccountColorStripe?: boolean
  onSelect: () => void
}): JSX.Element {
  const showStripe = showAccountColorStripe === true && accountBadge != null
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        title={accountBadgeTitle}
        className={cn(
          'relative flex w-full flex-col items-start gap-0.5 overflow-hidden border-b border-border/60 py-2 text-left text-xs transition-colors',
          showStripe ? 'pl-3.5 pr-3' : 'px-3',
          active ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/50',
          poppedOut && !active && 'opacity-80'
        )}
      >
        {showStripe && (
          <AccountColorStripe color={accountBadge.color} className={MAIL_LIST_UNIFIED_INBOX_STRIPE_BAR} />
        )}
        <span className="flex w-full items-start gap-1.5">
          {accountBadge != null && (
            <AccountAvatarBadge
              account={accountBadge}
              imageSrc={accountBadgeImageSrc}
              size="xs"
              className="mt-0.5 shrink-0"
              title={accountBadgeTitle}
            />
          )}
          <span
            className={cn(
              'line-clamp-2 min-w-0 flex-1',
              c.hasUnread ? 'font-semibold text-foreground' : 'font-medium'
            )}
          >
            {chatTitle(c)}
          </span>
          {c.hasUnread && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/40"
              title="Ungelesene Nachrichten"
              aria-label="Ungelesen"
            />
          )}
          {poppedOut && (
            <span title="In eigenem Fenster geoeffnet" aria-hidden>
              <PanelRightOpen className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            </span>
          )}
        </span>
        {c.lastMessagePreviewSnippet?.trim() && (
          <span
            className={cn(
              'line-clamp-1 text-[10px]',
              accountBadge != null && 'pl-6',
              c.hasUnread ? 'text-foreground/80' : 'text-muted-foreground'
            )}
          >
            {c.lastMessagePreviewSnippet}
          </span>
        )}
        {c.lastUpdatedDateTime != null && (
          <span className={cn('text-[10px] text-muted-foreground', accountBadge != null && 'pl-6')}>
            {formatDay(c.lastUpdatedDateTime)} · {formatTime(c.lastUpdatedDateTime)}
          </span>
        )}
      </button>
    </li>
  )
}

interface Props {
  onOpenAccountDialog?: () => void
  accountId?: string | null
  onAccountIdChange?: (accountId: string | null) => void
  /** Konto nur in der Messenger-Leiste waehlen (kein Dropdown im Kopf). */
  hideAccountSelector?: boolean
  /** Chats aller Microsoft-Konten in einer Liste. */
  unifiedInbox?: boolean
}

/**
 * Microsoft Teams: persoenliche Chats ueber Graph (`Chat.ReadWrite`, `Chat.Create`, /me/chats).
 */
export function TeamsChatPanel({
  onOpenAccountDialog,
  accountId: accountIdProp,
  onAccountIdChange,
  hideAccountSelector = false,
  unifiedInbox = false
}: Props): JSX.Element {
  const accounts = useAccountsStore((s) => s.accounts)
  const accountDisplayAvatarDataUrls = useAccountsStore((s) => s.accountDisplayAvatarDataUrls)
  const msAccounts = useMemo(() => accounts.filter((a) => a.id.startsWith('ms:')), [accounts])

  const [internalAccountId, setInternalAccountId] = useState<string | null>(null)
  const accountIdControlled = accountIdProp !== undefined
  const accountId = accountIdControlled ? accountIdProp : internalAccountId

  const setAccountId = useCallback(
    (id: string | null): void => {
      onAccountIdChange?.(id)
      if (!accountIdControlled) setInternalAccountId(id)
    },
    [accountIdControlled, onAccountIdChange]
  )

  useEffect(() => {
    if (unifiedInbox) return
    if (accountId != null && msAccounts.some((a) => a.id === accountId)) return
    setAccountId(msAccounts[0]?.id ?? null)
  }, [unifiedInbox, msAccounts, accountId, setAccountId])

  const currentAccount = useMemo(
    () => (accountId != null ? msAccounts.find((a) => a.id === accountId) : undefined),
    [accountId, msAccounts]
  )

  const [selectedChat, setSelectedChat] = useState<TeamsChatSelection | null>(null)
  const activeMessageAccountId = unifiedInbox ? selectedChat?.accountId ?? null : accountId
  const activeChatId = selectedChat?.chatId ?? null

  const [myGraphUserId, setMyGraphUserId] = useState<string | null>(null)
  useEffect(() => {
    if (!activeMessageAccountId) {
      setMyGraphUserId(null)
      return
    }
    let cancelled = false
    void (async (): Promise<void> => {
      try {
        const me = (await window.mailClient.graph.getMe(activeMessageAccountId)) as GraphMe
        if (!cancelled && me?.id) setMyGraphUserId(me.id)
      } catch {
        if (!cancelled) setMyGraphUserId(null)
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [activeMessageAccountId])

  const [chats, setChats] = useState<TeamsChatListEntry[]>([])
  const [chatsLoading, setChatsLoading] = useState(false)
  const [chatsError, setChatsError] = useState<string | null>(null)

  const inboxScopeKey = unifiedInbox ? '__unified__' : (accountId ?? '')
  const lastInboxScopeKeyRef = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    if (lastInboxScopeKeyRef.current === undefined) {
      lastInboxScopeKeyRef.current = inboxScopeKey
      return
    }
    if (lastInboxScopeKeyRef.current === inboxScopeKey) return
    lastInboxScopeKeyRef.current = inboxScopeKey
    setChats([])
    setSelectedChat(null)
    setMessages([])
    setMessagesError(null)
    setChatsError(null)
  }, [inboxScopeKey])

  const [messages, setMessages] = useState<TeamsChatMessageView[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [chatSidebarFilter, setChatSidebarFilter] = useState('')
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const initialChatListPrefsRef = useRef(loadTeamsChatListPrefs())
  const [chatListFilter, setChatListFilter] = useState<TeamsChatListFilter>(
    () => initialChatListPrefsRef.current.filter
  )
  const [chatListGroupMode, setChatListGroupMode] = useState<TeamsChatListGroupMode>(
    () => initialChatListPrefsRef.current.groupMode
  )

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inboxScopeKeyRef = useRef(inboxScopeKey)
  const messageContextRef = useRef<TeamsChatSelection | null>(null)
  inboxScopeKeyRef.current = inboxScopeKey
  messageContextRef.current =
    activeMessageAccountId && activeChatId
      ? { accountId: activeMessageAccountId, chatId: activeChatId }
      : null

  const loadChats = useCallback(async (): Promise<void> => {
    if (!unifiedInbox && !accountId) {
      setChats([])
      return
    }
    if (unifiedInbox && msAccounts.length === 0) {
      setChats([])
      return
    }
    const reqScope = inboxScopeKey
    setChatsLoading(true)
    setChatsError(null)
    try {
      let merged: TeamsChatListEntry[] = []
      if (unifiedInbox) {
        const parts = await Promise.all(
          msAccounts.map(async (acc) => {
            try {
              const list = await window.mailClient.graph.listTeamsChats(acc.id)
              return list.map((c) => ({ ...c, accountId: acc.id }))
            } catch {
              return [] as TeamsChatListEntry[]
            }
          })
        )
        merged = sortChatsByLastActivityDesc(parts.flat())
      } else {
        const list = await window.mailClient.graph.listTeamsChats(accountId!)
        merged = list.map((c) => ({ ...c, accountId: accountId! }))
      }
      if (reqScope !== inboxScopeKeyRef.current) return
      setChats(merged)
      setSelectedChat((prev) => {
        if (prev && merged.some((c) => c.accountId === prev.accountId && c.id === prev.chatId)) {
          return prev
        }
        const first = merged[0]
        return first ? { accountId: first.accountId, chatId: first.id } : null
      })
    } catch (e) {
      if (reqScope !== inboxScopeKeyRef.current) return
      setChatsError(e instanceof Error ? e.message : String(e))
      setChats([])
      setSelectedChat(null)
    } finally {
      if (reqScope === inboxScopeKeyRef.current) setChatsLoading(false)
    }
  }, [accountId, unifiedInbox, msAccounts, inboxScopeKey])

  useEffect(() => {
    void loadChats()
  }, [loadChats])

  const loadMessages = useCallback(async (): Promise<void> => {
    if (!activeMessageAccountId || !activeChatId) {
      setMessages([])
      setMessagesError(null)
      return
    }
    const req: TeamsChatSelection = { accountId: activeMessageAccountId, chatId: activeChatId }
    setMessagesLoading(true)
    setMessagesError(null)
    try {
      const list = await window.mailClient.graph.listTeamsChatMessages({
        accountId: req.accountId,
        chatId: req.chatId,
        limit: 50
      })
      const cur = messageContextRef.current
      if (!cur || teamsChatSelectionKey(cur) !== teamsChatSelectionKey(req)) return
      setMessages(list)
      void window.mailClient.graph
        .markTeamsChatReadForUser({ accountId: req.accountId, chatId: req.chatId })
        .then((): void => {
          setChats((prev) =>
            prev.map((row) =>
              row.accountId === req.accountId && row.id === req.chatId
                ? { ...row, hasUnread: false }
                : row
            )
          )
        })
        .catch(() => {
          /* Graph-Fehler: Anzeige bleibt, naechster Refresh korrigiert */
        })
    } catch (e) {
      const cur = messageContextRef.current
      if (!cur || teamsChatSelectionKey(cur) !== teamsChatSelectionKey(req)) return
      setMessagesError(e instanceof Error ? e.message : String(e))
      setMessages([])
    } finally {
      const cur = messageContextRef.current
      if (cur && teamsChatSelectionKey(cur) === teamsChatSelectionKey(req)) {
        setMessagesLoading(false)
      }
    }
  }, [activeMessageAccountId, activeChatId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    try {
      localStorage.setItem(
        CHAT_LIST_VIEW_STORAGE_KEY,
        JSON.stringify({ filter: chatListFilter, groupMode: chatListGroupMode })
      )
    } catch {
      /* Quota oder Private Mode */
    }
  }, [chatListFilter, chatListGroupMode])

  async function handleRenewConsent(): Promise<void> {
    const renewId = activeMessageAccountId ?? accountId
    if (!renewId) return
    try {
      await window.mailClient.auth.refreshMicrosoft(renewId)
      await loadChats()
      await loadMessages()
    } catch (e) {
      setChatsError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSend = useCallback(async (): Promise<void> => {
    if (!activeMessageAccountId || !activeChatId || sending) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setMessagesError(null)
    try {
      await window.mailClient.graph.sendTeamsChatMessage({
        accountId: activeMessageAccountId,
        chatId: activeChatId,
        text
      })
      setDraft('')
      await loadMessages()
    } catch (e) {
      setMessagesError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }, [activeMessageAccountId, activeChatId, draft, sending, loadMessages])

  const messageAccount = useMemo(
    () =>
      activeMessageAccountId != null
        ? msAccounts.find((a) => a.id === activeMessageAccountId)
        : currentAccount,
    [activeMessageAccountId, currentAccount, msAccounts]
  )

  const rowAccountLabel = unifiedInbox
    ? `Alle Konten (${msAccounts.length})`
    : currentAccount != null
      ? teamsChatAccountOptionLabel(currentAccount)
      : ''

  const msgAccountLabel =
    messageAccount != null ? teamsChatAccountOptionLabel(messageAccount) : rowAccountLabel

  const chatsMatchingSearch = useMemo(() => {
    const needle = chatSidebarFilter.trim().toLowerCase()
    if (!needle) return chats
    return chats.filter((c) => chatTitle(c).toLowerCase().includes(needle))
  }, [chats, chatSidebarFilter])

  const chatsMatchingListFilter = useMemo(
    () => chatsMatchingSearch.filter((c) => chatMatchesListFilter(c, chatListFilter)),
    [chatsMatchingSearch, chatListFilter]
  )

  const chatsSortedForList = useMemo(
    () => sortChatsByLastActivityDesc(chatsMatchingListFilter),
    [chatsMatchingListFilter]
  )

  const chatListDateSections = useMemo(
    () => buildChatListDateGroups(chatsSortedForList),
    [chatsSortedForList]
  )

  const chatListTitleSections = useMemo(
    () => buildChatListTitleGroups(chatsSortedForList),
    [chatsSortedForList]
  )

  const displayedMessages = useMemo(() => {
    const needle = messageSearchQuery.trim().toLowerCase()
    if (!needle) return messages
    return messages.filter((m) => {
      const body = (m.bodyPreview ?? '').toLowerCase()
      const who = (m.fromDisplayName ?? '').toLowerCase()
      return body.includes(needle) || who.includes(needle)
    })
  }, [messages, messageSearchQuery])

  const { isPoppedOut, openPopouts, openPopout, closePopout, closeAllPopouts, focusPopout } =
    useTeamsChatPopoutState()

  const msgRowCtx = useMemo<TeamsChatMessageRowCtx>(
    () => ({ myGraphUserId, accountLabel: msgAccountLabel }),
    [myGraphUserId, msgAccountLabel]
  )

  const currentChatPoppedOut = isPoppedOut(activeMessageAccountId, activeChatId)

  const renderChatListRow = (c: TeamsChatListEntry): JSX.Element => {
    const acc = unifiedInbox ? msAccounts.find((a) => a.id === c.accountId) : undefined
    const active =
      selectedChat != null && selectedChat.accountId === c.accountId && selectedChat.chatId === c.id
    return (
      <TeamsChatListRow
        key={teamsChatSelectionKey({ accountId: c.accountId, chatId: c.id })}
        c={c}
        active={active}
        poppedOut={isPoppedOut(c.accountId, c.id)}
        accountBadge={acc}
        accountBadgeTitle={acc != null ? teamsChatAccountOptionLabel(acc) : undefined}
        accountBadgeImageSrc={acc != null ? accountDisplayAvatarDataUrls[acc.id] : undefined}
        showAccountColorStripe={unifiedInbox}
        onSelect={(): void => setSelectedChat({ accountId: c.accountId, chatId: c.id })}
      />
    )
  }

  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [displayedMessages, activeChatId, messageSearchQuery])

  if (msAccounts.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Fuer Microsoft Teams wird ein <strong className="text-foreground">Microsoft 365</strong>-Konto
          benoetigt (dieselbe Anmeldung wie fuer Mail). In der Azure-App muss die Berechtigung{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">Chat.ReadWrite</code> und{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">Chat.Create</code> (delegiert) freigegeben
          sein.
        </p>
        {onOpenAccountDialog != null && (
          <button
            type="button"
            onClick={onOpenAccountDialog}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Konto hinzufuegen
          </button>
        )}
      </div>
    )
  }

  const selectedChatEntry =
    selectedChat != null
      ? chats.find((x) => x.accountId === selectedChat.accountId && x.id === selectedChat.chatId)
      : undefined
  const accountLabel = rowAccountLabel

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn(moduleColumnHeaderShellBarClass, 'flex-wrap')}>
        {hideAccountSelector ? (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">Microsoft Teams</div>
            <p className="truncate text-[10px] text-muted-foreground">
              {accountLabel}
              {unifiedInbox && selectedChatEntry != null && messageAccount != null
                ? ` · ${teamsChatAccountOptionLabel(messageAccount)}`
                : null}
            </p>
          </div>
        ) : (
          <label className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
            <span className="shrink-0">Konto</span>
            <select
              className="min-w-0 max-w-[min(100%,320px)] flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              value={accountId ?? ''}
              onChange={(e): void => {
                setAccountId(e.target.value || null)
              }}
            >
              {msAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {teamsChatAccountOptionLabel(a)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={(): void => {
              void loadChats()
              void loadMessages()
            }}
            disabled={chatsLoading || messagesLoading}
            className={cn(moduleColumnHeaderOutlineSmClass, 'disabled:opacity-50')}
            title="Chats neu laden"
          >
            <RefreshCw className={cn(moduleColumnHeaderIconGlyphClass, chatsLoading && 'animate-spin')} aria-hidden />
            Aktualisieren
          </button>
          <button
            type="button"
            onClick={(): void => void handleRenewConsent()}
            className={moduleColumnHeaderOutlineSmClass}
            title="Microsoft-Zustimmung erneuern (z. B. neue Chat-Scopes)"
          >
            Zustimmung
          </button>
        </div>
      </div>

      {(chatsError != null || messagesError != null) && (
        <div
          role="alert"
          className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {chatsError != null && <p>{chatsError}</p>}
          {messagesError != null && <p>{messagesError}</p>}
          <p className="mt-1 text-destructive/90">
            Tritt <code className="rounded bg-muted/80 px-1">interaction_required</code> oder 403 auf,
            &quot;Zustimmung&quot; waehlen oder in den Kontoeinstellungen das Microsoft-Konto aktualisieren.
          </p>
        </div>
      )}

      <TeamsChatPopoutDock
        accountId={activeMessageAccountId}
        selectedChatId={activeChatId}
        openPopouts={openPopouts}
        onFocus={(aid, cid): void => {
          void focusPopout(aid, cid)
        }}
        onClose={(aid, cid): void => {
          void closePopout(aid, cid)
        }}
        onCloseAll={(): void => {
          void closeAllPopouts()
        }}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(200px,280px)_1fr] divide-x divide-border">
        <div className="flex min-h-0 flex-col overflow-hidden bg-card/40">
          <div className="shrink-0 border-b border-border px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {unifiedInbox ? 'Chats — alle Konten' : 'Chats'}
          </div>
          <div className="shrink-0 space-y-2 border-b border-border/80 px-2 py-1.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={chatSidebarFilter}
                onChange={(e): void => setChatSidebarFilter(e.target.value)}
                placeholder="Chats durchsuchen …"
                className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Chats durchsuchen"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="shrink-0">Filter</span>
                <select
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-1 py-0.5 text-[10px] text-foreground"
                  value={chatListFilter}
                  onChange={(e): void => setChatListFilter(e.target.value as TeamsChatListFilter)}
                >
                  <option value="all">Alle</option>
                  <option value="unread">Ungelesen</option>
                  <option value="oneOnOne">Direkt</option>
                  <option value="group">Gruppe</option>
                  <option value="meeting">Besprechung</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="shrink-0">Gruppierung</span>
                <select
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-1 py-0.5 text-[10px] text-foreground"
                  value={chatListGroupMode}
                  onChange={(e): void => setChatListGroupMode(e.target.value as TeamsChatListGroupMode)}
                >
                  <option value="none">Keine</option>
                  <option value="by_date">Nach Datum</option>
                  <option value="by_title">Nach Titel (Kontakt A–Z)</option>
                </select>
              </label>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {chatsSortedForList.length} von {chats.length}
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {chatsLoading && chats.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">Laden …</p>
            ) : chats.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">Keine Chats gefunden.</p>
            ) : chatsSortedForList.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">Kein Chat passt zu Suche oder Filter.</p>
            ) : chatListGroupMode === 'none' ? (
              <ul>{chatsSortedForList.map((c) => renderChatListRow(c))}</ul>
            ) : chatListGroupMode === 'by_date' ? (
              <div className="flex flex-col gap-3 pb-2">
                {chatListDateSections.map((sec) => (
                  <section key={sec.dayKey}>
                    <div className="sticky top-0 z-[1] bg-card/95 px-2 py-1 backdrop-blur-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {sec.dayLabel}
                      </span>
                    </div>
                    <ul>{sec.items.map((c) => renderChatListRow(c))}</ul>
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3 pb-2">
                {chatListTitleSections.map((sec) => (
                  <section key={sec.bucket}>
                    <div className="sticky top-0 z-[1] bg-card/95 px-2 py-1 backdrop-blur-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {sec.bucket}
                      </span>
                    </div>
                    <ul>{sec.items.map((c) => renderChatListRow(c))}</ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden bg-background">
          <div className="shrink-0 space-y-2 border-b border-border bg-muted/20 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  {selectedChatEntry != null ? chatTitle(selectedChatEntry) : 'Kein Chat'}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {activeChatId != null
                    ? currentChatPoppedOut
                      ? 'Chat laeuft in einem eigenen Fenster.'
                      : unifiedInbox && messageAccount != null
                        ? `Konto: ${teamsChatAccountOptionLabel(messageAccount)}`
                        : 'Nachrichten ueber Microsoft Graph — unten schreiben und senden.'
                    : 'Waehle links einen Chat.'}
                </p>
              </div>
              {selectedChatEntry != null && activeMessageAccountId != null && activeChatId != null && (
                <ModuleColumnHeaderIconButton
                  type="button"
                  onClick={(): void => {
                    if (currentChatPoppedOut) {
                      void focusPopout(activeMessageAccountId, activeChatId)
                    } else {
                      void openPopout(activeMessageAccountId, activeChatId, chatTitle(selectedChatEntry))
                    }
                  }}
                  title={
                    currentChatPoppedOut
                      ? 'Schwebendes Fenster in den Vordergrund'
                      : 'Chat in eigenes Fenster auslagern'
                  }
                  aria-label={
                    currentChatPoppedOut
                      ? 'Schwebendes Fenster in den Vordergrund'
                      : 'Chat in eigenes Fenster auslagern'
                  }
                >
                  <PanelRightOpen className={moduleColumnHeaderIconGlyphClass} aria-hidden />
                </ModuleColumnHeaderIconButton>
              )}
            </div>
            {activeChatId != null && !currentChatPoppedOut && (
              <div className="relative max-w-md">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={messageSearchQuery}
                  onChange={(e): void => setMessageSearchQuery(e.target.value)}
                  placeholder="In diesem Chat suchen …"
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="In diesem Chat suchen"
                />
                {messageSearchQuery.trim() !== '' && (
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {displayedMessages.length} von {messages.length} Nachrichten
                  </span>
                )}
              </div>
            )}
          </div>

          {currentChatPoppedOut ? (
            <>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                Dieser Chat ist in einem eigenen Fenster geoeffnet und bleibt beim Wechsel in andere Module
                sichtbar.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className={moduleColumnHeaderOutlineSmClass}
                  onClick={(): void => {
                    if (activeMessageAccountId && activeChatId) {
                      void focusPopout(activeMessageAccountId, activeChatId)
                    }
                  }}
                >
                  Fenster anzeigen
                </button>
                <button
                  type="button"
                  className={moduleColumnHeaderOutlineSmClass}
                  onClick={(): void => {
                    if (activeMessageAccountId && activeChatId) {
                      void closePopout(activeMessageAccountId, activeChatId)
                    }
                  }}
                >
                  Zurueck ins Modul
                </button>
              </div>
            </div>
            </>
          ) : (
            <>
          <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/15 to-background px-3 py-3">
            {messagesLoading && messages.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Nachrichten laden …</p>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Keine Nachrichten in diesem Chat.</p>
            ) : displayedMessages.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Keine Nachrichten passen zur Suche.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {displayedMessages.map((m, idx) => (
                  <TeamsChatMessageRow
                    key={m.id}
                    m={m}
                    prev={displayedMessages[idx - 1]}
                    ctx={msgRowCtx}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-card/80 p-2">
            <div className="flex items-end gap-2">
              <textarea
                className={cn(
                  'min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  (!activeChatId || sending) && 'cursor-not-allowed opacity-60'
                )}
                rows={2}
                placeholder={
                  activeChatId != null
                    ? 'Nachricht schreiben … (Umschalt+Enter fuer Zeilenumbruch)'
                    : 'Zuerst einen Chat auswaehlen …'
                }
                value={draft}
                disabled={!activeChatId || sending}
                onChange={(e): void => setDraft(e.target.value)}
                onKeyDown={(e): void => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
              />
              <button
                type="button"
                disabled={!activeChatId || sending || !draft.trim()}
                onClick={(): void => void handleSend()}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity',
                  'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
                )}
                title="Senden"
              >
                <SendHorizonal className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
