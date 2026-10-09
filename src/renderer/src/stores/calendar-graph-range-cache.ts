/**
 * In-Memory-Cache (TTL) für Graph-Termine pro sichtbarem Kalenderbereich.
 * Ergänzt den Main-Prozess-SQLite-Cache um schnelles Wiederanzeigen beim Navigieren.
 */
import { create } from 'zustand'
import type { CalendarEventView } from '@shared/types'

/** Gleiche TTL wie `CALENDAR_CACHE_STALE_MS` / Mega-Zeitliste. */
export const CALENDAR_GRAPH_RANGE_STALE_MS = 120_000

const MAX_CACHE_ENTRIES = 24

export function buildCalendarGraphRangeCacheKey(
  rangeStart: Date,
  rangeEnd: Date,
  includeCalendars: ReadonlyArray<{ accountId: string; graphCalendarId: string }>,
  hiddenCalendarKeys: ReadonlySet<string>,
  sidebarHiddenCalendarKeys: ReadonlySet<string>
): string {
  const inc = includeCalendars
    .map((r) => `${r.accountId}:${r.graphCalendarId}`)
    .sort()
    .join('|')
  const hidden = [...hiddenCalendarKeys].sort().join('|')
  const sidebar = [...sidebarHiddenCalendarKeys].sort().join('|')
  return `${rangeStart.toISOString()}\n${rangeEnd.toISOString()}\n${inc}\n${hidden}\n${sidebar}`
}

export interface CalendarGraphRangeCacheEntry {
  key: string
  events: CalendarEventView[]
  fetchedAt: number
}

interface CalendarGraphRangeCacheState {
  entries: Map<string, CalendarGraphRangeCacheEntry>

  getFreshEntry: (key: string) => CalendarGraphRangeCacheEntry | null
  getStaleEntry: (key: string) => CalendarGraphRangeCacheEntry | null
  setEntry: (key: string, events: CalendarEventView[]) => void
  clear: () => void
}

function evictOldest(entries: Map<string, CalendarGraphRangeCacheEntry>): void {
  while (entries.size > MAX_CACHE_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest == null) break
    entries.delete(oldest)
  }
}

export const useCalendarGraphRangeCacheStore = create<CalendarGraphRangeCacheState>((set, get) => ({
  entries: new Map(),

  getFreshEntry(key: string): CalendarGraphRangeCacheEntry | null {
    const entry = get().entries.get(key)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt >= CALENDAR_GRAPH_RANGE_STALE_MS) return null
    return entry
  },

  getStaleEntry(key: string): CalendarGraphRangeCacheEntry | null {
    const entry = get().entries.get(key)
    if (!entry || entry.events.length === 0) return null
    return entry
  },

  setEntry(key: string, events: CalendarEventView[]): void {
    const entries = new Map(get().entries)
    entries.set(key, { key, events, fetchedAt: Date.now() })
    evictOldest(entries)
    set({ entries })
  },

  clear(): void {
    set({ entries: new Map() })
  }
}))
