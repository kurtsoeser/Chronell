import { useEffect, useMemo, useRef, useState } from 'react'
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
  threadMessages: Record<string, MailListItem[]>,
  namespaceByAccount = true
): MailListItem[] | null {
  const [fetched, setFetched] = useState<MailListItem[] | null>(null)
  const activeFetchKeyRef = useRef<string | null>(null)

  const threadKey = useMemo(
    () => (selectedMessage ? threadGroupingKey(selectedMessage, namespaceByAccount) : null),
    [selectedMessage, namespaceByAccount]
  )

  const fromCache = useMemo((): MailListItem[] | null => {
    if (!selectedMessage || threadKey == null) return null
    const row = threadMessages[threadKey]
    if (!row || row.length <= 1) return null
    return sortThreadMessages(row)
  }, [selectedMessage, threadKey, threadMessages])

  useEffect(() => {
    if (!selectedMessage || threadKey == null) {
      setFetched(null)
      activeFetchKeyRef.current = null
      return
    }
    const remoteThreadId = selectedMessage.remoteThreadId?.trim()
    if (!remoteThreadId) {
      setFetched(null)
      activeFetchKeyRef.current = null
      return
    }
    if (fromCache && fromCache.length > 1) {
      activeFetchKeyRef.current = threadKey
      return
    }

    if (activeFetchKeyRef.current !== threadKey) {
      setFetched(null)
      activeFetchKeyRef.current = threadKey
    }

    let cancelled = false
    void window.mailClient.mail
      .listMessagesByThreads({
        accountId: selectedMessage.accountId,
        threadKeys: [remoteThreadId]
      })
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
  }, [selectedMessage, threadKey, fromCache])

  return fromCache ?? fetched
}
