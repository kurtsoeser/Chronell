import type { ConnectedAccount, TeamsChatMessageView, TeamsChatSummary } from '@shared/types'

export const TEAMS_CHAT_ACCOUNT_STORAGE_KEY = 'mailclient.teamsChat.selectedAccountId'
export const CHAT_ACTIVE_MESSENGER_STORAGE_KEY = 'mailclient.chat.activeMessenger'

/** Teams-Chats aller Microsoft-Konten in einer Liste. */
export const UNIFIED_TEAMS_MESSENGER_RAIL_ID = 'teams:unified' as const

/** Ein Eintrag in der Messenger-Seitenleiste (Teams-Konto, Unified-Inbox oder WhatsApp). */
export type ChatMessengerRailId = `teams:${string}` | 'whatsapp'

export type TeamsChatListEntry = TeamsChatSummary & { accountId: string }

export type TeamsChatSelection = { accountId: string; chatId: string }

export function teamsChatSelectionKey(sel: TeamsChatSelection): string {
  return `${sel.accountId}::${sel.chatId}`
}

export function isUnifiedTeamsMessengerRailId(id: string | null | undefined): boolean {
  return id?.trim() === UNIFIED_TEAMS_MESSENGER_RAIL_ID
}

export function teamsMessengerRailId(accountId: string): ChatMessengerRailId {
  return `teams:${accountId}`
}

export function parseChatMessengerRailId(
  id: string | null | undefined
):
  | { kind: 'teams-unified' }
  | { kind: 'teams'; accountId: string }
  | { kind: 'whatsapp' }
  | null {
  const raw = id?.trim()
  if (!raw) return null
  if (raw === 'whatsapp') return { kind: 'whatsapp' }
  if (isUnifiedTeamsMessengerRailId(raw)) return { kind: 'teams-unified' }
  if (raw.startsWith('teams:')) {
    const accountId = raw.slice('teams:'.length).trim()
    if (accountId) return { kind: 'teams', accountId }
  }
  return null
}

export function readChatActiveMessengerRailId(): ChatMessengerRailId | null {
  try {
    const raw = localStorage.getItem(CHAT_ACTIVE_MESSENGER_STORAGE_KEY)?.trim()
    const parsed = parseChatMessengerRailId(raw)
    if (parsed?.kind === 'whatsapp') return 'whatsapp'
    if (parsed?.kind === 'teams-unified') return UNIFIED_TEAMS_MESSENGER_RAIL_ID
    if (parsed?.kind === 'teams') return teamsMessengerRailId(parsed.accountId)
  } catch {
    /* ignore */
  }
  const legacyAccount = readTeamsChatSelectedAccountId()
  if (legacyAccount) return teamsMessengerRailId(legacyAccount)
  return null
}

export function persistChatActiveMessengerRailId(id: ChatMessengerRailId | null): void {
  try {
    if (id) {
      localStorage.setItem(CHAT_ACTIVE_MESSENGER_STORAGE_KEY, id)
      const parsed = parseChatMessengerRailId(id)
      if (parsed?.kind === 'teams') persistTeamsChatSelectedAccountId(parsed.accountId)
      if (parsed?.kind === 'teams-unified') {
        /* kein einzelnes Konto */
      }
    } else {
      localStorage.removeItem(CHAT_ACTIVE_MESSENGER_STORAGE_KEY)
    }
  } catch {
    /* Quota oder Private Mode */
  }
}

/** Erster gueltiger Messenger oder WhatsApp, wenn kein Teams-Konto verbunden ist. */
export function resolveDefaultChatMessengerRailId(
  msAccountIds: string[]
): ChatMessengerRailId {
  const stored = readChatActiveMessengerRailId()
  if (stored === 'whatsapp') return 'whatsapp'
  if (stored != null) {
    const parsed = parseChatMessengerRailId(stored)
    if (parsed?.kind === 'teams-unified' && msAccountIds.length >= 2) {
      return UNIFIED_TEAMS_MESSENGER_RAIL_ID
    }
    if (parsed?.kind === 'teams' && msAccountIds.includes(parsed.accountId)) {
      return teamsMessengerRailId(parsed.accountId)
    }
  }
  if (msAccountIds.length >= 2) return UNIFIED_TEAMS_MESSENGER_RAIL_ID
  if (msAccountIds[0]) return teamsMessengerRailId(msAccountIds[0])
  return 'whatsapp'
}

export function readTeamsChatSelectedAccountId(): string | null {
  try {
    const raw = localStorage.getItem(TEAMS_CHAT_ACCOUNT_STORAGE_KEY)
    return raw?.trim() || null
  } catch {
    return null
  }
}

export function persistTeamsChatSelectedAccountId(accountId: string | null): void {
  try {
    if (accountId) localStorage.setItem(TEAMS_CHAT_ACCOUNT_STORAGE_KEY, accountId)
    else localStorage.removeItem(TEAMS_CHAT_ACCOUNT_STORAGE_KEY)
  } catch {
    /* Quota oder Private Mode */
  }
}

/** Dropdown / Tooltip: Name mit E-Mail, wenn unterscheidbar. */
export function teamsChatAccountOptionLabel(
  account: Pick<ConnectedAccount, 'displayName' | 'email'>
): string {
  const name = account.displayName?.trim()
  const email = account.email?.trim()
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} (${email})`
  }
  return name || email || ''
}

export function chatTitle(c: TeamsChatSummary): string {
  const t = c.topic?.trim()
  if (t) return t
  const peer = c.peerDisplayName?.trim()
  if (c.chatType === 'oneOnOne' && peer) return peer
  if (c.chatType === 'oneOnOne') return 'Direktnachricht'
  if (c.chatType === 'group') return 'Gruppenchat'
  if (c.chatType === 'meeting') return 'Besprechungschat'
  return 'Chat'
}

export function formatTime(iso: string): string {
  if (!iso) return ''
  const d = Date.parse(iso)
  if (!Number.isFinite(d)) return ''
  return new Intl.DateTimeFormat('de-DE', { timeStyle: 'short' }).format(d)
}

export function formatDay(iso: string): string {
  if (!iso) return ''
  const d = Date.parse(iso)
  if (!Number.isFinite(d)) return ''
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(d)
}

export function initialsFromName(name: string | null | undefined): string {
  const s = name?.trim() || '?'
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

export function isOwnMessage(
  m: TeamsChatMessageView,
  myGraphUserId: string | null,
  accountDisplayName: string | null
): boolean {
  if (myGraphUserId && m.fromUserId != null && m.fromUserId === myGraphUserId) return true
  if (!m.fromUserId && m.fromDisplayName?.trim() && accountDisplayName?.trim()) {
    return m.fromDisplayName.trim().toLowerCase() === accountDisplayName.trim().toLowerCase()
  }
  return false
}

export function dayKey(iso: string): string {
  if (!iso) return ''
  const d = Date.parse(iso)
  if (!Number.isFinite(d)) return ''
  return new Date(d).toDateString()
}

export function teamsChatPopoutRefKey(accountId: string, chatId: string): string {
  return `${accountId}::${chatId}`
}

/** Gruppierung nach Anzeigetitel (bei 1:1 typischerweise Personenname), A–Z. */
export function titleBucketKey(c: TeamsChatSummary): string {
  const t = chatTitle(c).trim()
  if (!t) return '#'
  const u = t.charAt(0).toLocaleUpperCase('de-DE')
  if (/^[A-ZÄÖÜ]$/.test(u)) return u
  if (/^\d$/.test(u)) return '0–9'
  return '#'
}
