import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityEmbeddingIndexStatus, EntityEmbeddingRebuildInput } from '@shared/entity-embeddings'
import { DEFAULT_EMBEDDING_MODEL } from '@shared/entity-embeddings'
import {
  countEntityEmbeddings,
  getEntityEmbedding,
  latestEntityEmbeddingIndexedAt,
  upsertEntityEmbedding
} from '../db/entity-embeddings-repo'
import { getAiConnectionsSettings } from './ai-settings-store'
import { readPersistedEmbeddingSettings } from './entity-embeddings-settings'
import {
  buildEntityEmbeddingText,
  embeddingRefKey,
  entitySourceUpdatedIso,
  hashEmbeddingText
} from './entity-embedding-text'
import { listEntityRefsForEmbeddingIndex } from './entity-embeddings-catalog'
import { embedTextsWithOllama } from './ollama-embeddings'
import { broadcastEntityEmbeddingProgress } from '../ipc/ipc-broadcasts'
import { invalidateEmbeddingVectorCache } from './entity-embeddings-search'

let rebuildRunning = false
let rebuildCancel = false
let lastError: string | null = null
let rebuildProgress: { done: number; total: number } | null = null

export function isEmbeddingRebuildRunning(): boolean {
  return rebuildRunning
}

export function cancelEmbeddingRebuild(): void {
  rebuildCancel = true
}

export async function getEntityEmbeddingIndexStatus(): Promise<EntityEmbeddingIndexStatus> {
  const s = await getAiConnectionsSettings()
  const catalog = listEntityRefsForEmbeddingIndex({
    lookbackDays: s.scanLookbackDays,
    maxEntities: 12_000
  })
  const indexed = countEntityEmbeddings()
  return {
    enabled: s.embeddingsEnabled,
    hybridRetrieval: s.embeddingHybridRetrieval,
    autoIndex: s.embeddingAutoIndex,
    fastSuggestions: s.embeddingFastSuggestions,
    embeddingModel: s.embeddingModel,
    indexedCount: indexed,
    pendingEstimate: Math.max(0, catalog.length - indexed),
    lastIndexedAt: latestEntityEmbeddingIndexedAt(),
    rebuildRunning,
    rebuildProgress: rebuildProgress ? { ...rebuildProgress } : null,
    lastError
  }
}

export async function indexEntityEmbedding(
  ref: ChronellEntityRef,
  options?: { force?: boolean; includeExcerpt?: boolean }
): Promise<boolean> {
  const settings = await getAiConnectionsSettings()
  if (!settings.embeddingsEnabled) return false

  const refKey = embeddingRefKey(ref)
  const text = buildEntityEmbeddingText(ref, options?.includeExcerpt ?? false)
  if (!text) return false
  const textHash = hashEmbeddingText(text)
  const existing = getEntityEmbedding(refKey)
  if (!options?.force && existing?.text_hash === textHash) return false

  const [vec] = await embedTextsWithOllama({
    baseUrl: settings.ollamaBaseUrl,
    model: settings.embeddingModel,
    texts: [text]
  })
  if (!vec) return false

  upsertEntityEmbedding({
    refKey,
    kind: ref.kind,
    textHash,
    vector: vec,
    sourceUpdatedAt: entitySourceUpdatedIso(ref)
  })
  invalidateEmbeddingVectorCache()
  return true
}

export async function indexEntityEmbeddingsBatch(
  refs: ChronellEntityRef[],
  onProgress?: (done: number, total: number) => void
): Promise<{ indexed: number; skipped: number; failed: number }> {
  const settings = await getAiConnectionsSettings()
  if (!settings.embeddingsEnabled) {
    return { indexed: 0, skipped: refs.length, failed: 0 }
  }

  let indexed = 0
  let skipped = 0
  let failed = 0
  const pending: Array<{ ref: ChronellEntityRef; text: string; textHash: string; refKey: string }> =
    []

  for (const ref of refs) {
    const refKey = embeddingRefKey(ref)
    const text = buildEntityEmbeddingText(ref, false)
    if (!text) {
      skipped++
      continue
    }
    const textHash = hashEmbeddingText(text)
    const existing = getEntityEmbedding(refKey)
    if (existing?.text_hash === textHash) {
      skipped++
      continue
    }
    pending.push({ ref, text, textHash, refKey })
  }

  const total = refs.length
  let done = 0
  onProgress?.(done, total)

  const BATCH = 8
  for (let i = 0; i < pending.length; i += BATCH) {
    if (rebuildCancel) break
    const chunk = pending.slice(i, i + BATCH)
    try {
      const vectors = await embedTextsWithOllama({
        baseUrl: settings.ollamaBaseUrl,
        model: settings.embeddingModel,
        texts: chunk.map((c) => c.text)
      })
      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j]!
        const vec = vectors[j]
        if (!vec) {
          failed++
          continue
        }
        upsertEntityEmbedding({
          refKey: row.refKey,
          kind: row.ref.kind,
          textHash: row.textHash,
          vector: vec,
          sourceUpdatedAt: entitySourceUpdatedIso(row.ref)
        })
        indexed++
      }
    } catch (err) {
      failed += chunk.length
      lastError = err instanceof Error ? err.message : String(err)
    }
    done += chunk.length
    onProgress?.(done, total)
    broadcastEntityEmbeddingProgress({ done, total, phase: 'auto' })
  }

  invalidateEmbeddingVectorCache()
  return { indexed, skipped, failed }
}

export async function rebuildEntityEmbeddingIndex(
  input: EntityEmbeddingRebuildInput = {}
): Promise<{ indexed: number; skipped: number; failed: number }> {
  if (rebuildRunning) {
    throw new Error('Embedding-Index wird bereits aufgebaut.')
  }
  rebuildRunning = true
  rebuildCancel = false
  lastError = null
  const settings = await readPersistedEmbeddingSettings()
  const lookbackDays = input.lookbackDays ?? settings.scanLookbackDays
  const maxEntities = input.maxEntities ?? 12_000
  const refs = listEntityRefsForEmbeddingIndex({ lookbackDays, maxEntities })
  rebuildProgress = { done: 0, total: refs.length }
  broadcastEntityEmbeddingProgress({ ...rebuildProgress, phase: 'rebuild' })

  try {
    const result = await indexEntityEmbeddingsBatch(refs, (done, total) => {
      rebuildProgress = { done, total }
      broadcastEntityEmbeddingProgress({ ...rebuildProgress, phase: 'rebuild' })
    })
    invalidateEmbeddingVectorCache()
    return result
  } finally {
    rebuildRunning = false
    rebuildProgress = null
    rebuildCancel = false
    broadcastEntityEmbeddingProgress(null)
  }
}

export function resolveLlmMaxCandidatesWithEmbeddings(
  baseMax: number,
  embeddingsActive: boolean
): number {
  if (!embeddingsActive) return baseMax
  return Math.min(baseMax, 15)
}
