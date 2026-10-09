import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Layers, MessageCircle, MessageSquare, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import { useAccountsStore } from '@/stores/accounts'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconButtonClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderShellBarClass
} from '@/components/ModuleColumnHeader'
import { TeamsChatPanel } from './TeamsChatPanel'
import {
  persistChatActiveMessengerRailId,
  parseChatMessengerRailId,
  resolveDefaultChatMessengerRailId,
  teamsChatAccountOptionLabel,
  teamsMessengerRailId,
  UNIFIED_TEAMS_MESSENGER_RAIL_ID,
  type ChatMessengerRailId
} from './teams-chat-helpers'
import { GLOBAL_CREATE_EVENT, useGlobalCreateNavigateStore } from '@/lib/global-create'
import { openExternalUrl } from '@/lib/open-external'

const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/'
/** Reduziert "Browser wird nicht unterstuetzt"-Hinweise gegueber dem Standard-Electron-UA. */
const CHROME_LIKE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

type WebviewEl = HTMLElement & {
  reload?: () => void
}

function messengerRailButtonClass(active: boolean): string {
  return cn(
    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    active
      ? 'scale-100 ring-2 ring-primary ring-offset-2 ring-offset-background'
      : 'opacity-90 hover:scale-[1.03] hover:opacity-100 hover:ring-2 hover:ring-border hover:ring-offset-2 hover:ring-offset-background'
  )
}

interface Props {
  onOpenAccountDialog?: () => void
}

/**
 * Chat-Modul: eine Messenger-Leiste (Teams pro Konto + WhatsApp), rechts der jeweilige Inhalt.
 */
