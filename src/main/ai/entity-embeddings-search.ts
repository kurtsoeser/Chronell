import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey, parseEntityRefKey } from '@shared/entity-ref'
import type { EntityEmbeddingSearchHit } from '@shared/entity-embeddings'
import {
  embeddingBufferToFloat32,
  getEntityEmbedding,
  listEntityEmbeddings
} from '../db/entity-embeddings-repo'
import { buildAnchorSnapshot } from './entity-link-ai-context'
import type { AiLinkCandidateEntry } from './entity-link-ai-retrieval'
import { buildEntityEmbeddingText } from './entity-embedding-text'
import { topKByCosine } from './entity-embeddings-cosine'
import { embedTextWithOllama } from './ollama-embeddings'
import { getAiConnectionsSettings } from './ai-settings-store'
import { isEmbeddingPipelineActive } from '@shared/ai-connections'
import type { AiLinkRetrievalResult } from './entity-link-ai-retrieval'

const VECTOR_CACHE_TTL_MS = 45_000
let vectorCache: Array<{ key: string; vector: Float32Array }> | null = null
let vectorCacheAt = 0

function loadVectorCache(): Array<{ key: string; vector: Float32Array }> {
  const now = Date.now()
  if (vectorCache && now - vectorCacheAt < VECTOR_CACHE_TTL_MS) {
    return vectorCache
  }
  const rows = listEntityEmbeddings(30_000)
  vectorCache = rows.map((r) => ({
    key: r.ref_key,
    vector: embeddingBufferToFloat32(r.embedding)
  }))
  vectorCacheAt = now
  return vectorCache
}

export function invalidateEmbeddingVectorCache(): void {
  vectorCache = null
  vectorCacheAt = 0
}

async function anchorQueryVector(
  anchor: ChronellEntityRef,
  baseUrl: string,
  model: string
): Promise<Float32Array | null> {
  const key = entityRefKey(anchor)
  const stored = getEntityEmbedding(key)
  if (stored) return embeddingBufferToFloat32(stored.embedding)
  const text = buildEntityEmbeddingText(anchor, false)
  if (!text) return null
  return embedTextWithOllama(baseUrl, text, model)
}

export async function searchSimilarEntities(
  anchor: ChronellEntityRef,
  topK: number,
  exclude: Set<string>
): Promise<EntityEmbeddingSearchHit[]> {
  const settings = await getAiConnectionsSettings()
  if (!isEmbeddingPipelineActive(settings)) return []

  const query = await anchorQueryVector(
    anchor,
    settings.ollamaBaseUrl,
    settings.embeddingModel
  )
  if (!query) return []

  const hits = topKByCosine(query, loadVectorCache(), topK, exclude)
  const out: EntityEmbeddingSearchHit[] = []
  for (const h of hits) {
    const ref = parseEntityRefKey(h.key)
    if (!ref || h.score < 0.35) continue
    out.push({ refKey: h.key, kind: ref.kind, score: h.score })
  }
  return out
}

export async function embeddingHitsToCandidates(
  anchor: ChronellEntityRef,
  hits: EntityEmbeddingSearchHit[],
  cap: number
): Promise<AiLinkCandidateEntry[]> {
  const out: AiLinkCandidateEntry[] = []
  for (let i = 0; i < hits.length && out.length < cap; i++) {
    const hit = hits[i]!
    const ref = parseEntityRefKey(hit.refKey)
    if (!ref || entityRefKey(ref) === entityRefKey(anchor)) continue
    const snap = buildAnchorSnapshot(ref)
    if (!snap) continue
    const title =
      String(snap.fields.subject ?? snap.fields.title ?? snap.fields.display_name ?? '').trim() ||
      hit.refKey
    const subtitle =
      String(snap.fields.from_name ?? snap.fields.primary_email ?? snap.fields.location ?? '').trim() ||
      null
    out.push({
      candId: `cand_${out.length + 1}`,
      ref,
      snapshot: snap,
      title,
      subtitle
    })
  }
  return out
}

/** Heuristik-Kandidaten mit Vektor-Treffern anreichern (Hybrid-Retrieval §8.2). */
export async function mergeHybridEmbeddingCandidates(
  anchor: ChronellEntityRef,
  retrieval: AiLinkRetrievalResult,
  cap: number
): Promise<AiLinkRetrievalResult> {
  const settings = await getAiConnectionsSettings()
  if (!settings.embeddingHybridRetrieval || !isEmbeddingPipelineActive(settings)) {
    return retrieval
  }

  const exclude = new Set<string>([entityRefKey(anchor)])
  for (const c of retrieval.candidates) {
    exclude.add(entityRefKey(c.ref))
  }

  const hits = await searchSimilarEntities(anchor, Math.min(24, cap), exclude)
  const vectorCandidates = await embeddingHitsToCandidates(anchor, hits, Math.min(20, cap))
  if (vectorCandidates.length === 0) return retrieval

  const map = new Map<string, (typeof retrieval.candidates)[0]>()
  for (const c of retrieval.candidates) {
    map.set(entityRefKey(c.ref), c)
  }
  for (const c of vectorCandidates) {
    const key = entityRefKey(c.ref)
    if (!map.has(key) && map.size < cap) {
      map.set(key, c)
    }
  }
  const merged = [...map.values()].map((c, i) => ({ ...c, candId: `cand_${i + 1}` }))
  return { anchor: retrieval.anchor, candidates: merged }
}
