import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseEntityRefKey } from '@shared/entity-ref'
import type { EntityGraphNode } from '@shared/entity-links'
import { ConnectionsObjectPreview } from '@/app/connections/ConnectionsObjectPreview'
import { PopoutWindowChrome } from '@/app/panel-popout/PopoutWindowChrome'
import { requestPanelPopoutDock } from '@/lib/request-panel-popout-dock'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { useAccountsStore } from '@/stores/accounts'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function ConnectionsPreviewPopoutShell(): JSX.Element {
  const { t } = useTranslation()
  const route = parsePanelPopoutRoute()
  const accounts = useAccountsStore((s) => s.accounts)
  const [node, setNode] = useState<EntityGraphNode | null>(null)

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
  }, [])

  const refKey = route?.params.get('refKey')?.trim() ?? route?.instanceKey ?? ''

  useEffect(() => {
    const ref = parseEntityRefKey(refKey)
    if (!ref) return
    let cancelled = false
    void (async (): Promise<void> => {
      const graph = await window.mailClient.entityLinks.listNeighborhood({
        anchor: ref,
        depth: 0
      })
      const hit = graph.nodes.find((n) => n.key === refKey)
      if (!cancelled) {
        setNode(
          hit ?? {
            key: refKey,
            ref,
            kind: ref.kind,
            title: t('connections.preview.title'),
            subtitle: null,
            clusterKey: ''
          }
        )
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [refKey, t])

  const close = (): void => {
    if (!route) return
    void window.mailClient.panelPopout.close({ panel: route.panel, instanceKey: route.instanceKey || undefined })
  }

  const popIn = (): void => {
    if (!route || !refKey) return
    void requestPanelPopoutDock({
      panel: 'connections-preview',
      instanceKey: route.instanceKey || refKey,
      params: { refKey }
    })
  }

  const entityRef = useMemo(() => parseEntityRefKey(refKey), [refKey])

  if (!entityRef) {
    return (
      <PopoutWindowChrome title={t('connections.preview.title')} onClose={close} onPopIn={popIn}>
        <p className="p-4 text-sm text-muted-foreground">{t('common.error')}</p>
      </PopoutWindowChrome>
    )
  }

  return (
    <PopoutWindowChrome
      title={node?.title ?? t('connections.preview.title')}
      onClose={close}
      onPopIn={popIn}
    >
      <ConnectionsObjectPreview entityRef={entityRef} accounts={accounts} />
    </PopoutWindowChrome>
  )
}
