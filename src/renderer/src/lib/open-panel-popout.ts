import type { PanelPopoutKind, PanelPopoutOpenInput } from '@shared/panel-popout'
import { loadUseOsFloatingPanelsDefault } from '@/lib/floating-panels-prefs'

export function shouldUseOsFloatingPanel(inAppFloat = false): boolean {
  return !inAppFloat && loadUseOsFloatingPanelsDefault()
}

export async function openPanelPopout(
  input: PanelPopoutOpenInput,
  stashPayload?: unknown
): Promise<void> {
  if (stashPayload != null && input.stashKey?.trim()) {
    await window.mailClient.panelPopout.stashPayload({
      key: input.stashKey.trim(),
      payload: stashPayload
    })
  }
  await window.mailClient.panelPopout.open(input)
}

export async function closePanelPopout(
  panel: PanelPopoutKind,
  instanceKey?: string
): Promise<void> {
  await window.mailClient.panelPopout.close({ panel, instanceKey })
}

export function panelPopoutStashKey(panel: PanelPopoutKind, instanceKey: string): string {
  return `${panel}::${instanceKey}`
}
