import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Network } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityGraphSnapshot } from '@shared/entity-links'
import { cn } from '@/lib/utils'
import { ConnectionsGraph } from '@/app/connections/ConnectionsGraph'
import {
  fetchEntityNeighborhood,
  subscribeEntityLinksChanged
} from '@/lib/entity-links-client'
import { openConnectionsGraphForRef } from '@/lib/open-connections-graph'

export function LocalConnectionsGraph({
  anchor,
  className,
  contentPaddingClass = 'px-6'
}: {
  anchor: ChronellEntityRef
  className?: string
  contentPaddingClass?: string
}): JSX.Element | null {
  const { t } = useTranslation()
  const anchorKey = useMemo(() => entityRefKey(anchor), [anchor])
  const [expanded, setExpanded] = useState(false)
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
    if (!expanded) return
    void load()
  }, [expanded, load])

  useEffect(() => {
    if (!expanded) return
    return subscribeEntityLinksChanged(() => {
      void load()
    })
  }, [expanded, load])

  const neighborCount = useMemo(() => {
    if (!snap) return 0
    return Math.max(0, snap.nodes.length - 1)
  }, [snap])

  if (anchor.kind !== 'mail' && anchor.kind !== 'mail_todo') return null

  return (
    <section className={cn('border-t border-border', className)}>
      <button
        type="button"
        onClick={(): void => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 py-2 text-left hover:bg-secondary/30',
          contentPaddingClass
        )}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium text-foreground">
          {t('connections.localGraph.title')}
        </span>
        <button
          type="button"
          className="shrink-0 text-[10px] font-medium text-primary hover:underline"
          onClick={(e): void => {
            e.stopPropagation()
            openConnectionsGraphForRef(anchor)
          }}
        >
          {t('connections.shell.showInGraph')}
        </button>
        {!expanded && neighborCount > 0 ? (
          <span className="ml-1 rounded-full bg-secondary px-1.5 py-0 text-[10px] tabular-nums text-muted-foreground">
            {neighborCount}
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div className={cn('pb-3', contentPaddingClass)}>
          {loading && !snap ? (
            <div className="flex h-[120px] items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('common.loading')}
            </div>
          ) : snap && snap.nodes.length > 0 ? (
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
          ) : (
            <p className="py-4 text-xs text-muted-foreground">{t('connections.localGraph.empty')}</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
