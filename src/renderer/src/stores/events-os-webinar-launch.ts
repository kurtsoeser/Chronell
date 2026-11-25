import { create } from 'zustand'
import type { ChronellWebinarLaunch } from '@shared/chronell-protocol'

type EventsOsWebinarLaunchState = {
  pending: ChronellWebinarLaunch | null
  request: (launch: ChronellWebinarLaunch) => void
  consume: () => ChronellWebinarLaunch | null
}

export const useEventsOsWebinarLaunchStore = create<EventsOsWebinarLaunchState>((set, get) => ({
  pending: null,
  request: (launch): void => set({ pending: launch }),
  consume: (): ChronellWebinarLaunch | null => {
    const current = get().pending
    if (current) set({ pending: null })
    return current
  }
}))
