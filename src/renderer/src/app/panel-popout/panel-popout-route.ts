import type { PanelPopoutKind } from '@shared/panel-popout'
import { PANEL_POPOUT_KINDS } from '@shared/panel-popout'

export interface PanelPopoutRoute {
  panel: PanelPopoutKind
  instanceKey: string
  params: URLSearchParams
}

export function parsePanelPopoutRoute(): PanelPopoutRoute | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.startsWith('panel-popout')) return null
  const qIdx = hash.indexOf('?')
  const qs = qIdx >= 0 ? hash.slice(qIdx + 1) : ''
  const params = new URLSearchParams(qs)
  const panel = params.get('panel')?.trim() ?? ''
  if (!(PANEL_POPOUT_KINDS as readonly string[]).includes(panel)) return null
  const instanceKey = params.get('instanceKey')?.trim() ?? ''
  return { panel: panel as PanelPopoutKind, instanceKey, params }
}

export function isPanelPopoutWindow(): boolean {
  return parsePanelPopoutRoute() != null
}
