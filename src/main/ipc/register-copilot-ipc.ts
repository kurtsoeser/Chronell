import { ipcMain } from 'electron'
import {
  IPC,
  type CopilotChatSendInput,
  type CopilotChatSendResult,
  type CopilotRetrievalInput,
  type CopilotRetrievalResult,
  type MessageCopilotCacheEntry,
  type MessageCopilotCacheGetInput,
  type MessageCopilotCacheSetInput
} from '@shared/types'
import { assertAppOnline } from '../network-status'
import {
  getMessageCopilotCache,
  upsertMessageCopilotCache
} from '../db/message-copilot-cache-repo'

export function registerCopilotIpc(): void {
  ipcMain.removeHandler(IPC.copilot.chat)
  ipcMain.handle(
    IPC.copilot.chat,
    async (_event, input: CopilotChatSendInput): Promise<CopilotChatSendResult> => {
      assertAppOnline()
      const payload = input ?? { accountId: '', message: '' }
      if (payload.engine === 'workiq') {
        const { workIqCopilotChat } = await import('../graph/workiq-chat')
        return workIqCopilotChat(payload)
      }
      const { graphCopilotChat } = await import('../graph/copilot-chat-graph')
      return graphCopilotChat(payload)
    }
  )

  ipcMain.removeHandler(IPC.copilot.retrieve)
  ipcMain.handle(
    IPC.copilot.retrieve,
    async (_event, input: CopilotRetrievalInput): Promise<CopilotRetrievalResult> => {
      assertAppOnline()
      const { graphCopilotRetrieve } = await import('../graph/copilot-retrieval-graph')
      return graphCopilotRetrieve(
        input ?? { accountId: '', queryString: '', dataSource: 'sharePoint' }
      )
    }
  )

  ipcMain.removeHandler(IPC.copilot.cacheGet)
  ipcMain.handle(
    IPC.copilot.cacheGet,
    async (_event, input: MessageCopilotCacheGetInput): Promise<MessageCopilotCacheEntry | null> => {
      const messageId = Number(input?.messageId)
      const engine = input?.engine === 'workiq' ? 'workiq' : 'graph'
      return getMessageCopilotCache(messageId, engine)
    }
  )

  ipcMain.removeHandler(IPC.copilot.cacheSet)
  ipcMain.handle(
    IPC.copilot.cacheSet,
    async (_event, input: MessageCopilotCacheSetInput): Promise<MessageCopilotCacheEntry | null> => {
      return upsertMessageCopilotCache({
        messageId: Number(input?.messageId),
        engine: input?.engine === 'workiq' ? 'workiq' : 'graph',
        replyText: input?.replyText ?? '',
        attributions: Array.isArray(input?.attributions) ? input.attributions : []
      })
    }
  )
}
