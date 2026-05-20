import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey, entityRefsEqual } from '@shared/entity-ref'
import type { EntityLinkSuggestion, EntityLinkSuggestionChain } from '@shared/entity-links'
import type { AiLinkCandidateEntry } from './entity-link-ai-retrieval'

export const AI_CONFIDENCE_MIN = 0.65
export const AI_MAX_SUGGESTIONS = 8

export interface RawAiLinkPair {
  fromId: string
  toId: string
  confidence: number
  reason: string
}

export interface RawAiLinkChain {
  pathIds: string[]
  confidence: number
  reason: string
}

export function parseRawAiSuggestions(payload: unknown): RawAiLinkPair[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { suggestions?: unknown }
  if (!Array.isArray(root.suggestions)) return []
  const out: RawAiLinkPair[] = []
  for (const item of root.suggestions) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const fromId = typeof row.fromId === 'string' ? row.fromId.trim() : ''
    const toId = typeof row.toId === 'string' ? row.toId.trim() : ''
    const confidence =
      typeof row.confidence === 'number'
        ? row.confidence
        : typeof row.confidence === 'string'
          ? Number(row.confidence)
          : NaN
    const reason = typeof row.reason === 'string' ? row.reason.trim() : ''
    if (!fromId || !toId || !Number.isFinite(confidence)) continue
    out.push({ fromId, toId, confidence, reason })
  }
  return out
}

export function parseRawAiChains(payload: unknown): RawAiLinkChain[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { chains?: unknown }
  if (!Array.isArray(root.chains)) return []
  const out: RawAiLinkChain[] = []
  for (const item of root.chains) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const pathIds = Array.isArray(row.pathIds)
      ? row.pathIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : []
    const confidence =
      typeof row.confidence === 'number'
        ? row.confidence
        : typeof row.confidence === 'string'
          ? Number(row.confidence)
          : NaN
    const reason = typeof row.reason === 'string' ? row.reason.trim() : ''
    if (pathIds.length < 2 || !Number.isFinite(confidence)) continue
    out.push({ pathIds, confidence, reason })
  }
  return out
}

export function rawChainsToEntityChains(
  anchor: ChronellEntityRef,
  raw: RawAiLinkChain[],
  candidateById: Map<string, AiLinkCandidateEntry>,
  minConfidence: number
): EntityLinkSuggestionChain[] {
  const anchorKey = entityRefKey(anchor)
  const out: EntityLinkSuggestionChain[] = []
  for (const chain of raw) {
    if (chain.confidence < minConfidence) continue
    const steps: EntityLinkSuggestionChain['steps'] = []
    for (const id of chain.pathIds) {
      const entry = candidateById.get(id)
      if (!entry) break
      steps.push({ ref: entry.ref, title: entry.title })
    }
    if (steps.length < 2) continue
    const touchesAnchor = steps.some((s) => entityRefKey(s.ref) === anchorKey)
    if (!touchesAnchor) continue
    out.push({
      steps,
      confidence: chain.confidence,
      reasonText: chain.reason || undefined
    })
    if (out.length >= 4) break
  }
  return out
}

export function rawPairsToEntitySuggestions(
  anchor: ChronellEntityRef,
  raw: RawAiLinkPair[],
  candidateById: Map<string, AiLinkCandidateEntry>,
  linkedPeerKeys: Set<string>,
  existsLink: (a: ChronellEntityRef, b: ChronellEntityRef) => boolean,
  minConfidence: number = AI_CONFIDENCE_MIN
): EntityLinkSuggestion[] {
  const anchorKey = entityRefKey(anchor)
  const seen = new Set<string>()
  const out: EntityLinkSuggestion[] = []

  for (const pair of raw) {
    if (pair.confidence < minConfidence) continue
    const fromEntry = candidateById.get(pair.fromId)
    const toEntry = candidateById.get(pair.toId)
    if (!fromEntry || !toEntry) continue

    const fromKey = entityRefKey(fromEntry.ref)
    const toKey = entityRefKey(toEntry.ref)
    let peerEntry: AiLinkCandidateEntry | null = null

    if (fromKey === anchorKey) peerEntry = toEntry
    else if (toKey === anchorKey) peerEntry = fromEntry
    else continue

    const peerKey = entityRefKey(peerEntry.ref)
    if (linkedPeerKeys.has(peerKey) || seen.has(peerKey)) continue
    if (existsLink(anchor, peerEntry.ref)) continue

    seen.add(peerKey)
    linkedPeerKeys.add(peerKey)
    out.push({
      target: peerEntry.ref,
      title: peerEntry.title,
      subtitle: peerEntry.subtitle,
      reason: 'ai_semantic',
      confidence: pair.confidence,
      reasonText: pair.reason || undefined
    })
    if (out.length >= AI_MAX_SUGGESTIONS) break
  }

  return out
}

export function mergeEntityLinkSuggestions(
  heuristic: EntityLinkSuggestion[],
  ai: EntityLinkSuggestion[]
): EntityLinkSuggestion[] {
  const seen = new Set<string>()
  const out: EntityLinkSuggestion[] = []
  for (const s of heuristic) {
    const key = entityRefKey(s.target)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  for (const s of ai) {
    const key = entityRefKey(s.target)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out.slice(0, 12)
}

export function intersectAiSuggestions(
  a: EntityLinkSuggestion[],
  b: EntityLinkSuggestion[]
): EntityLinkSuggestion[] {
  const bByKey = new Map(b.map((s) => [entityRefKey(s.target), s]))
  const out: EntityLinkSuggestion[] = []
  for (const s of a) {
    if (s.reason !== 'ai_semantic') continue
    const other = bByKey.get(entityRefKey(s.target))
    if (!other) continue
    out.push({
      ...s,
      confidence: Math.max(s.confidence ?? 0, other.confidence ?? 0),
      reasonText: s.reasonText || other.reasonText,
      providerConsensus: true
    })
  }
  return out
}

export function intersectAiChains(
  a: EntityLinkSuggestionChain[],
  b: EntityLinkSuggestionChain[]
): EntityLinkSuggestionChain[] {
  const key = (c: EntityLinkSuggestionChain): string =>
    c.steps.map((s) => entityRefKey(s.ref)).join('>')
  const bKeys = new Set(b.map(key))
  return a
    .filter((c) => bKeys.has(key(c)))
    .map((c) => ({ ...c, providerConsensus: true }))
}

/** Prüft, ob ein Paar den Anker berührt (für Tests). */
export function pairTouchesAnchor(
  anchor: ChronellEntityRef,
  fromRef: ChronellEntityRef,
  toRef: ChronellEntityRef
): boolean {
  return entityRefsEqual(anchor, fromRef) || entityRefsEqual(anchor, toRef)
}
