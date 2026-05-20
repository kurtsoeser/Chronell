import { create } from 'zustand'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityLinkAiScanAnchor } from '@shared/entity-links'

interface ConnectionsGraphFocusState {
  highlightKey: string | null
  /** Temporäre Mehrfach-Hervorhebung (z. B. Scan-Vorschlag Anker + Ziel). */
  emphasisKeys: string[] | null
  /** Viewport auf diese Knoten zentrieren (einmalig). */
  fitToKeys: string[] | null
  /** Scan-Panel mit diesen Ankern öffnen (einmalig). */
  pendingScanAnchors: EntityLinkAiScanAnchor[] | null
  /** Scan nach Öffnen des Panels automatisch starten (einmalig). */
  pendingAutoStartScan: boolean
  setHighlightRef: (ref: ChronellEntityRef | null) => void
  setEmphasisKeys: (keys: string[] | null) => void
  requestFitToKeys: (keys: string[]) => void
  clearFitToKeys: () => void
  requestAiScanForRefs: (
    refs: ChronellEntityRef[],
    titles?: Map<string, string>,
    opts?: { autoStart?: boolean }
  ) => void
  clearPendingAiScan: () => void
}

export const useConnectionsGraphFocusStore = create<ConnectionsGraphFocusState>((set) => ({
  highlightKey: null,
  emphasisKeys: null,
  fitToKeys: null,
  pendingScanAnchors: null,
  pendingAutoStartScan: false,
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
  },
  requestAiScanForRefs(refs, titles, opts): void {
    const anchors = refs.slice(0, 50).map((ref) => {
      const key = entityRefKey(ref)
      return {
        ref,
        title: titles?.get(key) ?? key
      }
    })
    set({
      pendingScanAnchors: anchors.length ? anchors : null,
      pendingAutoStartScan: opts?.autoStart === true
    })
  },
  clearPendingAiScan(): void {
    set({ pendingScanAnchors: null, pendingAutoStartScan: false })
  }
}))
