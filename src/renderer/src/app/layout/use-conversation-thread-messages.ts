import { useEffect, useMemo, useState } from 'react'
import { threadGroupingKey } from '@/lib/thread-group'
import { compareMessageChronoDesc } from '@/lib/thread-display-pick'
import { dedupeMailListThreadMessagesById } from '@/lib/mail-list-ui'
import type { MailFull, MailListItem } from '@shared/types'

function sortThreadMessages(msgs: MailListItem[]): MailListItem[] {
  return [...dedupeMailListThreadMessagesById(msgs)].sort(compareMessageChronoDesc)
}

/**
 * Mails einer Konversation fuer die Vorschau (neueste zuerst).
 * Nutzt den Listen-Cache; laedt bei Bedarf den Thread nach, ohne den globalen Store zu ueberschreiben.
 */
export function useConversationThreadMessages(
  selectedMessage: MailFull | null,
  threadMessages: Record<string, MailListItem[]>
): MailListItem[] | null {
  const [fetched, setFetched] = useState<MailListItem[] | null>(null)

  const threadKey = useMemo(
    () => (selectedMessage ? threadGroupingKey(selectedMessage, true) : null),
    [selectedMessage]
  )

  const fromCache = useMemo((): MailListItem[] | null => {
    if (!selectedMessage || threadKey == null) return null
    const row = threadMessages[threadKey]
    if (!row || row.length <= 1) return null
    return sortThreadMessages(row)
  }, [selectedMessage, threadKey, threadMessages])

  useEffect(() => {
    setFetched(null)
    if (!selectedMessage) return
    const tk = selectedMessage.remoteThreadId?.trim()
    if (!tk) return
    if (fromCache && fromCache.length > 1) return

    let cancelled = false
    void window.mailClient.mail
      .listMessagesByThreads({ accountId: selectedMessage.accountId, threadKeys: [tk] })
      .then((list) => {
        if (cancelled) return
        const sorted = sortThreadMessages(list)
        setFetched(sorted.length > 1 ? sorted : null)
      })
      .catch(() => {
        if (!cancelled) setFetched(null)
      })

    return (): void => {
      cancelled = true
    }
  }, [selectedMessage?.id, selectedMessage?.accountId, selectedMessage?.remoteThreadId, fromCache])

  return fromCache ?? fetched
}
