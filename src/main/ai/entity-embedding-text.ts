import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import { createHash } from 'node:crypto'
import {
  anchorReferenceIso,
  buildAnchorSnapshot,
  enrichSnapshotWithTextExcerpt
} from './entity-link-ai-context'

/** Kanonischer Text für Embedding-Index (Metadaten + optional Snippet). */
export function buildEntityEmbeddingText(
  ref: ChronellEntityRef,
  includeExcerpt: boolean
): string | null {
  const snap = buildAnchorSnapshot(ref)
  if (!snap) return null
  const enriched = includeExcerpt ? enrichSnapshotWithTextExcerpt(ref, snap) : snap
  const parts: string[] = [enriched.kind]
  for (const [k, v] of Object.entries(enriched.fields)) {
    if (v == null || v === '') continue
    parts.push(`${k}: ${String(v).slice(0, 500)}`)
  }
  const text = parts.join('\n').trim()
  return text.length > 0 ? text : null
}

export function hashEmbeddingText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function entitySourceUpdatedIso(ref: ChronellEntityRef): string {
  return anchorReferenceIso(ref)
}

export function embeddingRefKey(ref: ChronellEntityRef): string {
  return entityRefKey(ref)
}
