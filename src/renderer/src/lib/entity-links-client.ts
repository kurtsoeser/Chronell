import { IPC } from '@shared/ipc-channels'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type {
  EntityGraphSnapshot,
  EntityLinkAiDismissInput,
  EntityLinkAiScanCostEstimate,
  EntityLinkAiScanInput,
  EntityLinkAiScanStatus,
  EntityLinkAiSuggestInput,
  EntityLinkAiSuggestResult,
  EntityLinkEvaluateQualityInput,
  EntityLinkEvaluateQualityResult,
  EntityLinkGraphDensityStats,
  EntityLinkPathInput,
  EntityLinkPathResult,
  EntityLinkSuggestion,
  EntityNeighborhoodInput,
  EntityPaletteListInput,
  EntityLinkTargetCandidate
} from '@shared/entity-links'
import type { AiConnectionsSettings } from '@shared/ai-connections'
import type {
  EntityLinkAiPayloadPreview,
  EntityLinkAiPayloadPreviewInput,
  EntityLinkSuggestionCountEntry
} from '@shared/entity-link-ai-payload'

type EntityLinksEventsApi = {
  onEntityLinksChanged?: (handler: () => void) => () => void
  onEntityLinkAiScanProgress?: (handler: (status: EntityLinkAiScanStatus) => void) => () => void
}

const entityLinksChangedSubscribers = new Set<() => void>()
let entityLinksChangedIpcUnsub: (() => void) | null = null

function notifyEntityLinksChangedSubscribers(): void {
  for (const fn of entityLinksChangedSubscribers) {
    fn()
  }
}

function ensureEntityLinksChangedIpc(): void {
  if (entityLinksChangedIpcUnsub != null) return
  const register = (window.mailClient?.events as EntityLinksEventsApi | undefined)
    ?.onEntityLinksChanged
  if (typeof register !== 'function') return
  entityLinksChangedIpcUnsub = register(notifyEntityLinksChangedSubscribers)
}

const entityLinkAiScanProgressSubscribers = new Set<(status: EntityLinkAiScanStatus) => void>()
let entityLinkAiScanProgressIpcUnsub: (() => void) | null = null

function notifyEntityLinkAiScanProgressSubscribers(status: EntityLinkAiScanStatus): void {
  for (const fn of entityLinkAiScanProgressSubscribers) {
    fn(status)
  }
}

function ensureEntityLinkAiScanProgressIpc(): void {
  if (entityLinkAiScanProgressIpcUnsub != null) return
  const register = (window.mailClient?.events as EntityLinksEventsApi | undefined)
    ?.onEntityLinkAiScanProgress
  if (typeof register !== 'function') return
  entityLinkAiScanProgressIpcUnsub = register(notifyEntityLinkAiScanProgressSubscribers)
}

/**
 * Abo auf entity-links:changed. Ein IPC-Listener im Preload, viele Renderer-Subscriber
 * (vermeidet MaxListenersExceededWarning auf ipcRenderer).
 */
export function subscribeEntityLinksChanged(onChange: () => void): () => void {
  entityLinksChangedSubscribers.add(onChange)
  ensureEntityLinksChangedIpc()
  return (): void => {
    entityLinksChangedSubscribers.delete(onChange)
    if (entityLinksChangedSubscribers.size === 0) {
      entityLinksChangedIpcUnsub?.()
      entityLinksChangedIpcUnsub = null
    }
  }
}

/** Graph-Snapshot; nutzt invoke-Fallback wenn das Preload noch keine listGraph-Methode hat. */
export async function fetchEntityLinksGraph(): Promise<EntityGraphSnapshot> {
  const listGraph = window.mailClient?.entityLinks?.listGraph
  if (typeof listGraph === 'function') {
    return listGraph()
  }
  const raw = await window.mailClient.invoke(IPC.entityLinks.listGraph)
  return raw as EntityGraphSnapshot
}

export async function fetchEntityNeighborhood(
  input: EntityNeighborhoodInput
): Promise<EntityGraphSnapshot> {
  const fn = window.mailClient?.entityLinks?.listNeighborhood
  if (typeof fn === 'function') return fn(input)
  const raw = await window.mailClient.invoke(IPC.entityLinks.listNeighborhood, input)
  return raw as EntityGraphSnapshot
}

export async function fetchEntityLinkPath(
  input: EntityLinkPathInput
): Promise<EntityLinkPathResult | null> {
  const fn = window.mailClient?.entityLinks?.findPath
  if (typeof fn === 'function') return fn(input)
  const raw = await window.mailClient.invoke(IPC.entityLinks.findPath, input)
  return raw as EntityLinkPathResult | null
}

export async function fetchEntityLinkSuggestions(
  anchor: ChronellEntityRef
): Promise<EntityLinkSuggestion[]> {
  const fn = window.mailClient?.entityLinks?.suggest
  if (typeof fn === 'function') return fn(anchor)
  const raw = await window.mailClient.invoke(IPC.entityLinks.suggest, anchor)
  return raw as EntityLinkSuggestion[]
}

export async function fetchEntityLinkQuality(
  input: EntityLinkEvaluateQualityInput
): Promise<EntityLinkEvaluateQualityResult> {
  const fn = window.mailClient?.entityLinks?.evaluateLinkQuality
  if (typeof fn === 'function') return fn(input)
  const raw = await window.mailClient.invoke(IPC.entityLinks.evaluateLinkQuality, input)
  return raw as EntityLinkEvaluateQualityResult
}

