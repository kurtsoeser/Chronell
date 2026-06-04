import { useEffect } from 'react'
import type { PanelPopoutDockPayload } from '@shared/panel-popout'
import { handleMailReadingPopoutDock, handlePanelPopoutDock } from '@/lib/panel-popout-dock-handlers'

export function usePanelPopoutDockListener(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    const onPanelDock = (detail: PanelPopoutDockPayload): void => {
      if (!detail?.panel) return
      void handlePanelPopoutDock(detail)
    }

    const onMailDock = (detail: { messageId: number }): void => {
      const messageId = detail?.messageId
      if (messageId == null || !Number.isFinite(messageId)) return
      void handleMailReadingPopoutDock(messageId)
    }

    const offPanel = window.mailClient.events.onPanelPopoutDock(onPanelDock)
    const offMail = window.mailClient.events.onMailReadingPopoutDock(onMailDock)
    return (): void => {
      offPanel()
      offMail()
    }
  }, [enabled])
}
