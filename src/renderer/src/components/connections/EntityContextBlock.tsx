import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import { ObjectNoteEditor, type ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import { EntityContextRelations } from '@/components/connections/ConnectionsPanel'
import type {
  EntityContextRelationsStats,
  EntityContextTab
} from '@/components/connections/entity-context-types'
import { EntityContextMiniGraph } from '@/components/connections/EntityContextMiniGraph'
import {
  fetchEntityNeighborhood,
  subscribeEntityLinksChanged
} from '@/lib/entity-links-client'
import {
  persistEntityContextExpanded,
  persistEntityContextTab,
  readEntityContextExpanded,
  readEntityContextTab
} from '@/lib/entity-context-storage'
import { openConnectionsGraphForRef } from '@/lib/open-connections-graph'
import { cn } from '@/lib/utils'

export function EntityContextBlock({
  anchor,
  noteTarget = null,
  showObjectNote = true,
  className,
  sectionCollapsedDefault = true,
  contentPaddingClass = 'px-6'
}: {
  anchor: ChronellEntityRef
  noteTarget?: ObjectNoteTarget | null
  /** Chronell-Notiz oberhalb des Kontext-Blocks (nur wenn `noteTarget` gesetzt). */
  showObjectNote?: boolean
  className?: string
  sectionCollapsedDefault?: boolean
  contentPaddingClass?: string
}): JSX.Element {
  const { t } = useTranslation()
  const anchorKey = useMemo(() => entityRefKey(anchor), [anchor])

  const [expanded, setExpanded] = useState(() =>
    readEntityContextExpanded(anchorKey, !sectionCollapsedDefault)
  )
  const [activeTab, setActiveTab] = useState<EntityContextTab>(() => readEntityContextTab(anchorKey))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [neighborCount, setNeighborCount] = useState(0)
  const [stats, setStats] = useState<EntityContextRelationsStats>({
    linkCount: 0,
    suggestionCount: 0
  })
  const [summaryLoading, setSummaryLoading] = useState(false)

  const toggleExpanded = useCallback((): void => {
    setExpanded((v) => {
      const next = !v
      persistEntityContextExpanded(anchorKey, next)
      return next
    })
  }, [anchorKey])

  const handleTabChange = useCallback(
    (tab: EntityContextTab): void => {
      setActiveTab(tab)
      persistEntityContextTab(anchorKey, tab)
    },
    [anchorKey]
  )

  const loadSummaryNeighbors = useCallback(async (): Promise<void> => {
    setSummaryLoading(true)
    try {
      const data = await fetchEntityNeighborhood({ anchor, depth: 1 })
      setNeighborCount(Math.max(0, data.nodes.length - 1))
    } catch {
      setNeighborCount(0)
    } finally {
      setSummaryLoading(false)
    }
  }, [anchor, anchorKey])

  useEffect(() => {
    void loadSummaryNeighbors()
    return subscribeEntityLinksChanged(() => {
      void loadSummaryNeighbors()
    })
  }, [loadSummaryNeighbors])

  useEffect(() => {
    setExpanded(readEntityContextExpanded(anchorKey, !sectionCollapsedDefault))
    setActiveTab(readEntityContextTab(anchorKey))
  }, [anchorKey, sectionCollapsedDefault])

  const summaryParts = useMemo((): string[] => {
    const parts: string[] = []
    if (stats.linkCount > 0) {
      parts.push(t('context.summary.links', { count: stats.linkCount }))
    }
    if (neighborCount > 0) {
      parts.push(t('context.summary.neighbors', { count: neighborCount }))
    }
    if (stats.suggestionCount > 0) {
      parts.push(t('context.summary.suggestions', { count: stats.suggestionCount }))
    }
    return parts
  }, [stats, neighborCount, t])

  const showNote = showObjectNote && noteTarget != null

  return (
    <div className={cn('shrink-0', className)}>
      {showNote ? (
        <ObjectNoteEditor
          target={noteTarget}
          variant="section"
          sectionCollapsedDefault
          layout="toggle"
          className={cn('border-t border-border bg-secondary/5 py-2', contentPaddingClass)}
        />
      ) : null}

      <section className={cn('border-t border-border', showNote ? '' : '')}>
        <div className={cn('flex w-full items-center gap-2 py-2', contentPaddingClass)}>
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex min-w-0 flex-1 items-center gap-2 text-left hover:bg-secondary/30"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-xs font-medium text-foreground">{t('context.title')}</span>
            {!expanded && summaryParts.length > 0 ? (
              <span className="truncate text-[10px] text-muted-foreground">{summaryParts.join(' · ')}</span>
            ) : null}
            {summaryLoading && !expanded ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
            ) : null}
          </button>
          <button
            type="button"
            className="shrink-0 text-[10px] font-medium text-primary hover:underline"
            onClick={(): void => openConnectionsGraphForRef(anchor)}
          >
            {t('context.openGraph')}
          </button>
          <button
            type="button"
            title={t('connections.add')}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium hover:bg-secondary"
            onClick={(): void => {
              persistEntityContextExpanded(anchorKey, true)
              setExpanded(true)
              handleTabChange('links')
              setPickerOpen(true)
            }}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {expanded ? (
          <div className={cn('space-y-3', contentPaddingClass)}>
            <EntityContextMiniGraph
              anchor={anchor}
              active={expanded}
              onNeighborCountChange={setNeighborCount}
            />
            <EntityContextRelations
              anchor={anchor}
              expanded={expanded}
              activeTab={activeTab}
              onActiveTabChange={handleTabChange}
              pickerOpen={pickerOpen}
              onPickerOpenChange={setPickerOpen}
              contentPaddingClass="px-0"
              onStatsChange={setStats}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}
