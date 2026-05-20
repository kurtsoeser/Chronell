import type { EntityRefKind } from './entity-ref'

export const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text'

export interface EntityEmbeddingIndexStatus {
  enabled: boolean
  hybridRetrieval: boolean
  autoIndex: boolean
  fastSuggestions: boolean
  embeddingModel: string
  indexedCount: number
  pendingEstimate: number
  lastIndexedAt: string | null
  rebuildRunning: boolean
  rebuildProgress: { done: number; total: number } | null
  lastError: string | null
}

export interface EntityEmbeddingRebuildInput {
  lookbackDays?: number
  maxEntities?: number
}

export interface EntityEmbeddingSearchHit {
  refKey: string
  kind: EntityRefKind
  score: number
}

export interface EntityEmbeddingProgress {
  done: number
  total: number
  phase: 'rebuild' | 'auto'
}
