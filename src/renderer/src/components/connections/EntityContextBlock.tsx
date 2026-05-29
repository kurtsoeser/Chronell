import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import { ObjectNoteEditor, type ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import { PreviewFoldSection } from '@/components/PreviewFoldSection'
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
  contentPaddingClass = 'px-6',
  noteEditorFillHeight = false
}: {
  anchor: ChronellEntityRef
  noteTarget?: ObjectNoteTarget | null
  /** Chronell-Notiz oberhalb des Kontext-Blocks (nur wenn `noteTarget` gesetzt). */
  showObjectNote?: boolean
  className?: string
  sectionCollapsedDefault?: boolean
  contentPaddingClass?: string
  /** Notiz-Editor füllt verfügbare Höhe (z. B. Kalender-Vorschau). */
  noteEditorFillHeight?: boolean
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

  const summaryNode = (
    <>
      {summaryParts.length > 0 ? summaryParts.join(' · ') : null}
      {summaryLoading && !expanded ? (
        <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-muted-foreground" />
      ) : null}
    </>
  )

  const kontextTrailing = (
    <>
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
        className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-secondary/15 px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-secondary/30"
        onClick={(): void => {
          persistEntityContextExpanded(anchorKey, true)
          setExpanded(true)
          handleTabChange('links')
          setPickerOpen(true)
        }}
      >
        <Plus className="h-3 w-3" />
      </button>
    </>
  )

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        noteEditorFillHeight && 'min-h-0 flex-1 overflow-hidden',
        className
      )}
    >
      {showNote ? (
        <ObjectNoteEditor
          target={noteTarget}
          variant="section"
          sectionCollapsedDefault
          layout="toggle"
          fillHeight={noteEditorFillHeight}
          contentPaddingClass={contentPaddingClass}
          className={noteEditorFillHeight ? 'min-h-0 flex-1 overflow-hidden' : undefined}
        />
      ) : null}

      <PreviewFoldSection
        icon={Layers}
        title={t('context.title')}
        expanded={expanded}
        onToggle={toggleExpanded}
        summary={summaryNode}
        trailing={kontextTrailing}
        className={cn(showNote ? 'min-h-0 shrink-0' : 'border-t-0')}
        contentClassName={cn(
          'min-h-0 space-y-3 !px-0',
          noteEditorFillHeight && 'max-h-52 overflow-y-auto'
        )}
      >
        <div className={contentPaddingClass}>
          <EntityContextMiniGraph
            anchor={anchor}
            active={expanded}
            className="h-44 max-h-44 shrink-0"
            onNeighborCountChange={setNeighborCount}
          />
        </div>
        <EntityContextRelations
          anchor={anchor}
          expanded={expanded}
          activeTab={activeTab}
          onActiveTabChange={handleTabChange}
          pickerOpen={pickerOpen}
          onPickerOpenChange={setPickerOpen}
          contentPaddingClass={contentPaddingClass}
          onStatsChange={setStats}
        />
      </PreviewFoldSection>
    </div>
  )
}
