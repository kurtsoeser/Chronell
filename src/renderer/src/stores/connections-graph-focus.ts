import { create } from 'zustand'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'

interface ConnectionsGraphFocusState {
  highlightKey: string | null
  /** Temporäre Mehrfach-Hervorhebung (z. B. Scan-Vorschlag Anker + Ziel). */
  emphasisKeys: string[] | null
  /** Viewport auf diese Knoten zentrieren (einmalig). */
  fitToKeys: string[] | null
  setHighlightRef: (ref: ChronellEntityRef | null) => void
  setEmphasisKeys: (keys: string[] | null) => void
  requestFitToKeys: (keys: string[]) => void
  clearFitToKeys: () => void
}

export const useConnectionsGraphFocusStore = create<ConnectionsGraphFocusState>((set) => ({
  highlightKey: null,
  emphasisKeys: null,
  fitToKeys: null,
  setHighlightRef(ref): void {
    set({ highlightKey: ref ? entityRefKey(ref) : null })
  },
  setEmphasisKeys(keys): void {
    set({ emphasisKeys: keys?.length ? keys : null })
  },
  requestFitToKeys(keys): void {
    set({ fitToKeys: keys.length ? [...keys] : null })
  },
  clearFitToKeys(): void {
    set({ fitToKeys: null })
  }
}))
