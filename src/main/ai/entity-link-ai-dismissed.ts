import { app } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { canonicalEntityRefPair, entityRefKey } from '@shared/entity-ref'

export interface EntityLinkAiDismissedPair {
  anchorKey: string
  peerKey: string
  dismissedAt: string
}

function dismissedPath(): string {
  return join(app.getPath('userData'), 'ai-link-dismissed.json')
}

let cache: EntityLinkAiDismissedPair[] | null = null

async function loadAll(): Promise<EntityLinkAiDismissedPair[]> {
  if (cache) return cache
  const path = dismissedPath()
  if (!existsSync(path)) {
    cache = []
    return cache
  }
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as { pairs?: unknown }
    if (!Array.isArray(parsed.pairs)) {
      cache = []
      return cache
    }
    cache = parsed.pairs.filter(
      (p): p is EntityLinkAiDismissedPair =>
        p != null &&
        typeof p === 'object' &&
        typeof (p as EntityLinkAiDismissedPair).anchorKey === 'string' &&
        typeof (p as EntityLinkAiDismissedPair).peerKey === 'string'
    )
    return cache
  } catch {
    cache = []
    return cache
  }
}

async function persist(pairs: EntityLinkAiDismissedPair[]): Promise<void> {
  cache = pairs
  const dir = app.getPath('userData')
  await mkdir(dir, { recursive: true })
  await writeFile(dismissedPath(), JSON.stringify({ pairs }, null, 2), 'utf8')
}

export function dismissedPairKey(a: ChronellEntityRef, b: ChronellEntityRef): string {
  const [left, right] = canonicalEntityRefPair(a, b)
  return `${entityRefKey(left)}|${entityRefKey(right)}`
}

export async function isEntityLinkAiDismissed(
  anchor: ChronellEntityRef,
  peer: ChronellEntityRef
): Promise<boolean> {
  const key = dismissedPairKey(anchor, peer)
  const pairs = await loadAll()
  return pairs.some((p) => `${p.anchorKey}|${p.peerKey}` === key)
}

export async function dismissEntityLinkAiSuggestion(
  anchor: ChronellEntityRef,
  peer: ChronellEntityRef
): Promise<void> {
  const [left, right] = canonicalEntityRefPair(anchor, peer)
  const anchorKey = entityRefKey(left)
  const peerKey = entityRefKey(right)
  const pairs = await loadAll()
  const key = `${anchorKey}|${peerKey}`
  if (pairs.some((p) => `${p.anchorKey}|${p.peerKey}` === key)) return
  pairs.push({ anchorKey, peerKey, dismissedAt: new Date().toISOString() })
  await persist(pairs)
}

export async function listDismissedPairsForBackup(): Promise<EntityLinkAiDismissedPair[]> {
  return [...(await loadAll())]
}

export async function replaceDismissedPairsFromBackup(
  pairs: EntityLinkAiDismissedPair[]
): Promise<void> {
  await persist([...pairs])
}

export function invalidateDismissedCache(): void {
  cache = null
}
