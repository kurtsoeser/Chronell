import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type {
  EntityLinkAiSuggestInput,
  EntityLinkAiSuggestResult,
  EntityLinkSuggestion,
  EntityLinkSuggestionChain
} from '@shared/entity-links'
import type { EntityLinkAiDomainProfileId } from '@shared/ai-link-domain'
import type { AiConnectionsProvider } from '@shared/ai-connections'
import { AiConnectionsError } from '@shared/ai-connections'
import { entityLinkExists, listEntityLinksForAnchor } from '../db/entity-links-repo'
import { suggestEntityLinks } from '../entity-link-suggestions'
import { assertAiConnectionsReady } from './ai-settings-store'
import { enrichSnapshotWithTextExcerpt } from './entity-link-ai-context'
import { isEntityLinkAiDismissed } from './entity-link-ai-dismissed'
import { completeJson } from './ai-provider'
import {
  buildCandidateIdMap,
  retrieveAiLinkCandidates,
  retrievalCacheKey
} from './entity-link-ai-retrieval'
import {
  intersectAiChains,
  intersectAiSuggestions,
  mergeEntityLinkSuggestions,
  parseRawAiChains,
  parseRawAiSuggestions,
  rawChainsToEntityChains,
  rawPairsToEntitySuggestions
} from './entity-link-ai-validate'
import { getAiConnectionsSettings, resolveAiModel } from './ai-settings-store'
import { isEmbeddingPipelineActive } from '@shared/ai-connections'
import { mergeHybridEmbeddingCandidates } from './entity-embeddings-search'
import { resolveLlmMaxCandidatesWithEmbeddings } from './entity-embeddings-index'
import { suggestEntityLinksFromEmbeddings } from './entity-link-embedding-suggest'
import { resolveIncludeExcerpt } from './ai-snippet-policy'
import {
  buildSuggestPromptPackage,
  resolveDomainProfile,
  slimFieldsForPrompt
} from './entity-link-ai-prompts'
import {
  effectiveMaxCandidatesForTier,
  resolveAiPromptTier
} from '@shared/ai-prompt-tier'
import { setPanelSuggestionCount } from './entity-link-suggestion-counts'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface CachedAiSuggest {
  savedAt: number
  suggestions: EntityLinkSuggestion[]
}

function cacheDir(): string {
  return join(app.getPath('userData'), 'ai-link-suggest-cache')
}

function cacheFilePath(key: string): string {
  const hash = createHash('sha256').update(key).digest('hex')
  return join(cacheDir(), `${hash}.json`)
}

async function readCache(key: string): Promise<EntityLinkSuggestion[] | null> {
  const path = cacheFilePath(key)
  if (!existsSync(path)) return null
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as CachedAiSuggest
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.suggestions
  } catch {
    return null
  }
}

async function writeCache(key: string, suggestions: EntityLinkSuggestion[]): Promise<void> {
  const dir = cacheDir()
  await mkdir(dir, { recursive: true })
  const payload: CachedAiSuggest = { savedAt: Date.now(), suggestions }
  await writeFile(cacheFilePath(key), JSON.stringify(payload), 'utf8')
}

async function filterDismissedSuggestions(
  anchor: ChronellEntityRef,
  suggestions: EntityLinkSuggestion[]
): Promise<EntityLinkSuggestion[]> {
  const out: EntityLinkSuggestion[] = []
  for (const s of suggestions) {
    if (
      (s.reason === 'ai_semantic' || s.reason === 'embedding_semantic') &&
      (await isEntityLinkAiDismissed(anchor, s.target))
    ) {
      continue
    }
    out.push(s)
  }
  return out
}

interface CachedAiSuggestFull {
  savedAt: number
  suggestions: EntityLinkSuggestion[]
  chains: EntityLinkSuggestionChain[]
}

