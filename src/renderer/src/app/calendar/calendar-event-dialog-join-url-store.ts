import { useSyncExternalStore } from 'react'

export type CalendarEventDialogJoinUrlStore = {
  subscribe: (onStoreChange: () => void) => () => void
  getSnapshot: () => string | null
  set: (url: string | null) => void
}

/** Pro Dialog-Instanz: Join-URL-Updates ohne Full-Tree-Re-Render. */
export function createCalendarEventDialogJoinUrlStore(): CalendarEventDialogJoinUrlStore {
  let url: string | null = null
  const listeners = new Set<() => void>()
  return {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange)
      return (): void => {
        listeners.delete(onStoreChange)
      }
    },
    getSnapshot() {
      return url
    },
    set(next) {
      const normalized = next?.trim() || null
      if (url === normalized) return
      url = normalized
      listeners.forEach((listener) => listener())
    }
  }
}

export function useCalendarEventDialogJoinUrl(
  store: CalendarEventDialogJoinUrlStore
): string | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
