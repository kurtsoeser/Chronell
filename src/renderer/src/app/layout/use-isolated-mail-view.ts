import { useCallback, useEffect, useState } from 'react'
import { threadGroupingKey } from '@/lib/thread-group'
import type { MailFull, MailListItem } from '@shared/types'

export interface IsolatedMailView {
  selectedMessage: MailFull | null
  selectedMessageId: number | null
  messageLoading: boolean
  threadMessages: Record<string, MailListItem[]>
  selectMessage: (messageId: number) => Promise<void>
}

async function loadMessageWithThread(messageId: number): Promise<{
  message: MailFull | null
  threadMessages: Record<string, MailListItem[]>
}> {
  const msg = await window.mailClient.mail.getMessage(messageId)
  if (!msg) return { message: null, threadMessages: {} }
  const tk = msg.remoteThreadId?.trim()
  if (!tk) return { message: msg, threadMessages: {} }
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
  return { message: msg, threadMessages: sorted.length > 1 ? { [key]: sorted } : {} }
}

/** Mail-Vorschau unabhaengig von der Listen-Auswahl (Pop-out / eigenes Fenster). */
export function useIsolatedMailView(messageId: number | null): IsolatedMailView {
  const [selectedMessage, setSelectedMessage] = useState<MailFull | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(messageId)
  const [messageLoading, setMessageLoading] = useState(false)
  const [threadMessages, setThreadMessages] = useState<Record<string, MailListItem[]>>({})

  useEffect(() => {
    setSelectedMessageId(messageId)
  }, [messageId])

  const load = useCallback(async (id: number): Promise<void> => {
    setSelectedMessageId(id)
    setMessageLoading(true)
    try {
      const { message, threadMessages: threads } = await loadMessageWithThread(id)
      setSelectedMessage(message)
      setThreadMessages(threads)
    } catch (e) {
      console.error('[isolated-mail-view] load failed', e)
      setSelectedMessage(null)
      setThreadMessages({})
    } finally {
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
