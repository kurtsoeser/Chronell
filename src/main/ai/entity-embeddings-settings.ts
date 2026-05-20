import { getAiConnectionsSettings } from './ai-settings-store'

export async function readPersistedEmbeddingSettings() {
  return getAiConnectionsSettings()
}

export { isEmbeddingPipelineActive } from '@shared/ai-connections'
