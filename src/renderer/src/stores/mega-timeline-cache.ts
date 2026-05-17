/**
 * In-Memory-Cache (TTL) für die Kalender-Zeitliste — sofortige Anzeige nach Modulwechsel.
 */
import { create } from 'zustand'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItem } from '@shared/work-item'

/** Gleiche TTL wie Posteingangs-Agenda (Modulwechsel). */
export const MEGA_TIMELINE_STALE_MS = 120_000

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

interface MegaTimelineCacheEntry {
  key: string
  items: WorkItem[]
  hiddenMailMessageIds: number[]
  fetchedAt: number
}

interface MegaTimelineCacheState {
  entry: MegaTimelineCacheEntry | null

  getFreshEntry: (key: string) => MegaTimelineCacheEntry | null
  getStaleEntry: (key: string) => MegaTimelineCacheEntry | null
  setEntry: (
    key: string,
    items: WorkItem[],
    hiddenMailMessageIds: number[]
  ) => void
  clear: () => void
}

export const useMegaTimelineCacheStore = create<MegaTimelineCacheState>((set, get) => ({
  entry: null,

  getFreshEntry(key: string): MegaTimelineCacheEntry | null {
    const { entry } = get()
    if (!entry || entry.key !== key) return null
    if (Date.now() - entry.fetchedAt >= MEGA_TIMELINE_STALE_MS) return null
    return entry
  },

  getStaleEntry(key: string): MegaTimelineCacheEntry | null {
    const { entry } = get()
    if (!entry || entry.key !== key || entry.items.length === 0) return null
    return entry
  },

  setEntry(key: string, items: WorkItem[], hiddenMailMessageIds: number[]): void {
    set({
      entry: {
        key,
        items,
        hiddenMailMessageIds,
        fetchedAt: Date.now()
      }
    })
  },

  clear(): void {
    set({ entry: null })
  }
}))
