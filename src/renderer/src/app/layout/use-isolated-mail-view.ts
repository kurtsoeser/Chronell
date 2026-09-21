import { useCallback, useEffect, useRef, useState } from 'react'
import { threadGroupingKey } from '@/lib/thread-group'
import type { MailFull, MailListItem } from '@shared/types'

export interface IsolatedMailView {
  selectedMessage: MailFull | null
  selectedMessageId: number | null
  messageLoading: boolean
  threadMessages: Record<string, MailListItem[]>
  selectMessage: (messageId: number) => Promise<void>
}

async function loadThreadForMessage(
  msg: MailFull
): Promise<Record<string, MailListItem[]>> {
  const tk = msg.remoteThreadId?.trim()
  if (!tk) return {}
  const list = await window.mailClient.mail
    .listMessagesByThreads({ accountId: msg.accountId, threadKeys: [tk] })
    .catch(() => [] as MailListItem[])
  const key = threadGroupingKey(msg, true)
  const sorted = [...list].sort((a, b) => {
    const ad = a.receivedAt ?? a.sentAt ?? ''
    const bd = b.receivedAt ?? b.sentAt ?? ''
    if (ad === bd) return 0
    return ad < bd ? 1 : -1
  })
  return sorted.length > 1 ? { [key]: sorted } : {}
}

/** Mail-Vorschau unabhaengig von der Listen-Auswahl (Pop-out / eigenes Fenster). */
export function useIsolatedMailView(messageId: number | null): IsolatedMailView {
  const [selectedMessage, setSelectedMessage] = useState<MailFull | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(messageId)
  const [messageLoading, setMessageLoading] = useState(false)
  const [threadMessages, setThreadMessages] = useState<Record<string, MailListItem[]>>({})
  const loadGenRef = useRef(0)

  useEffect(() => {
    setSelectedMessageId(messageId)
  }, [messageId])

  const load = useCallback(async (id: number): Promise<void> => {
    const gen = ++loadGenRef.current
    setSelectedMessageId(id)
    setMessageLoading(true)
    try {
      const msg = await window.mailClient.mail.getMessage(id)
      if (loadGenRef.current !== gen) return
      setSelectedMessage(msg)
      setMessageLoading(false)
      if (!msg) {
        setThreadMessages({})
        return
      }
      const threads = await loadThreadForMessage(msg)
      if (loadGenRef.current !== gen) return
      setThreadMessages(threads)
    } catch (e) {
      if (loadGenRef.current !== gen) return
      console.error('[isolated-mail-view] load failed', e)
      setSelectedMessage(null)
      setThreadMessages({})
      setMessageLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedMessageId == null) {
      setSelectedMessage(null)
      setThreadMessages({})
      setMessageLoading(false)
      return
    }
    void load(selectedMessageId)
  }, [selectedMessageId, load])

  useEffect(() => {
    if (selectedMessageId == null) return
    const unsub = window.mailClient.events.onMailChanged((payload) => {
      const accountId = selectedMessage?.accountId
      if (accountId && payload.accountId !== accountId) return
      void load(selectedMessageId)
    })
    return unsub
  }, [selectedMessageId, selectedMessage?.accountId, load])

  const selectMessage = useCallback(
    async (id: number): Promise<void> => {
      await load(id)
    },
    [load]
  )

  return {
    selectedMessage,
    selectedMessageId,
    messageLoading,
    threadMessages,
    selectMessage
  }
}
