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
import { readAiConnectionsApiKey, resolveAiModel } from './ai-settings-store'

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

function buildPromptPackage(
  anchorId: string,
  anchor: { id: string; kind: string; fields: Record<string, unknown> },
  candidates: Array<{ candId: string; kind: string; fields: Record<string, unknown> }>,
  includeTextExcerpt: boolean
): { systemPrompt: string; userPrompt: string } {
  const dataPolicy = includeTextExcerpt
    ? 'Es werden Metadaten plus optional ein gekürzter Textauszug (text_excerpt, max. ~500 Zeichen) gesendet – kein vollständiger Mail- oder Notiztext.'
    : 'Es werden NUR Metadaten gesendet (Betreff, Namen, Daten, Kurzinfos) – kein Mail-Volltext.'
  const systemPrompt = `Du bist ein Assistent für Verbindungsvorschläge in einer Produktivitäts-App.
${dataPolicy}
Antworte ausschließlich mit gültigem JSON im Format:
{"suggestions":[{"fromId":"anchor","toId":"cand_1","confidence":0.0,"reason":"ein Satz auf Deutsch"}],"chains":[{"pathIds":["anchor","cand_1","cand_2"],"confidence":0.0,"reason":"ein Satz auf Deutsch"}]}
Regeln:
- Verwende nur fromId/toId aus der Kandidatenliste (cand_1, cand_2, …).
- Mindestens eine Seite jedes Paares muss der Anker (${anchorId}) sein.
- Erfinde keine IDs. Keine Verbindung ohne klaren semantischen oder zeitlichen Bezug.
- confidence zwischen 0 und 1. Maximal 8 Vorschläge, maximal 4 Ketten (2–4 Schritte, pathIds in Reihenfolge).`

  const userPrompt = JSON.stringify(
    {
      anchorId,
      anchor,
      candidates
    },
    null,
    0
  )

  return { systemPrompt, userPrompt }
}

async function filterDismissedSuggestions(
  anchor: ChronellEntityRef,
  suggestions: EntityLinkSuggestion[]
): Promise<EntityLinkSuggestion[]> {
  const out: EntityLinkSuggestion[] = []
  for (const s of suggestions) {
    if (s.reason === 'ai_semantic' && (await isEntityLinkAiDismissed(anchor, s.target))) {
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
  useExcerpt: boolean
): Promise<EntityLinkAiSuggestResult> {
  const apiKey = await readAiConnectionsApiKey(provider)
  if (!apiKey) {
    throw new AiConnectionsError('no_api_key', `Kein API-Schlüssel für ${provider}.`)
  }
  const settings = (await assertAiConnectionsReady()).settings
  const model = resolveAiModel({ ...settings, provider })

  const retrieval = retrieveAiLinkCandidates(anchor, maxCandidates)
  if (!retrieval || retrieval.candidates.length === 0) {
    return { suggestions: [], chains: [] }
  }

  const candidateById = buildCandidateIdMap(retrieval.candidates)
  const anchorCandId = 'anchor'
  const anchorSnap = useExcerpt
    ? enrichSnapshotWithTextExcerpt(anchor, retrieval.anchor)
    : retrieval.anchor
  const promptCandidates = retrieval.candidates.map((c) => {
    const snap = useExcerpt ? enrichSnapshotWithTextExcerpt(c.ref, c.snapshot) : c.snapshot
    return {
      candId: c.candId,
      kind: snap.kind,
      fields: snap.fields
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

  const { systemPrompt, userPrompt } = buildPromptPackage(
    anchorCandId,
    { id: anchorCandId, kind: anchorSnap.kind, fields: anchorSnap.fields },
    promptCandidates,
    useExcerpt
  )

  const rawJson = await completeJson(provider, {
    apiKey,
    model,
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
  maxCandidates: number
): Promise<EntityLinkAiSuggestResult> {
  const { settings } = await assertAiConnectionsReady()
  const useExcerpt = settings.includeSnippet && settings.snippetConsentGiven
  const minConf = settings.minConfidence

  const retrieval = retrieveAiLinkCandidates(anchor, maxCandidates)
  if (!retrieval || retrieval.candidates.length === 0) {
    return { suggestions: [], chains: [] }
  }

  const cacheKey = `${retrievalCacheKey(anchor, retrieval.candidates, resolveAiModel(settings), settings.provider)}|excerpt:${useExcerpt ? '1' : '0'}|min:${minConf}|cmp:${settings.compareProviders ? '1' : '0'}`
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
      runAiSuggestForProvider(anchor, maxCandidates, 'gemini', minConf, useExcerpt),
      runAiSuggestForProvider(anchor, maxCandidates, 'openai', minConf, useExcerpt)
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
    useExcerpt
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
  const maxCandidates =
    typeof input.maxCandidates === 'number'
      ? Math.min(Math.max(input.maxCandidates, 10), 50)
      : 40

  const heuristic = suggestEntityLinks(anchor)

  try {
    const ai = await runAiSuggestForAnchor(anchor, maxCandidates)
    return {
      suggestions: mergeEntityLinkSuggestions(heuristic, ai.suggestions),
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
    typeof input.maxCandidates === 'number' ? input.maxCandidates : 40
  )
}
