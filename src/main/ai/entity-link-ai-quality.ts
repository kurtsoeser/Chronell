import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type {
  EntityLinkEvaluateQualityInput,
  EntityLinkEvaluateQualityResult,
  EntityLinkQuality,
  EntityLinkQualityAssessment
} from '@shared/ai-link-domain'
import { AiConnectionsError } from '@shared/ai-connections'
import { listEntityLinksForAnchor } from '../db/entity-links-repo'
import { assertAiConnectionsReady } from './ai-settings-store'
import { buildAnchorSnapshot, enrichSnapshotWithTextExcerpt } from './entity-link-ai-context'
import { buildQualityPromptPackage, slimFieldsForPrompt } from './entity-link-ai-prompts'
import {
  effectiveMaxQualityLinksForTier,
  resolveAiPromptTier
} from '@shared/ai-prompt-tier'
import { resolveIncludeExcerpt } from './ai-snippet-policy'
import { completeJson } from './ai-provider'
import { appendEntityLinkAiAudit } from '../db/entity-link-ai-audit-repo'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface CachedQuality {
  savedAt: number
  assessments: EntityLinkQualityAssessment[]
}

const VALID_QUALITY = new Set<EntityLinkQuality>(['strong', 'moderate', 'weak', 'questionable'])

export interface RawAiLinkQualityRow {
  linkId: string
  quality: EntityLinkQuality
  confidence: number
  reason: string
}

export function parseRawAiLinkQuality(payload: unknown): RawAiLinkQualityRow[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { evaluations?: unknown }
  if (!Array.isArray(root.evaluations)) return []
  const out: RawAiLinkQualityRow[] = []
  for (const item of root.evaluations) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const linkId = typeof row.linkId === 'string' ? row.linkId.trim() : ''
    const quality = typeof row.quality === 'string' ? row.quality.trim() : ''
    const confidence =
      typeof row.confidence === 'number'
        ? row.confidence
        : typeof row.confidence === 'string'
          ? Number(row.confidence)
          : NaN
    const reason = typeof row.reason === 'string' ? row.reason.trim() : ''
    if (!linkId || !VALID_QUALITY.has(quality as EntityLinkQuality) || !Number.isFinite(confidence)) {
      continue
    }
    out.push({
      linkId,
      quality: quality as EntityLinkQuality,
      confidence,
      reason
    })
  }
  return out
}

function cacheDir(): string {
  return join(app.getPath('userData'), 'ai-link-quality-cache')
}

function cachePath(key: string): string {
  const hash = createHash('sha256').update(key).digest('hex')
  return join(cacheDir(), `${hash}.json`)
}

export async function evaluateEntityLinkQuality(
  input: EntityLinkEvaluateQualityInput
): Promise<EntityLinkEvaluateQualityResult> {
  const anchor = input.anchor
  const { settings, apiKey, model, ollamaBaseUrl } = await assertAiConnectionsReady()
  const useExcerpt = resolveIncludeExcerpt(settings, input.includeExcerpt)
  const links = listEntityLinksForAnchor(anchor)
  if (links.length === 0) return { assessments: [] }

  const cacheKey = `${entityRefKey(anchor)}|excerpt:${useExcerpt ? '1' : '0'}|links:${links.map((l) => l.linkId).join(',')}`
  const path = cachePath(cacheKey)
  if (existsSync(path)) {
    try {
      const raw = await readFile(path, 'utf8')
      const parsed = JSON.parse(raw) as CachedQuality
      if (Date.now() - parsed.savedAt <= CACHE_TTL_MS) {
        return { assessments: parsed.assessments }
      }
    } catch {
      /* */
    }
  }

  const anchorSnapRaw = buildAnchorSnapshot(anchor)
  if (!anchorSnapRaw) return { assessments: [] }
  const anchorSnap = useExcerpt
    ? enrichSnapshotWithTextExcerpt(anchor, anchorSnapRaw)
    : anchorSnapRaw
  const tier = resolveAiPromptTier(settings.provider, model)
  const maxLinks = effectiveMaxQualityLinksForTier(tier)

  const linkRows: Array<{
    linkId: string
    kind: string
    fields: Record<string, unknown>
    title: string
    numericId: number
    peer: ChronellEntityRef
  }> = []

  for (let i = 0; i < Math.min(links.length, maxLinks); i++) {
    const item = links[i]!
    const snap = buildAnchorSnapshot(item.peer)
    if (!snap) continue
    const enriched = useExcerpt ? enrichSnapshotWithTextExcerpt(item.peer, snap) : snap
    linkRows.push({
      linkId: `link_${i + 1}`,
      kind: enriched.kind,
      fields:
        tier === 'compact'
          ? slimFieldsForPrompt(enriched.fields, useExcerpt)
          : enriched.fields,
      title: item.title,
      numericId: item.linkId,
      peer: item.peer
    })
  }

  if (linkRows.length === 0) return { assessments: [] }

  const anchorFields =
    tier === 'compact'
      ? slimFieldsForPrompt(anchorSnap.fields, useExcerpt)
      : anchorSnap.fields
  const { systemPrompt, userPrompt } = buildQualityPromptPackage(
    'anchor',
    { id: 'anchor', kind: anchorSnap.kind, fields: anchorFields },
    linkRows.map((r) => ({
      linkId: r.linkId,
      kind: r.kind,
      fields: r.fields,
      title: r.title
    })),
    useExcerpt,
    tier
  )

  const rawJson = await completeJson(settings.provider, {
    apiKey,
    model,
    ollamaBaseUrl,
    systemPrompt: `${systemPrompt}\nDer Anker hat die feste ID "anchor".`,
    userPrompt
  })

  const parsed = parseRawAiLinkQuality(rawJson)
  const byPromptId = new Map(linkRows.map((r) => [r.linkId, r]))
  const assessments: EntityLinkQualityAssessment[] = []
  for (const row of parsed) {
    const meta = byPromptId.get(row.linkId)
    if (!meta) continue
    assessments.push({
      linkId: meta.numericId,
      peer: meta.peer,
      title: meta.title,
      quality: row.quality,
      confidence: Math.min(1, Math.max(0, row.confidence)),
      reasonText: row.reason || undefined
    })
  }

  await mkdir(cacheDir(), { recursive: true })
  await writeFile(
    path,
    JSON.stringify({ savedAt: Date.now(), assessments } satisfies CachedQuality),
    'utf8'
  )

  void appendEntityLinkAiAudit({
    kind: 'evaluate_quality',
    anchorKey: entityRefKey(anchor),
    provider: settings.provider,
    charEstimate: linkRows.length * 400,
    includeExcerpt: useExcerpt
  })

  return { assessments }
}