async function runAiSuggestForProvider(
  anchor: ChronellEntityRef,
  maxCandidates: number,
  provider: AiConnectionsProvider,
  minConfidence: number,
  useExcerpt: boolean,
  domainProfileId?: EntityLinkAiDomainProfileId | null
): Promise<EntityLinkAiSuggestResult> {
  const ready = await assertAiConnectionsReady()
  const settings = ready.settings
  const model = resolveAiModel({ ...settings, provider })
  if (provider !== 'ollama' && !ready.apiKey) {
    throw new AiConnectionsError('no_api_key', `Kein API-Schlüssel für ${provider}.`)
  }
  const domain = resolveDomainProfile(domainProfileId, settings.customDomainProfiles)
  const tier = resolveAiPromptTier(provider, model)
  const retrievalCap = effectiveMaxCandidatesForTier(tier, maxCandidates)

  let retrieval = retrieveAiLinkCandidates(anchor, retrievalCap, {
    subjectKeywords: domain.subjectKeywords,
    kindBoost: domain.kindBoost
  })
  if (!retrieval || retrieval.candidates.length === 0) {
    return { suggestions: [], chains: [] }
  }

  const aiSettings = await getAiConnectionsSettings()
  if (isEmbeddingPipelineActive(aiSettings)) {
    retrieval = await mergeHybridEmbeddingCandidates(anchor, retrieval, retrievalCap)
  }

  const candidateById = buildCandidateIdMap(retrieval.candidates)
  const anchorCandId = 'anchor'
  const anchorSnap = useExcerpt
    ? enrichSnapshotWithTextExcerpt(anchor, retrieval.anchor)
    : retrieval.anchor
  const promptCandidates = retrieval.candidates.map((c) => {
    const snap = useExcerpt ? enrichSnapshotWithTextExcerpt(c.ref, c.snapshot) : c.snapshot
    const fields =
      tier === 'compact'
        ? slimFieldsForPrompt(snap.fields, useExcerpt)
        : snap.fields
    return {
      candId: c.candId,
      kind: snap.kind,
      fields
    }
  })

  const idMap = new Map([
    [
      'anchor',
      {
        candId: 'anchor',
        ref: anchor,
        snapshot: anchorSnap,
        title: '',
        subtitle: null
      }
    ],
    ...candidateById
  ])

  const anchorFields =
    tier === 'compact'
      ? slimFieldsForPrompt(anchorSnap.fields, useExcerpt)
      : anchorSnap.fields
  const { systemPrompt, userPrompt } = buildSuggestPromptPackage(
    anchorCandId,
    { id: anchorCandId, kind: anchorSnap.kind, fields: anchorFields },
    promptCandidates,
    useExcerpt,
    domain,
    tier
  )

  const rawJson = await completeJson(provider, {
    apiKey: ready.apiKey,
    model,
    ollamaBaseUrl: ready.ollamaBaseUrl,
    systemPrompt: `${systemPrompt}\nDer Anker hat die feste ID "anchor". Kandidaten nutzen cand_* IDs.`,
    userPrompt
  })

  const rawPairs = parseRawAiSuggestions(rawJson)
  const rawChains = parseRawAiChains(rawJson)
  const linkedKeys = new Set(
    listEntityLinksForAnchor(anchor).map((item) => entityRefKey(item.peer))
  )
  linkedKeys.add(entityRefKey(anchor))

  const suggestions = await filterDismissedSuggestions(
    anchor,
    rawPairsToEntitySuggestions(
      anchor,
      rawPairs.filter((p) => p.fromId === 'anchor' || p.toId === 'anchor'),
      idMap,
      linkedKeys,
      entityLinkExists,
      minConfidence
    )
  )
  const chains = rawChainsToEntityChains(anchor, rawChains, idMap, minConfidence)
  return { suggestions, chains }
}

