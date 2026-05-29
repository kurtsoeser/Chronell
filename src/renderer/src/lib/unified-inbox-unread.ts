import type { MailFolder, MailListItem } from '@shared/types'
import type { MailListKind } from '@/stores/mail-store-types'

/**
 * Badge fuer „Alle Posteingänge“: im Unified-Inbox-View an geladene Liste koppeln,
 * sonst an dieselbe DB-Zaehlung wie die Unified-Inbox-Abfrage.
 */
export function computeUnifiedInboxUnreadBadge(input: {
  foldersByAccount: Record<string, MailFolder[]>
  messages: MailListItem[]
  listKind: MailListKind
  loading: boolean
  dbUnreadCount: number | null
}): number {
  if (input.listKind === 'unified_inbox' && !input.loading) {
    return input.messages.filter((m) => !m.isRead).length
  }
  if (input.dbUnreadCount != null) {
    return input.dbUnreadCount
  }
  return Object.values(input.foldersByAccount)
    .flat()
    .filter((f) => f.wellKnown === 'inbox')
    .reduce((sum, f) => sum + (f.unreadCount ?? 0), 0)
}
