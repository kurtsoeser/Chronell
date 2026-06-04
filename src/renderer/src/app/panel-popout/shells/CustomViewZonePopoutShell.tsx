import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutStudioPanel } from '@/app/layout-studio/LayoutStudioPanel'
import { isLayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import { layoutStudioPanelTitleKey } from '@/app/layout-studio/layout-studio-panel-ids'
import { PopoutWindowChrome } from '@/app/panel-popout/PopoutWindowChrome'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { dockCustomViewZonePopout } from '@/lib/custom-view-zone-popout'
import { useAccountsStore } from '@/stores/accounts'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function CustomViewZonePopoutShell(): JSX.Element {
  const { t, i18n } = useTranslation()
  const route = parsePanelPopoutRoute()

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
  }, [])

  const viewId = route?.params.get('viewId')?.trim() ?? ''
  const leafId = route?.params.get('leafId')?.trim() ?? ''
  const panelRaw = route?.params.get('panelId')?.trim() ?? ''
  const panelId = isLayoutStudioPanelId(panelRaw) ? panelRaw : 'none'

  const title =
    route?.params.get('title')?.trim() ||
    (panelId !== 'none' ? i18n.t(layoutStudioPanelTitleKey(panelId)) : t('customView.popout.windowTitle'))

  const close = (): void => {
    if (!route) return
    void window.mailClient.panelPopout.close({
      panel: route.panel,
      instanceKey: route.instanceKey || undefined
    })
  }

  const popIn = (): void => {
    if (!viewId || !leafId) return
    void dockCustomViewZonePopout(viewId, leafId)
  }

  return (
    <PopoutWindowChrome title={title} onClose={close} onPopIn={popIn}>
      {panelId === 'none' ? (
        <p className="p-4 text-sm text-muted-foreground">{t('layoutStudio.panelEmpty')}</p>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <LayoutStudioPanel panel={panelId} />
        </div>
      )}
    </PopoutWindowChrome>
  )
}
