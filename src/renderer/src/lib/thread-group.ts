import type { MailListItem, TodoDueKindList } from '@shared/types'
import { parseOpenTodoDueKind, rankOpenTodoBucket } from '@/lib/todo-due-bucket'
import { pickThreadLatestMessage, pickThreadRootMessage } from '@/lib/thread-display-pick'

export interface ThreadGroup {
  threadKey: string
  accountId: string
  messageCount: number
  unreadCount: number
  hasAttachments: boolean
  isFlagged: boolean
  /** Chronologisch neueste Nachricht (Sortierung, Aktivitaet, Vorschautext). */
  latestMessage: MailListItem
  /**
   * Aelteste Nachricht im Thread — fuer die Kopfzeile wie in Outlook/Windows Mail
   * (Ursprungsabsender und urspruenglicher Betreff), nicht die letzte Antwort.
   */
  rootMessage: MailListItem
  participantNames: string[]
  /**
   * Staerkster offener ToDo-Bucket unter den Mails dieser Liste im Thread
   * (fuer Unified-Inbox / Posteingang mit ToDo-Join).
   */
  openTodoDueKind?: TodoDueKindList | null
}

/**
 * Schluessel fuer Thread-Gruppierung in der Mailliste.
 * Bei `namespaceByAccount` (z. B. „Alle Posteingaenge“) entfaellt Kollision
 * gleicher Graph-Thread-IDs zwischen Konten.
 */
export function threadGroupingKey(msg: MailListItem, namespaceByAccount: boolean): string {
  const base = msg.remoteThreadId ?? `msg:${msg.id}`
  return namespaceByAccount ? `${msg.accountId}\t${base}` : base
}

function isSyntheticSingleMessageKey(threadKey: string, scoped: boolean): boolean {
  if (!scoped) return threadKey.startsWith('msg:')
  const tab = threadKey.indexOf('\t')
  if (tab === -1) return threadKey.startsWith('msg:')
  return threadKey.slice(tab + 1).startsWith('msg:')
}

/**
 * Gruppiert Mails nach conversationId (remoteThreadId). Mails ohne Thread-ID
 * bilden eine eigene Gruppe per Message-ID. Reihenfolge: neueste Mail zuerst.
 *
 * Optional koennen `extraByThread` Mails desselben Threads aus anderen Ordnern
 * (z.B. "Gesendete Elemente") liefern. Sie ergaenzen Zaehler/Teilnehmer und
 * koennen das `latestMessage` aktualisieren, legen aber keine neuen Threads
 * an, fuer die es im aktuellen Ordner keine Mail gibt. `rootMessage` wird dabei
 * auf die chronologisch aelteste Nachricht gesetzt.
 */
type ThreadAccumulator = ThreadGroup & { members: MailListItem[] }