export function ChatShell({ onOpenAccountDialog }: Props): JSX.Element {
  const webviewRef = useRef<WebviewEl | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const accounts = useAccountsStore((s) => s.accounts)
  const accountDisplayAvatarDataUrls = useAccountsStore((s) => s.accountDisplayAvatarDataUrls)
  const msAccounts = useMemo(() => accounts.filter((a) => a.id.startsWith('ms:')), [accounts])
  const msAccountIds = useMemo(() => msAccounts.map((a) => a.id), [msAccounts])

  const [activeMessengerId, setActiveMessengerId] = useState<ChatMessengerRailId>(() =>
    resolveDefaultChatMessengerRailId(msAccountIds)
  )

  useEffect(() => {
    const parsed = parseChatMessengerRailId(activeMessengerId)
    const valid =
      parsed?.kind === 'whatsapp' ||
      (parsed?.kind === 'teams-unified' && msAccountIds.length >= 2) ||
      (parsed?.kind === 'teams' && msAccountIds.includes(parsed.accountId))
    if (valid) return
    const next = resolveDefaultChatMessengerRailId(msAccountIds)
    setActiveMessengerId(next)
    persistChatActiveMessengerRailId(next)
  }, [activeMessengerId, msAccountIds])

  const selectMessenger = useCallback((id: ChatMessengerRailId): void => {
    setActiveMessengerId(id)
    persistChatActiveMessengerRailId(id)
  }, [])

  const activeParsed = parseChatMessengerRailId(activeMessengerId)
  const isWhatsApp = activeParsed?.kind === 'whatsapp'
  const isUnifiedTeams = activeParsed?.kind === 'teams-unified'
  const teamsAccountId =
    activeParsed?.kind === 'teams' && !isUnifiedTeams ? activeParsed.accountId : null

  const handleTeamsAccountIdChange = useCallback((id: string | null): void => {
    if (id) selectMessenger(teamsMessengerRailId(id))
  }, [selectMessenger])

  const openTeamsNewChat = useCallback((): void => {
    const first = msAccounts[0]?.id
    if (first) selectMessenger(teamsMessengerRailId(first))
    void openExternalUrl('https://teams.microsoft.com/l/chat/0/0').catch((e) => {
      console.warn('[ChatShell] open new Teams chat failed', e)
    })
  }, [msAccounts, selectMessenger])

  useEffect(() => {
    const pending = useGlobalCreateNavigateStore.getState().takePendingAfterNavigate()
    if (pending === 'chat') {
      window.setTimeout((): void => openTeamsNewChat(), 0)
    }
  }, [openTeamsNewChat])

  useEffect(() => {
    function onGlobalCreate(e: Event): void {
      const ce = e as CustomEvent<{ kind?: string }>
      if (ce.detail?.kind !== 'chat') return
      openTeamsNewChat()
    }
    window.addEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
    return (): void => window.removeEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
  }, [openTeamsNewChat])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onFail = (e: Event): void => {
      const ev = e as unknown as { isMainFrame?: boolean; errorDescription?: string }
      if (ev.isMainFrame === false) return
      setLoadError(ev.errorDescription?.trim() || 'Laden fehlgeschlagen')
    }
    const onCrashed = (): void => setLoadError('Webview abgestuerzt')

    wv.addEventListener('did-fail-load', onFail)
    wv.addEventListener('crashed', onCrashed)
    return (): void => {
      wv.removeEventListener('did-fail-load', onFail)
      wv.removeEventListener('crashed', onCrashed)
    }
  }, [])

  const handleReloadWhatsapp = useCallback((): void => {
    setLoadError(null)
    webviewRef.current?.reload?.()
  }, [])

  const messengerRailItems = useMemo(() => {
    const items: { id: ChatMessengerRailId; ariaLabel: string; title: string }[] = msAccounts.map(
      (acc) => {
        const label = teamsChatAccountOptionLabel(acc)
        return {
          id: teamsMessengerRailId(acc.id),
          ariaLabel: `Microsoft Teams — ${label}`,
          title: `Microsoft Teams — ${label}`
        }
      }
    )
    items.push({
      id: 'whatsapp',
      ariaLabel: 'WhatsApp Web',
      title: 'WhatsApp Web — im eingebetteten Fenster'
    })
    return items
  }, [msAccounts])

  return (
    <main
      className="flex min-h-0 flex-1 flex-row bg-background"
      aria-label="Chat-Modul"
    >
      <nav
        className="flex w-[56px] shrink-0 flex-col border-r border-border bg-card/90 py-3"
        aria-label="Messenger"
      >
        <div className="flex flex-1 flex-col items-center gap-2.5 overflow-y-auto px-2">
          {msAccounts.length >= 2 && (
            <button
              type="button"
              onClick={(): void => selectMessenger(UNIFIED_TEAMS_MESSENGER_RAIL_ID)}
              title="Microsoft Teams — alle Konten (gemeinsame Chatliste)"
              aria-label="Microsoft Teams — alle Konten"
              aria-current={activeMessengerId === UNIFIED_TEAMS_MESSENGER_RAIL_ID ? 'page' : undefined}
              className={cn(
                messengerRailButtonClass(activeMessengerId === UNIFIED_TEAMS_MESSENGER_RAIL_ID),
                'bg-[#6264A7] text-white shadow-md shadow-[#6264A7]/25'
              )}
            >
              <Layers className="h-[22px] w-[22px]" aria-hidden />
              <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex -space-x-1">
                {msAccounts.slice(0, 3).map((acc, index) => (
                  <AccountAvatarBadge
                    key={acc.id}
                    account={acc}
                    imageSrc={accountDisplayAvatarDataUrls[acc.id]}
                    size="xs"
                    className={cn('ring-2 ring-[#6264A7]', index === 1 && 'z-[2]', index === 2 && 'z-[3]', index === 0 && 'z-[1]')}
                  />
                ))}
              </span>
            </button>
          )}

          {messengerRailItems.map((item) => {
            const active = item.id === activeMessengerId
            if (item.id === 'whatsapp') {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(): void => selectMessenger('whatsapp')}
                  title={item.title}
                  aria-label={item.ariaLabel}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    messengerRailButtonClass(active),
                    'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20'
                  )}
                >
                  <MessageCircle className="h-[22px] w-[22px]" aria-hidden />
                </button>
              )
            }

            const accountId = item.id.slice('teams:'.length)
            const acc = msAccounts.find((a) => a.id === accountId)
            if (!acc) return null

            return (
              <button
                key={item.id}
                type="button"
                onClick={(): void => selectMessenger(item.id)}
                title={item.title}
                aria-label={item.ariaLabel}
                aria-current={active ? 'page' : undefined}
                className={messengerRailButtonClass(active)}
              >
                <AccountAvatarBadge
                  account={acc}
                  imageSrc={accountDisplayAvatarDataUrls[acc.id]}
                  size="sm"
                  className="h-9 w-9"
                />
                <span
                  className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#6264A7] text-white ring-2 ring-card"
                  aria-hidden
                >
                  <MessageSquare className="h-2.5 w-2.5" />
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isWhatsApp && (
          <header className={moduleColumnHeaderShellBarClass}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground">WhatsApp Web</div>
              <p className="truncate text-[10px] leading-tight text-muted-foreground">
                QR-Code mit dem Handy scannen, um die Sitzung zu koppeln.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <ModuleColumnHeaderIconButton type="button" onClick={handleReloadWhatsapp} title="Neu laden">
                <RefreshCw className={moduleColumnHeaderIconGlyphClass} aria-hidden />
              </ModuleColumnHeaderIconButton>
              <a
                href={WHATSAPP_WEB_URL}
                target="_blank"
                rel="noreferrer"
                title="Im Browser oeffnen"
                className={moduleColumnHeaderIconButtonClass}
              >
                <ExternalLink className={moduleColumnHeaderIconGlyphClass} aria-hidden />
              </a>
            </div>
          </header>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          {!isWhatsApp ? (
            <TeamsChatPanel
              onOpenAccountDialog={onOpenAccountDialog}
              accountId={teamsAccountId}
              onAccountIdChange={handleTeamsAccountIdChange}
              hideAccountSelector
              unifiedInbox={isUnifiedTeams}
            />
          ) : (
            <>
              {loadError != null && (
                <div
                  role="alert"
                  className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {loadError}
                </div>
              )}
              <div className="relative min-h-0 flex-1 bg-muted/20">
                <webview
                  ref={webviewRef}
                  src={WHATSAPP_WEB_URL}
                  partition="persist:mailclient-whatsapp"
                  useragent={CHROME_LIKE_UA}
                  allowpopups
                  webpreferences="contextIsolation=1,nodeIntegration=0,sandbox=1"
                  style={{ width: '100%', height: '100%', display: 'inline-flex' }}
                  className="absolute inset-0"
                />
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
