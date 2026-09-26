import { ipcRenderer } from 'electron'
import { IPC } from '@shared/types'
import type {
  CopilotChatSendInput,
  CopilotChatSendResult,
  CopilotRetrievalInput,
  CopilotRetrievalResult,
  MessageCopilotCacheEntry,
  MessageCopilotCacheGetInput,
  MessageCopilotCacheSetInput
} from '@shared/types'

export const copilotApi = {
  chat: (input: CopilotChatSendInput): Promise<CopilotChatSendResult> =>
    ipcRenderer.invoke(IPC.copilot.chat, input),
  retrieve: (input: CopilotRetrievalInput): Promise<CopilotRetrievalResult> =>
    ipcRenderer.invoke(IPC.copilot.retrieve, input),
  cacheGet: (input: MessageCopilotCacheGetInput): Promise<MessageCopilotCacheEntry | null> =>
    ipcRenderer.invoke(IPC.copilot.cacheGet, input),
  cacheSet: (input: MessageCopilotCacheSetInput): Promise<MessageCopilotCacheEntry | null> =>
    ipcRenderer.invoke(IPC.copilot.cacheSet, input),
  workIqStatus: (input: {
    accountId: string
  }): Promise<{ available: boolean }> => ipcRenderer.invoke(IPC.copilot.workIqStatus, input),
  workIqEnable: (input: {
    accountId: string
  }): Promise<{ available: boolean; errorMessage?: string }> =>
    ipcRenderer.invoke(IPC.copilot.workIqEnable, input)
}
