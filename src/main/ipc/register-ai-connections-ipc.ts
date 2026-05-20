import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  AiConnectionsProvider,
  AiConnectionsSetApiKeyInput,
  AiConnectionsSetSettingsInput,
  AiConnectionsSettings
} from '@shared/ai-connections'
import type {
  OllamaConnectionTestInput,
  OllamaConnectionTestResult,
  OllamaModelEntry
} from '@shared/ai-connections'
import {
  clearAiConnectionsApiKey,
  getAiConnectionsSettings,
  setAiConnectionsApiKey,
  setAiConnectionsSettings
} from '../ai/ai-settings-store'
import {
  listOllamaModels,
  normalizeOllamaBaseUrl,
  testOllamaConnection
} from '../ai/ollama-provider'
import type { EntityEmbeddingIndexStatus, EntityEmbeddingRebuildInput } from '@shared/entity-embeddings'
import {
  cancelEmbeddingRebuild,
  getEntityEmbeddingIndexStatus,
  rebuildEntityEmbeddingIndex
} from '../ai/entity-embeddings-index'

function parseProvider(value: unknown): AiConnectionsProvider | null {
  return value === 'openai' || value === 'gemini' || value === 'ollama' ? value : null
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

  ipcMain.handle(
    IPC.aiConnections.listOllamaModels,
    async (_event, baseUrl: unknown): Promise<OllamaModelEntry[]> => {
      const settings = await getAiConnectionsSettings()
      const url =
        typeof baseUrl === 'string' && baseUrl.trim()
          ? baseUrl
          : settings.ollamaBaseUrl
      return listOllamaModels(normalizeOllamaBaseUrl(url))
    }
  )

  ipcMain.handle(
    IPC.aiConnections.testOllamaConnection,
    async (_event, input: unknown): Promise<OllamaConnectionTestResult> => {
      const settings = await getAiConnectionsSettings()
      const raw = input as OllamaConnectionTestInput | null
      const baseUrl =
        typeof raw?.baseUrl === 'string' && raw.baseUrl.trim()
          ? raw.baseUrl
          : settings.ollamaBaseUrl
      const model =
        raw?.model !== undefined
          ? typeof raw.model === 'string'
            ? raw.model
            : null
          : settings.model
      return testOllamaConnection({
        baseUrl: normalizeOllamaBaseUrl(baseUrl),
        model
      })
    }
  )

  ipcMain.handle(
    IPC.aiConnections.getEmbeddingIndexStatus,
    async (): Promise<EntityEmbeddingIndexStatus> => getEntityEmbeddingIndexStatus()
  )

  ipcMain.handle(
    IPC.aiConnections.rebuildEmbeddingIndex,
    async (_event, input: EntityEmbeddingRebuildInput | undefined) =>
      rebuildEntityEmbeddingIndex(input ?? {})
  )

  ipcMain.handle(IPC.aiConnections.cancelEmbeddingRebuild, async (): Promise<void> => {
    cancelEmbeddingRebuild()
  })
}
