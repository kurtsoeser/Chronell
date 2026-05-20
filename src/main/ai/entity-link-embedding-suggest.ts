import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityLinkSuggestion } from '@shared/entity-links'
import { entityLinkExists, listEntityLinksForAnchor } from '../db/entity-links-repo'
import { isEmbeddingPipelineActive } from '@shared/ai-connections'
import { getAiConnectionsSettings } from './ai-settings-store'
import { searchSimilarEntities, embeddingHitsToCandidates } from './entity-embeddings-search'
import { isEntityLinkAiDismissed } from './entity-link-ai-dismissed'

export async function suggestEntityLinksFromEmbeddings(
  anchor: ChronellEntityRef,
  minConfidence: number
): Promise<EntityLinkSuggestion[]> {
  const settings = await getAiConnectionsSettings()
  if (!settings.embeddingFastSuggestions || !isEmbeddingPipelineActive(settings)) {
    return []
  }

  const linkedKeys = new Set(
    listEntityLinksForAnchor(anchor).map((item) => entityRefKey(item.peer))
  )
  linkedKeys.add(entityRefKey(anchor))

  const hits = await searchSimilarEntities(anchor, 12, linkedKeys)
  const candidates = await embeddingHitsToCandidates(anchor, hits, 10)
  const out: EntityLinkSuggestion[] = []

  for (const c of candidates) {
    const key = entityRefKey(c.ref)
    if (linkedKeys.has(key)) continue
    if (entityLinkExists(anchor, c.ref)) continue
    const hit = hits.find((h) => h.refKey === key)
    const score = hit?.score ?? 0
    if (score < minConfidence) continue
    if (await isEntityLinkAiDismissed(anchor, c.ref)) {
      continue
    }
    out.push({
      target: c.ref,
      reason: 'embedding_semantic',
      confidence: score,
      title: c.title,
      subtitle: c.subtitle,
      reasonText: 'Ähnlichkeit im lokalen Vektorindex'
    })
  }
  return out
}
