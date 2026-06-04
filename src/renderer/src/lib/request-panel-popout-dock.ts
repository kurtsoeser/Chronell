import type { PanelPopoutDockPayload, PanelPopoutKind } from '@shared/panel-popout'
import { panelPopoutStashKey } from '@/lib/open-panel-popout'

export async function requestPanelPopoutDock(input: {
  panel: PanelPopoutKind
  instanceKey?: string
  stashKey?: string
  stashPayload?: unknown
  params?: Record<string, string>
}): Promise<void> {
  const instanceKey = input.instanceKey?.trim() || ''
  let stashKey = input.stashKey?.trim()
  if (input.stashPayload != null) {
    stashKey = stashKey || panelPopoutStashKey(input.panel, instanceKey || 'default')
    await window.mailClient.panelPopout.stashPayload({
      key: stashKey,
      payload: input.stashPayload
    })
  }
  const payload: PanelPopoutDockPayload = {
    panel: input.panel,
    instanceKey,
    stashKey,
    params: input.params
  }
  await window.mailClient.panelPopout.requestDock(payload)
}
