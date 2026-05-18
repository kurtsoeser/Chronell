/**
 * In-Memory-Cache (TTL) für Kalender-Zeitliste und Gantt-Zeitleiste.
 */
import { create } from 'zustand'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItem } from '@shared/work-item'

/** Gleiche TTL wie Posteingangs-Agenda (Modulwechsel). */
export const MEGA_TIMELINE_STALE_MS = 120_000

const MAX_CACHE_ENTRIES = 16

export function buildMegaTimelineCacheKey(
  taskAccounts: ConnectedAccount[],
  rangeStart: Date,
  rangeEnd: Date,
  includeCompletedMail: boolean
): string {
  const ids = taskAccounts
    .map((a) => a.id)
    .sort()
    .join('\u001f')
  return `${ids}\n${rangeStart.toISOString()}\n${rangeEnd.toISOString()}\n${includeCompletedMail ? 1 : 0}`
}

export interface MegaTimelineCacheEntry {
  key: string
  items: WorkItem[]
  hiddenMailMessageIds: number[]
  fetchedAt: number
}

interface MegaTimelineCacheState {
  entries: Map<string, MegaTimelineCacheEntry>

  getFreshEntry: (key: string) => MegaTimelineCacheEntry | null
  getStaleEntry: (key: string) => MegaTimelineCacheEntry | null
  setEntry: (
    key: string,
    items: WorkItem[],
    hiddenMailMessageIds: number[]
  ) => void
  clear: () => void
}

function evictOldest(entries: Map<string, MegaTimelineCacheEntry>): void {
  while (entries.size > MAX_CACHE_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest == null) break
    entries.delete(oldest)
  }
}

export const useMegaTimelineCacheStore = create<MegaTimelineCacheState>((set, get) => ({
  entries: new Map(),

  getFreshEntry(key: string): MegaTimelineCacheEntry | null {
    const entry = get().entries.get(key)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt >= MEGA_TIMELINE_STALE_MS) return null
    return entry
  },

  getStaleEntry(key: string): MegaTimelineCacheEntry | null {
    const entry = get().entries.get(key)
    if (!entry || entry.items.length === 0) return null
    return entry
  },

  setEntry(key: string, items: WorkItem[], hiddenMailMessageIds: number[]): void {
    const entries = new Map(get().entries)
    entries.set(key, {
      key,
      items,
      hiddenMailMessageIds,
      fetchedAt: Date.now()
    })
    evictOldest(entries)
    set({ entries })
  },

  clear(): void {
    set({ entries: new Map() })
  }
}))
