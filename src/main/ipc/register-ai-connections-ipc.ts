import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  AiConnectionsProvider,
  AiConnectionsSetApiKeyInput,
  AiConnectionsSetSettingsInput,
  AiConnectionsSettings
} from '@shared/ai-connections'
import {
  clearAiConnectionsApiKey,
  getAiConnectionsSettings,
  setAiConnectionsApiKey,
  setAiConnectionsSettings
} from '../ai/ai-settings-store'

function parseProvider(value: unknown): AiConnectionsProvider | null {
  return value === 'openai' || value === 'gemini' ? value : null
}

export function registerAiConnectionsIpc(): void {
  ipcMain.handle(IPC.aiConnections.getSettings, async (): Promise<AiConnectionsSettings> => {
    return getAiConnectionsSettings()
  })

  ipcMain.handle(
    IPC.aiConnections.setSettings,
    async (_event, input: AiConnectionsSetSettingsInput): Promise<AiConnectionsSettings> => {
      return setAiConnectionsSettings(input ?? {})
    }
  )

  ipcMain.handle(
    IPC.aiConnections.setApiKey,
    async (_event, input: unknown): Promise<AiConnectionsSettings> => {
      const raw = input as AiConnectionsSetApiKeyInput | string | null
      if (typeof raw === 'string') {
        const settings = await getAiConnectionsSettings()
        return setAiConnectionsApiKey(settings.provider, raw)
      }
      const provider = parseProvider((raw as AiConnectionsSetApiKeyInput)?.provider)
      const apiKey =
        typeof (raw as AiConnectionsSetApiKeyInput)?.apiKey === 'string'
          ? (raw as AiConnectionsSetApiKeyInput).apiKey
          : ''
      if (!provider) throw new Error('Anbieter fehlt.')
      return setAiConnectionsApiKey(provider, apiKey)
    }
  )

  ipcMain.handle(
    IPC.aiConnections.clearApiKey,
    async (_event, provider: unknown): Promise<AiConnectionsSettings> => {
      const parsed = parseProvider(provider)
      if (!parsed) {
        const settings = await getAiConnectionsSettings()
        return clearAiConnectionsApiKey(settings.provider)
      }
      return clearAiConnectionsApiKey(parsed)
    }
  )
}
