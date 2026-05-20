import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type {
  EntityLinkSuggestionCountEntry,
  EntityLinkSuggestionCountSource
} from '@shared/entity-link-ai-payload'
import type { EntityLinkAiScanItem } from '@shared/entity-links'
import { suggestEntityLinks } from '../entity-link-suggestions'

const HEURISTIC_CACHE_TTL_MS = 60 * 60 * 1000
const PANEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const SCAN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CountCacheFile {
  savedAt: number
  entries: Record<string, number>
}

function heuristicCachePath(): string {
  return join(app.getPath('userData'), 'ai-heuristic-suggestion-counts.json')
}

function panelCachePath(): string {
  return join(app.getPath('userData'), 'ai-panel-suggestion-counts.json')
}

function scanCachePath(): string {
  return join(app.getPath('userData'), 'ai-link-scan-cache', 'last-scan.json')
}

async function readCountFile(path: string, ttlMs: number): Promise<Record<string, number> | null> {
  if (!existsSync(path)) return null
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as CountCacheFile
    if (Date.now() - parsed.savedAt > ttlMs) return null
    return parsed.entries
  } catch {
    return null
  }
}

async function writeCountFile(path: string, entries: Record<string, number>): Promise<void> {
  await mkdir(join(app.getPath('userData')), { recursive: true })
  const payload: CountCacheFile = { savedAt: Date.now(), entries }
  await writeFile(path, JSON.stringify(payload), 'utf8')
}

/** Heuristische Vorschlagsanzahl (Phase A – kein LLM). */
export function countHeuristicSuggestions(anchor: ChronellEntityRef): number {
  return suggestEntityLinks(anchor).length
}

async function loadScanCountsByAnchor(): Promise<Record<string, number>> {
  const path = scanCachePath()
  if (!existsSync(path)) return {}
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as { savedAt?: number; items?: EntityLinkAiScanItem[] }
    if (parsed.savedAt && Date.now() - parsed.savedAt > SCAN_CACHE_TTL_MS) return {}
    const items = Array.isArray(parsed.items) ? parsed.items : []
    const out: Record<string, number> = {}
    for (const item of items) {
      const key = entityRefKey(item.anchor)
      out[key] = (out[key] ?? 0) + 1
    }
    return out
  } catch {
    return {}
  }
}

function pickSource(
  heuristic: number,
  scan: number,
  panel: number
): { count: number; source: EntityLinkSuggestionCountSource } {
  const scanN = scan ?? 0
  const panelN = panel ?? 0
  const h = heuristic ?? 0
  if (scanN >= panelN && scanN >= h && scanN > 0) {
    return { count: scanN, source: 'ai_scan' }
  }
  if (panelN >= h && panelN > 0) {
    return { count: panelN, source: 'ai_panel' }
  }
  if (h > 0) return { count: h, source: 'heuristic' }
  return { count: 0, source: 'heuristic' }
}

export async function setPanelSuggestionCount(
  anchor: ChronellEntityRef,
  count: number
): Promise<void> {
  const key = entityRefKey(anchor)
  const cached = (await readCountFile(panelCachePath(), PANEL_CACHE_TTL_MS)) ?? {}
  if (count <= 0) {
    delete cached[key]
  } else {
    cached[key] = count
  }
  await writeCountFile(panelCachePath(), cached)
}

export async function getEntityLinkSuggestionCounts(
  anchors: ChronellEntityRef[]
): Promise<EntityLinkSuggestionCountEntry[]> {
  if (anchors.length === 0) return []

  const [heuristicCached, panelCached, scanCached] = await Promise.all([
    readCountFile(heuristicCachePath(), HEURISTIC_CACHE_TTL_MS),
    readCountFile(panelCachePath(), PANEL_CACHE_TTL_MS),
    loadScanCountsByAnchor()
  ])

  const mergedHeuristic: Record<string, number> = { ...(heuristicCached ?? {}) }
  const toCompute: ChronellEntityRef[] = []

  for (const anchor of anchors) {
    const key = entityRefKey(anchor)
    if (heuristicCached && key in heuristicCached) continue
    if (anchor.kind === 'mail' || anchor.kind === 'mail_todo') {
      toCompute.push(anchor)
    }
  }

  for (const anchor of toCompute) {
    const key = entityRefKey(anchor)
    mergedHeuristic[key] = countHeuristicSuggestions(anchor)
  }

  if (toCompute.length > 0) {
    await writeCountFile(heuristicCachePath(), mergedHeuristic)
  }

  const out: EntityLinkSuggestionCountEntry[] = []
  for (const anchor of anchors) {
    const key = entityRefKey(anchor)
    const h = mergedHeuristic[key] ?? 0
    const scan = scanCached[key] ?? 0
    const panel = panelCached?.[key] ?? 0
    const { count, source } = pickSource(h, scan, panel)
    out.push({ anchorKey: key, count, source })
  }

  return out
}

/** @deprecated Alias – nutzt merge aus Heuristik, Scan und Panel. */
export async function getHeuristicSuggestionCounts(
  anchors: ChronellEntityRef[]
): Promise<EntityLinkSuggestionCountEntry[]> {
  return getEntityLinkSuggestionCounts(anchors)
}

/** Heuristik-Cache leeren (nach Link-Änderung / Scan-Ende). */
export async function invalidateHeuristicSuggestionCountCache(): Promise<void> {
  await writeCountFile(heuristicCachePath(), {})
}

/** Heuristik + Panel-Cache leeren. */
export async function invalidateSuggestionCountCaches(): Promise<void> {
  await Promise.all([
    invalidateHeuristicSuggestionCountCache(),
    writeCountFile(panelCachePath(), {})
  ])
}
