import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import { openPanelPopout } from '@/lib/open-panel-popout'
import { requestPanelPopoutDock } from '@/lib/request-panel-popout-dock'

export function customViewZonePopoutInstanceKey(viewId: string, leafId: string): string {
  return `${viewId}::${leafId}`
}

export function parseCustomViewZonePopoutInstanceKey(
  instanceKey: string
): { viewId: string; leafId: string } | null {
  const idx = instanceKey.indexOf('::')
  if (idx <= 0) return null
  const viewId = instanceKey.slice(0, idx).trim()
  const leafId = instanceKey.slice(idx + 2).trim()
  if (!viewId || !leafId) return null
  return { viewId, leafId }
}

export async function openCustomViewZonePopout(
  viewId: string,
  leafId: string,
  panelId: LayoutStudioPanelId,
  title: string
): Promise<void> {
  if (panelId === 'none') return
  const instanceKey = customViewZonePopoutInstanceKey(viewId, leafId)
  await openPanelPopout({
    panel: 'custom-view-zone',
    instanceKey,
    title,
    params: {
      viewId,
      leafId,
      panelId,
      title
    }
  })
}

export async function dockCustomViewZonePopout(viewId: string, leafId: string): Promise<void> {
  await requestPanelPopoutDock({
    panel: 'custom-view-zone',
    instanceKey: customViewZonePopoutInstanceKey(viewId, leafId),
    params: { viewId, leafId }
  })
}