export function groupMessagesIntoThreads(
  messages: MailListItem[],
  extraByThread?: Record<string, MailListItem[]>,
  namespaceThreadKeysByAccount = false
): ThreadGroup[] {
  const groups = new Map<string, ThreadAccumulator>()

  function addToGroup(msg: MailListItem, isFolderMail: boolean): void {
    const threadKey = threadGroupingKey(msg, namespaceThreadKeysByAccount)
    const existing = groups.get(threadKey)

    if (!existing) {
      if (!isFolderMail) return
      groups.set(threadKey, {
        threadKey,
        accountId: msg.accountId,
        messageCount: 1,
        unreadCount: msg.isRead ? 0 : 1,
        hasAttachments: msg.hasAttachments,
        isFlagged: msg.isFlagged,
        latestMessage: msg,
        rootMessage: msg,
        participantNames: [],
        members: [msg]
      })
    } else {
      existing.messageCount += 1
      if (!msg.isRead) existing.unreadCount += 1
      if (msg.hasAttachments) existing.hasAttachments = true
      if (msg.isFlagged) existing.isFlagged = true
      existing.members.push(msg)
    }
  }

  for (const msg of messages) addToGroup(msg, true)

  if (extraByThread) {
    const seenIds = new Set(messages.map((m) => m.id))
    for (const [key, extras] of Object.entries(extraByThread)) {
      if (!groups.has(key)) continue
      for (const e of extras) {
        if (seenIds.has(e.id)) continue
        seenIds.add(e.id)
        addToGroup(e, false)
      }
    }
  }

  const finalized: ThreadGroup[] = []
  for (const acc of groups.values()) {
    const rootMessage = pickThreadRootMessage(acc.members)
    const latestMessage = pickThreadLatestMessage(acc.members)
    const participantNames: string[] = []
    for (const m of acc.members) {
      const label = m.fromName || m.fromAddr
      if (label && !participantNames.includes(label)) participantNames.push(label)
    }
    finalized.push({
      threadKey: acc.threadKey,
      accountId: acc.accountId,
      messageCount: acc.messageCount,
      unreadCount: acc.unreadCount,
      hasAttachments: acc.hasAttachments,
      isFlagged: acc.isFlagged,
      rootMessage,
      latestMessage,
      participantNames
    })
  }

  return finalized.sort((a, b) => {
    const ad = a.latestMessage.receivedAt ?? a.latestMessage.sentAt ?? ''
    const bd = b.latestMessage.receivedAt ?? b.latestMessage.sentAt ?? ''
    if (ad === bd) return 0
    return ad < bd ? 1 : -1
  })
}

export interface ThreadListIndex {
  threads: ThreadGroup[]
  messagesByThread: Map<string, MailListItem[]>
}

function pickStrongestOpenTodoDueKindForThread(
  folderMessages: MailListItem[],
  threadKey: string,
  scoped: boolean
): TodoDueKindList | null {
  let best: TodoDueKindList | null = null
  let bestRank = 999
  for (const m of folderMessages) {
    if (threadGroupingKey(m, scoped) !== threadKey) continue
    if (m.todoId == null) continue
    const k = parseOpenTodoDueKind(m.todoDueKind)
    if (!k) continue
    const r = rankOpenTodoBucket(k)
    if (r < bestRank) {
      bestRank = r
      best = k
    }
  }
  return best
}

/**
 * Threads + sortierte Mails pro Thread (inkl. Cross-Folder-Ergaenzungen wie in der Mailliste).
 */
export function indexMessagesByThread(
  messages: MailListItem[],
  threadMessages: Record<string, MailListItem[]>,
  namespaceThreadKeysByAccount = false
): ThreadListIndex {
  const threads = groupMessagesIntoThreads(
    messages,
    threadMessages,
    namespaceThreadKeysByAccount
  ).map((t) => ({
    ...t,
    openTodoDueKind: pickStrongestOpenTodoDueKindForThread(
      messages,
      t.threadKey,
      namespaceThreadKeysByAccount
    )
  }))
  const messagesByThread = new Map<string, MailListItem[]>()

  for (const m of messages) {
    const key = threadGroupingKey(m, namespaceThreadKeysByAccount)
    const arr = messagesByThread.get(key)
    if (arr) arr.push(m)
    else messagesByThread.set(key, [m])
  }

  for (const t of threads) {
    const cross = isSyntheticSingleMessageKey(t.threadKey, namespaceThreadKeysByAccount)
      ? []
      : (threadMessages[t.threadKey] ?? [])
    if (cross.length === 0) continue
    const existing = messagesByThread.get(t.threadKey) ?? []
    const seen = new Set(existing.map((m) => m.id))
    const merged = [...existing]
    for (const m of cross) {
      if (!seen.has(m.id)) {
        merged.push(m)
        seen.add(m.id)
      }
    }
    messagesByThread.set(t.threadKey, merged)
  }

  for (const arr of messagesByThread.values()) {
    arr.sort((a, b) => {
      const ad = a.receivedAt ?? a.sentAt ?? ''
      const bd = b.receivedAt ?? b.sentAt ?? ''
      if (ad === bd) return 0
      return ad < bd ? 1 : -1
    })
  }

  return { threads, messagesByThread }
}
