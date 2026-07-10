import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityGraphSnapshot } from '@shared/entity-links'
import { entityContextSectionBgClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { ConnectionsGraph } from '@/app/connections/ConnectionsGraph'
import {
  fetchEntityNeighborhood,
  subscribeEntityLinksChanged
} from '@/lib/entity-links-client'
import { openConnectionsGraphForRef } from '@/lib/open-connections-graph'

/** Mindesthoehe der Graphen-Vorschau im Kontext-Bereich (fuellt sonst den verfuegbaren Platz). */
const MINI_GRAPH_MIN_HEIGHT_PX = 200

export function EntityContextMiniGraph({
  anchor,
  active,
  className,
  fillHeight = false,
  constrainedHeight = false,
  onNeighborCountChange
}: {
  anchor: ChronellEntityRef
  /** Parent-Kontext-Bereich ist aufgeklappt. */
  active: boolean
  className?: string
  /** Graph nutzt verfügbare Panel-Höhe (Kalender-Vorschau). */
  fillHeight?: boolean
  /** Feste Höhe aus Parent-Container (resizable Graph-Bereich). */
  constrainedHeight?: boolean
  onNeighborCountChange?: (count: number) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const anchorKey = useMemo(() => entityRefKey(anchor), [anchor])
  const [snap, setSnap] = useState<EntityGraphSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const data = await fetchEntityNeighborhood({ anchor, depth: 1 })
      setSnap(data)
    } catch {
      setSnap({ nodes: [], edges: [] })
    } finally {
      setLoading(false)
    }
  }, [anchor, anchorKey])

  useEffect(() => {
    if (!active) return
    void load()
  }, [active, load])

  useEffect(() => {
    if (!active) return
    return subscribeEntityLinksChanged(() => {
      void load()
    })
  }, [active, load])

  const neighborCount = useMemo(() => {
    if (!snap) return 0
    return Math.max(0, snap.nodes.length - 1)
  }, [snap])

  useEffect(() => {
    onNeighborCountChange?.(neighborCount)
  }, [neighborCount, onNeighborCountChange])

  if (!active) return null

  if (loading && !snap) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 text-xs text-muted-foreground',
          className
        )}
        style={{ minHeight: MINI_GRAPH_MIN_HEIGHT_PX }}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('common.loading')}
      </div>
    )
  }

  if (!snap || snap.nodes.length <= 1) {
    return (
      <p className={cn('py-3 text-xs text-muted-foreground', className)}>
        {t('context.graph.empty')}
      </p>
    )
  }

  const hint =
    neighborCount > 0
      ? t('connections.graph.hintFocus', { count: neighborCount })
      : t('connections.localGraph.hint')

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        (fillHeight || constrainedHeight) && 'min-h-0 flex-1',
        className
      )}
    >
      <div
        className={cn(
          'relative flex flex-col overflow-hidden rounded-md',
          entityContextSectionBgClass,
          constrainedHeight
            ? 'min-h-0 flex-1'
            : fillHeight
              ? 'min-h-[200px] flex-1'
              : 'min-h-[160px]'
        )}
        style={constrainedHeight ? undefined : { minHeight: MINI_GRAPH_MIN_HEIGHT_PX }}
      >
        <ConnectionsGraph
          nodes={snap.nodes}
          edges={snap.edges}
          allEdges={snap.edges}
          selectedKey={anchorKey}
          clusterMode="kind"
          compact
          onSelectNode={(): void => {}}
          onNavigateNode={(node): void => {
            openConnectionsGraphForRef(node.ref)
          }}
        />
      </div>
      <p className="shrink-0 px-0.5 text-2xs leading-snug text-muted-foreground">{hint}</p>
    </div>
  )
}
