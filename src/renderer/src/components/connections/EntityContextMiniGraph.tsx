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
  onNeighborCountChange
}: {
  anchor: ChronellEntityRef
  /** Parent-Kontext-Bereich ist aufgeklappt. */
  active: boolean
  className?: string
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

  return (
    <div
      className={cn(
        'flex min-h-[160px] flex-col overflow-hidden rounded-md',
        entityContextSectionBgClass,
        className
      )}
      style={{ minHeight: MINI_GRAPH_MIN_HEIGHT_PX }}
    >
      <ConnectionsGraph
        nodes={snap.nodes}
        edges={snap.edges}
        allEdges={snap.edges}
        selectedKey={anchorKey}
        clusterMode="kind"
        compact
        onSelectNode={(): void => {
          openConnectionsGraphForRef(anchor)
        }}
      />
    </div>
  )
}
