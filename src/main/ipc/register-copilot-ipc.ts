import { ipcMain } from 'electron'
import {
  IPC,
  isCopilotApiEngine,
  normalizeCopilotChatEngine,
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
import { loadConfig } from '../config'

export function registerCopilotIpc(): void {
  ipcMain.removeHandler(IPC.copilot.chat)
  ipcMain.handle(
    IPC.copilot.chat,
    async (_event, input: CopilotChatSendInput): Promise<CopilotChatSendResult> => {
      const payload = input ?? { accountId: '', message: '' }
      const engine = normalizeCopilotChatEngine(payload.engine)

      if (isCopilotApiEngine(engine)) {
        if (engine !== 'ollama') assertAppOnline()
        const { aiConnectionsCopilotChat } = await import('../ai/ai-connections-copilot-chat')
        return aiConnectionsCopilotChat(payload, engine)
      }

      assertAppOnline()
      if (engine === 'workiq') {
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
      const engine = normalizeCopilotChatEngine(input?.engine)
      return getMessageCopilotCache(messageId, engine)
    }
  )

  ipcMain.removeHandler(IPC.copilot.cacheSet)
  ipcMain.handle(
    IPC.copilot.cacheSet,
    async (_event, input: MessageCopilotCacheSetInput): Promise<MessageCopilotCacheEntry | null> => {
      return upsertMessageCopilotCache({
        messageId: Number(input?.messageId),
        engine: normalizeCopilotChatEngine(input?.engine),
        replyText: input?.replyText ?? '',
        attributions: Array.isArray(input?.attributions) ? input.attributions : []
      })
    }
  )

  ipcMain.removeHandler(IPC.copilot.workIqStatus)
  ipcMain.handle(
    IPC.copilot.workIqStatus,
    async (
      _event,
      input: { accountId?: string }
    ): Promise<{ available: boolean }> => {
      const accountId = String(input?.accountId ?? '').trim()
      if (!accountId.startsWith('ms:')) return { available: false }
      const config = await loadConfig()
      if (!config.microsoftClientId) return { available: false }
      const { probeWorkIqSilent } = await import('../auth/microsoft-workiq')
      const available = await probeWorkIqSilent(config.microsoftClientId, accountId)
      return { available }
    }
  )

  ipcMain.removeHandler(IPC.copilot.workIqEnable)
  ipcMain.handle(
    IPC.copilot.workIqEnable,
    async (
      _event,
      input: { accountId?: string }
    ): Promise<{ available: boolean; errorMessage?: string }> => {
      const accountId = String(input?.accountId ?? '').trim()
      if (!accountId.startsWith('ms:')) {
        return { available: false, errorMessage: 'Microsoft-Konto erforderlich.' }
      }
      const config = await loadConfig()
      if (!config.microsoftClientId) {
        return { available: false, errorMessage: 'Microsoft Client-ID fehlt in den Einstellungen.' }
      }
      try {
        assertAppOnline()
        const { acquireWorkIqAccessToken } = await import('../auth/microsoft-workiq')
        await acquireWorkIqAccessToken(config.microsoftClientId, accountId)
        return { available: true }
      } catch (err) {
        return {
          available: false,
          errorMessage: err instanceof Error ? err.message : String(err)
        }
      }
    }
  )
}
