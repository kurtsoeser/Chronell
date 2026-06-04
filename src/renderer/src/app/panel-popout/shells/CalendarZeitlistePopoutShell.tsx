import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkItem } from '@shared/work-item'
import { CalendarRightZeitlistePanel } from '@/app/calendar/CalendarRightZeitlistePanel'
import { PopoutWindowChrome } from '@/app/panel-popout/PopoutWindowChrome'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import type { CalendarPreviewPopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import { openPanelPopout, panelPopoutStashKey } from '@/lib/open-panel-popout'
import { requestPanelPopoutDock } from '@/lib/request-panel-popout-dock'
import { useAccountsStore } from '@/stores/accounts'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function CalendarZeitlistePopoutShell(): JSX.Element {
  const { t } = useTranslation()
  const route = parsePanelPopoutRoute()
  const reloadRef = useRef<(() => void) | null>(null)
  const [reloadSignal, setReloadSignal] = useState(0)
  const [timelineLoading, setTimelineLoading] = useState(false)

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
  }, [])

  const close = (): void => {
    if (!route) return
    void window.mailClient.panelPopout.close({ panel: route.panel, instanceKey: route.instanceKey || undefined })
  }

  const onWorkItemFocused = useCallback((item: WorkItem): void => {
    if (item.kind === 'mail_todo') {
      void import('@/lib/open-mail-reading-popout').then(({ openMailReadingPopout }) => {
        openMailReadingPopout(item.messageId)
      })
      return
    }
    if (item.kind === 'calendar_event') {
      const ev = item.event
      const graphEventId = ev.graphEventId?.trim()
      if (!graphEventId) return
      const stash: CalendarPreviewPopoutStash = {
        focus: 'event',
        accountId: ev.accountId,
        graphEventId
      }
      const ik = `${ev.accountId}:${ev.graphEventId}`
      const key = panelPopoutStashKey('calendar-preview', ik)
      void openPanelPopout(
        {
          panel: 'calendar-preview',
          instanceKey: ik,
          title: item.title,
          stashKey: key
        },
        stash
      )
    }
  }, [])

  const popIn = (): void => {
    if (!route) return
    void requestPanelPopoutDock({ panel: 'calendar-zeitliste', instanceKey: route.instanceKey })
  }

  return (
    <PopoutWindowChrome title={t('mega.shell.title')} onClose={close} onPopIn={popIn}>
      <CalendarRightZeitlistePanel
        open
        reloadSignal={reloadSignal}
        reloadRef={reloadRef}
        onWorkItemFocused={onWorkItemFocused}
        onTimelineLoadingChange={setTimelineLoading}
        listRefreshing={timelineLoading}
        onRequestClose={close}
        hideChrome
      />
    </PopoutWindowChrome>
  )
}
