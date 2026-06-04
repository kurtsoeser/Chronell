import { useEffect, useRef } from 'react'
import type { EntityGraphNode } from '@shared/entity-links'
import type { PanelPopoutDockPayload } from '@shared/panel-popout'
import { persistConnectionsPreviewPlacement } from '@/app/connections/connections-preview-storage'
import {
  CONNECTIONS_PANEL_POPOUT_DOCK_EVENT,
  entityRefFromDockPayload
} from '@/lib/panel-popout-dock-handlers'
import { useAppModeStore } from '@/stores/app-mode'

export function useConnectionsPanelPopoutDock(handlers: {
  setPreviewOpen: (open: boolean) => void
  setPreviewPlacement: (p: 'dock' | 'float') => void
  setSelected: (node: EntityGraphNode | null) => void
  graphNodes: EntityGraphNode[]
}): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const onDock = (e: Event): void => {
      const payload = (e as CustomEvent<PanelPopoutDockPayload>).detail
      const ref = entityRefFromDockPayload(payload)
      if (!ref) return
      const h = handlersRef.current

      useAppModeStore.getState().setMode('connections')
      h.setPreviewPlacement('dock')
      persistConnectionsPreviewPlacement('dock')
      h.setPreviewOpen(true)

      const refKey = payload.params?.refKey?.trim() || payload.instanceKey?.trim() || ''
      const hit = h.graphNodes.find((n) => n.key === refKey)
      if (hit) {
        h.setSelected(hit)
        return
      }

      void (async (): Promise<void> => {
        const graph = await window.mailClient.entityLinks.listNeighborhood({
          anchor: ref,
          depth: 0
        })
        const node =
          graph.nodes.find((n) => n.key === refKey) ??
          ({
            key: refKey,
            ref,
            kind: ref.kind,
            title: '',
            subtitle: null,
            clusterKey: ''
          } satisfies EntityGraphNode)
        h.setSelected(node)
      })()
    }

    window.addEventListener(CONNECTIONS_PANEL_POPOUT_DOCK_EVENT, onDock)
    return (): void => window.removeEventListener(CONNECTIONS_PANEL_POPOUT_DOCK_EVENT, onDock)
  }, [])
}
