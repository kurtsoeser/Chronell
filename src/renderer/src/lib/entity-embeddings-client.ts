import { IPC } from '@shared/ipc-channels'
import type {
  EntityEmbeddingIndexStatus,
  EntityEmbeddingProgress
} from '@shared/entity-embeddings'

type EntityEmbeddingsEventsApi = {
  onEntityEmbeddingProgress?: (
    handler: (progress: EntityEmbeddingProgress | null) => void
  ) => () => void
}

export async function fetchEntityEmbeddingIndexStatus(): Promise<EntityEmbeddingIndexStatus> {
  const fn = window.mailClient?.aiConnections?.getEmbeddingIndexStatus
  if (typeof fn === 'function') return fn()
  const raw = await window.mailClient.invoke(IPC.aiConnections.getEmbeddingIndexStatus)
  return raw as EntityEmbeddingIndexStatus
}

export function subscribeEntityEmbeddingProgress(
  onProgress: (progress: EntityEmbeddingProgress | null) => void
): () => void {
  const fn = (window.mailClient?.events as EntityEmbeddingsEventsApi | undefined)
    ?.onEntityEmbeddingProgress
  if (typeof fn === 'function') return fn(onProgress)
  return () => {}
}
