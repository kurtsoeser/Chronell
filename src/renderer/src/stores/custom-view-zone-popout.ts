import { create } from 'zustand'
import {
  dockCustomViewZonePopout,
  openCustomViewZonePopout,
  parseCustomViewZonePopoutInstanceKey
} from '@/lib/custom-view-zone-popout'
import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import { layoutStudioPanelTitleKey } from '@/app/layout-studio/layout-studio-panel-ids'
import i18n from '@/i18n'

type PoppedKey = string

function poppedKey(viewId: string, leafId: string): PoppedKey {
  return `${viewId}::${leafId}`
}

interface CustomViewZonePopoutState {
  popped: Set<PoppedKey>
  isZonePoppedOut: (viewId: string, leafId: string) => boolean
  popOutZone: (viewId: string, leafId: string, panelId: LayoutStudioPanelId) => Promise<void>
  dockZone: (viewId: string, leafId: string) => Promise<void>
  clearPopped: (viewId: string, leafId: string) => void
  handlePopoutClosed: (instanceKey: string) => void
  clearViewPopouts: (viewId: string) => void
}

export const useCustomViewZonePopoutStore = create<CustomViewZonePopoutState>((set, get) => ({
  popped: new Set(),

  isZonePoppedOut(viewId, leafId): boolean {
    return get().popped.has(poppedKey(viewId, leafId))
  },

  async popOutZone(viewId, leafId, panelId): Promise<void> {
    if (panelId === 'none') return
    const key = poppedKey(viewId, leafId)
    const title = i18n.t(layoutStudioPanelTitleKey(panelId))
    const next = new Set(get().popped)
    next.add(key)
    set({ popped: next })
    try {
      await openCustomViewZonePopout(viewId, leafId, panelId, title)
    } catch {
      const rollback = new Set(get().popped)
      rollback.delete(key)
      set({ popped: rollback })
    }
  },

  async dockZone(viewId, leafId): Promise<void> {
    await dockCustomViewZonePopout(viewId, leafId)
  },

  clearPopped(viewId, leafId): void {
    const key = poppedKey(viewId, leafId)
    if (!get().popped.has(key)) return
    const next = new Set(get().popped)
    next.delete(key)
    set({ popped: next })
  },

  handlePopoutClosed(instanceKey): void {
    const parsed = parseCustomViewZonePopoutInstanceKey(instanceKey)
    if (!parsed) return
    get().clearPopped(parsed.viewId, parsed.leafId)
  },

  clearViewPopouts(viewId): void {
    const next = new Set(get().popped)
    for (const k of [...next]) {
      if (!k.startsWith(`${viewId}::`)) continue
      void window.mailClient.panelPopout.close({
        panel: 'custom-view-zone',
        instanceKey: k
      })
      next.delete(k)
    }
    set({ popped: next })
  }
}))
