import type { ChronellEntityRef } from '@shared/entity-ref'
import { useAppModeStore } from '@/stores/app-mode'
import { useConnectionsGraphFocusStore } from '@/stores/connections-graph-focus'

/** Wechselt ins Modul „Verbindungen“ und markiert einen Knoten im Graphen. */
export function openConnectionsGraphForRef(ref: ChronellEntityRef): void {
  useConnectionsGraphFocusStore.getState().setHighlightRef(ref)
  useAppModeStore.getState().setMode('connections')
}
