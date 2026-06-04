import { useEffect, useMemo } from 'react'
import type { LayoutZonePopoutConfig } from '@/app/layout-studio/LayoutZoneTree'
import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import { useCustomViewZonePopoutStore } from '@/stores/custom-view-zone-popout'

export function useCustomViewZonePopout(viewId: string | null): LayoutZonePopoutConfig | undefined {
  const popped = useCustomViewZonePopoutStore((s) => s.popped)
  const popOutZone = useCustomViewZonePopoutStore((s) => s.popOutZone)
  const dockZone = useCustomViewZonePopoutStore((s) => s.dockZone)
  const isZonePoppedOut = useCustomViewZonePopoutStore((s) => s.isZonePoppedOut)
  const handlePopoutClosed = useCustomViewZonePopoutStore((s) => s.handlePopoutClosed)
  const clearViewPopouts = useCustomViewZonePopoutStore((s) => s.clearViewPopouts)

  useEffect(() => {
    const off = window.mailClient.events.onPanelPopoutClosed((payload) => {
      if (payload.panel !== 'custom-view-zone') return
      handlePopoutClosed(payload.instanceKey)
    })
    return off
  }, [handlePopoutClosed])

  useEffect(() => {
    if (!viewId) return
    return (): void => {
      clearViewPopouts(viewId)
    }
  }, [viewId, clearViewPopouts])

  return useMemo((): LayoutZonePopoutConfig | undefined => {
    if (!viewId) return undefined
    return {
      viewId,
      isPopped: (leafId): boolean => isZonePoppedOut(viewId, leafId),
      onPopOut: (leafId, panelId: LayoutStudioPanelId): void => {
        void popOutZone(viewId, leafId, panelId)
      },
      onDockIn: (leafId): void => {
        void dockZone(viewId, leafId)
      }
    }
  }, [viewId, popped, isZonePoppedOut, popOutZone, dockZone])
}