export async function runAiSuggestForAnchor(
  anchor: ChronellEntityRef,
  maxCandidates: number,
  callIncludeExcerpt?: boolean,
  domainProfileId?: EntityLinkAiDomainProfileId | null
): Promise<EntityLinkAiSuggestResult> {
  const { settings } = await assertAiConnectionsReady()
  const useExcerpt = resolveIncludeExcerpt(settings, callIncludeExcerpt)
  const minConf = settings.minConfidence
  const domainId = domainProfileId ?? 'general'

  const retrieval = retrieveAiLinkCandidates(anchor, maxCandidates, {
    subjectKeywords: resolveDomainProfile(domainId, settings.customDomainProfiles).subjectKeywords,
    kindBoost: resolveDomainProfile(domainId, settings.customDomainProfiles).kindBoost
  })
  if (!retrieval || retrieval.candidates.length === 0) {
    return { suggestions: [], chains: [] }
  }

  const cacheKey = `${retrievalCacheKey(anchor, retrieval.candidates, resolveAiModel(settings), settings.provider)}|excerpt:${useExcerpt ? '1' : '0'}|min:${minConf}|cmp:${settings.compareProviders ? '1' : '0'}|domain:${domainId}`
  const path = cacheFilePath(cacheKey)
  if (existsSync(path)) {
    try {
      const raw = await readFile(path, 'utf8')
      const parsed = JSON.parse(raw) as CachedAiSuggestFull
      if (Date.now() - parsed.savedAt <= CACHE_TTL_MS) {
        return {
          suggestions: await filterDismissedSuggestions(anchor, parsed.suggestions),
          chains: parsed.chains
        }
      }
    } catch {
      /* */
    }
  }

  if (settings.compareProviders) {
    const [gemini, openai] = await Promise.all([
      runAiSuggestForProvider(anchor, maxCandidates, 'gemini', minConf, useExcerpt, domainId),
      runAiSuggestForProvider(anchor, maxCandidates, 'openai', minConf, useExcerpt, domainId)
    ])
    const result = {
      suggestions: intersectAiSuggestions(gemini.suggestions, openai.suggestions),
      chains: intersectAiChains(gemini.chains, openai.chains)
    }
    await writeFile(
      path,
      JSON.stringify({ savedAt: Date.now(), ...result } satisfies CachedAiSuggestFull),
      'utf8'
    )
    return result
  }

  const result = await runAiSuggestForProvider(
    anchor,
    maxCandidates,
    settings.provider,
    minConf,
    useExcerpt,
    domainId
  )
  await writeFile(
    path,
    JSON.stringify({ savedAt: Date.now(), ...result } satisfies CachedAiSuggestFull),
    'utf8'
  )
  return result
}

export async function suggestEntityLinksAi(
  input: EntityLinkAiSuggestInput
): Promise<EntityLinkAiSuggestResult> {
  const anchor = input.anchor
  const settings = await getAiConnectionsSettings()
  const baseMax =
    typeof input.maxCandidates === 'number'
      ? Math.min(Math.max(input.maxCandidates, 10), 50)
      : 40
  const maxCandidates = resolveLlmMaxCandidatesWithEmbeddings(
    baseMax,
    isEmbeddingPipelineActive(settings)
  )

  const heuristic = suggestEntityLinks(anchor)
  const embeddingSuggestions = await suggestEntityLinksFromEmbeddings(
    anchor,
    settings.minConfidence
  )

  if (!settings.enabled) {
    return {
      suggestions: mergeEntityLinkSuggestions(heuristic, embeddingSuggestions),
      chains: []
    }
  }

  try {
    const ai = await runAiSuggestForAnchor(
      anchor,
      maxCandidates,
      input.includeExcerpt,
      input.domainProfileId
    )
    const merged = mergeEntityLinkSuggestions(
      mergeEntityLinkSuggestions(heuristic, embeddingSuggestions),
      ai.suggestions
    )
    const aiOnly = merged.filter((s) => s.reason === 'ai_semantic').length
    if (aiOnly > 0) {
      await setPanelSuggestionCount(anchor, aiOnly + ai.chains.length)
    }
    return {
      suggestions: merged,
      chains: ai.chains
    }
  } catch (err) {
    if (err instanceof AiConnectionsError) throw err
    throw new AiConnectionsError(
      'invalid_response',
      err instanceof Error ? err.message : 'KI-Vorschläge fehlgeschlagen.'
    )
  }
}

export async function suggestEntityLinksAiOnly(
  input: EntityLinkAiSuggestInput
): Promise<EntityLinkAiSuggestResult> {
  return runAiSuggestForAnchor(
    input.anchor,
    typeof input.maxCandidates === 'number' ? input.maxCandidates : 40,
    input.includeExcerpt,
    input.domainProfileId
  )
}