export async function fetchEntityLinkAiSuggestions(
  input: EntityLinkAiSuggestInput
): Promise<EntityLinkAiSuggestResult> {
  const fn = window.mailClient?.entityLinks?.suggestAi
  if (typeof fn === 'function') return fn(input)
  const raw = await window.mailClient.invoke(IPC.entityLinks.suggestAi, input)
  return raw as EntityLinkAiSuggestResult
}

export async function fetchEntityLinkGraphDensityStats(
  lookbackDays: number
): Promise<EntityLinkGraphDensityStats> {
  const raw = await window.mailClient.invoke(
    IPC.entityLinks.getGraphDensityStats,
    lookbackDays
  )
  return raw as EntityLinkGraphDensityStats
}

export async function estimateEntityLinkAiScanCost(
  input?: EntityLinkAiScanInput
): Promise<EntityLinkAiScanCostEstimate> {
  const raw = await window.mailClient.invoke(IPC.entityLinks.estimateAiScanCost, input ?? {})
  return raw as EntityLinkAiScanCostEstimate
}

export async function fetchEntityLinkAiPayloadPreview(
  input: EntityLinkAiPayloadPreviewInput
): Promise<EntityLinkAiPayloadPreview | null> {
  const fn = window.mailClient?.entityLinks?.previewAiPayload
  if (typeof fn === 'function') return fn(input)
  const raw = await window.mailClient.invoke(IPC.entityLinks.previewAiPayload, input)
  return raw as EntityLinkAiPayloadPreview | null
}

export async function fetchEntityLinkSuggestionCounts(
  anchors: ChronellEntityRef[]
): Promise<EntityLinkSuggestionCountEntry[]> {
  const fn = window.mailClient?.entityLinks?.getHeuristicSuggestionCounts
  if (typeof fn === 'function') return fn(anchors)
  const raw = await window.mailClient.invoke(IPC.entityLinks.getHeuristicSuggestionCounts, anchors)
  return raw as EntityLinkSuggestionCountEntry[]
}

/** @deprecated Alias */
export const fetchHeuristicSuggestionCounts = fetchEntityLinkSuggestionCounts

export async function fetchAiConnectionsSettings(): Promise<AiConnectionsSettings> {
  const fn = window.mailClient?.aiConnections?.getSettings
  if (typeof fn === 'function') return fn()
  const raw = await window.mailClient.invoke(IPC.aiConnections.getSettings)
  return raw as AiConnectionsSettings
}

export async function startEntityLinkAiScan(
  input?: EntityLinkAiScanInput
): Promise<EntityLinkAiScanStatus> {
  const fn = window.mailClient?.entityLinks?.startAiScan
  if (typeof fn === 'function') return fn(input)
  const raw = await window.mailClient.invoke(IPC.entityLinks.startAiScan, input ?? {})
  return raw as EntityLinkAiScanStatus
}

export async function cancelEntityLinkAiScan(): Promise<EntityLinkAiScanStatus> {
  const fn = window.mailClient?.entityLinks?.cancelAiScan
  if (typeof fn === 'function') return fn()
  const raw = await window.mailClient.invoke(IPC.entityLinks.cancelAiScan)
  return raw as EntityLinkAiScanStatus
}

export async function fetchEntityLinkAiScanStatus(): Promise<EntityLinkAiScanStatus> {
  const fn = window.mailClient?.entityLinks?.getAiScanStatus
  if (typeof fn === 'function') return fn()
  const raw = await window.mailClient.invoke(IPC.entityLinks.getAiScanStatus)
  return raw as EntityLinkAiScanStatus
}

export async function acceptEntityLinkAiScanItems(itemIds: string[]): Promise<number> {
  const fn = window.mailClient?.entityLinks?.acceptAiScanItems
  if (typeof fn === 'function') return fn(itemIds)
  const raw = await window.mailClient.invoke(IPC.entityLinks.acceptAiScanItems, itemIds)
  return raw as number
}

export async function dismissEntityLinkAiScanItems(itemIds: string[]): Promise<number> {
  const fn = window.mailClient?.entityLinks?.dismissAiScanItems
  if (typeof fn === 'function') return fn(itemIds)
  const raw = await window.mailClient.invoke(IPC.entityLinks.dismissAiScanItems, itemIds)
  return raw as number
}

export async function dismissEntityLinkAiSuggestion(
  input: EntityLinkAiDismissInput
): Promise<void> {
  const fn = window.mailClient?.entityLinks?.dismissAiSuggestion
  if (typeof fn === 'function') return fn(input)
  await window.mailClient.invoke(IPC.entityLinks.dismissAiSuggestion, input)
}

export function subscribeEntityLinkAiScanProgress(
  onProgress: (status: EntityLinkAiScanStatus) => void
): () => void {
  entityLinkAiScanProgressSubscribers.add(onProgress)
  ensureEntityLinkAiScanProgressIpc()
  return (): void => {
    entityLinkAiScanProgressSubscribers.delete(onProgress)
    if (entityLinkAiScanProgressSubscribers.size === 0) {
      entityLinkAiScanProgressIpcUnsub?.()
      entityLinkAiScanProgressIpcUnsub = null
    }
  }
}

export async function fetchEntityPaletteList(
  input: EntityPaletteListInput
): Promise<EntityLinkTargetCandidate[]> {
  const fn = window.mailClient?.entityLinks?.listPalette
  if (typeof fn === 'function') return fn(input)
  const raw = await window.mailClient.invoke(IPC.entityLinks.listPalette, input)
  return raw as EntityLinkTargetCandidate[]
}
