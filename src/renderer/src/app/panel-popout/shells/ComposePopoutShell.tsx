import { useEffect } from 'react'
import { ComposerStack } from '@/components/Composer'
import { PopoutWindowChrome } from '@/app/panel-popout/PopoutWindowChrome'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { requestPanelPopoutDock } from '@/lib/request-panel-popout-dock'
import type { ComposePopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import { useComposeStore } from '@/stores/compose'
import { useAccountsStore } from '@/stores/accounts'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function ComposePopoutShell(): JSX.Element {
  const route = parsePanelPopoutRoute()

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
    const key = route?.params.get('stashKey')?.trim()
    if (!key) return
    void window.mailClient.panelPopout.takePayload(key).then((raw) => {
      const draft = raw as ComposePopoutStash | null
      if (!draft?.id) return
      useComposeStore.setState({
        drafts: [{ ...draft, busy: false, error: null }],
        activeId: draft.id
      })
    })
  }, [route])


  const draft = useComposeStore((s) =>
    route?.instanceKey ? s.drafts.find((d) => d.id === route.instanceKey) : undefined
  )
  const title = draft?.subject?.trim() || 'Neue E-Mail'

  const close = (): void => {
    if (!route) return
    void window.mailClient.panelPopout.close({ panel: route.panel, instanceKey: route.instanceKey || undefined })
  }

  const popIn = (): void => {
    if (!route || !draft) return
    void requestPanelPopoutDock({
      panel: 'compose',
      instanceKey: draft.id,
      stashPayload: draft
    })
  }

  return (
    <PopoutWindowChrome title={title} onClose={close} onPopIn={popIn}>
      <ComposerStack />
    </PopoutWindowChrome>
  )
}
