import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MailRightSidebar } from '@/app/layout/MailRightSidebar'
import { PopoutWindowChrome } from '@/app/panel-popout/PopoutWindowChrome'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { requestPanelPopoutDock } from '@/lib/request-panel-popout-dock'
import { useAccountsStore } from '@/stores/accounts'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function MailCalendarSidebarPopoutShell(): JSX.Element {
  const { t } = useTranslation()
  const route = parsePanelPopoutRoute()

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
  }, [])

  const close = (): void => {
    if (!route) return
    void window.mailClient.panelPopout.close({ panel: route.panel, instanceKey: route.instanceKey || undefined })
  }

  const popIn = (): void => {
    if (!route) return
    void requestPanelPopoutDock({ panel: 'mail-calendar', instanceKey: route.instanceKey })
  }

  return (
    <PopoutWindowChrome
      title={t('mail.workspace.floatCalendarTitle')}
      onClose={close}
      onPopIn={popIn}
    >
      <MailRightSidebar hideChrome />
    </PopoutWindowChrome>
  )
}
