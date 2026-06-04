import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Route, Save, Search, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityLinkSuggestionCountEntry } from '@shared/entity-link-ai-payload'
import type { EntityLinkQuality } from '@shared/entity-links'
import type {
  EntityGraphNode,
  EntityGraphSnapshot,
  EntityLinkAiScanAnchor,
  EntityLinkAiScanItem,
  EntityLinkAiScanProfile,
  EntityLinkGraphDensityStats,
  EntityLinkPathResult,
  EntityLinkTargetCandidate
} from '@shared/entity-links'
import { ConnectionsGraphWithFilter } from '@/app/connections/ConnectionsGraph'
import type { GraphEntityDragPayload } from '@/app/connections/graph-entity-drag'
import type { GraphPathHighlight } from '@/app/connections/graph-focus'
import type { ClusterIslandStyle } from '@/app/connections/cluster-island-style'
import {
  loadGraphViewSettings,
  saveGraphViewSettings,
  type ConnectionsGraphViewSettings
} from '@/app/connections/connections-graph-view-settings'
import { migrateLegacyComponentIslandMaps } from '@/app/connections/graph-components'
import { useConnectionsCanvasCreate } from '@/app/connections/ConnectionsCanvasCreateHost'
import { useGraphNodeContextMenu } from '@/app/connections/use-graph-node-context-menu'
import { ContextMenu } from '@/components/ContextMenu'
import type { ConnectionsCanvasCreateAnchor } from '@/app/connections/connections-canvas-create'
import { CalendarPreviewPaneToolbarButton } from '@/app/calendar/CalendarPosteingangToolbar'
import { ConnectionsPreviewPane } from '@/app/connections/ConnectionsPreviewPane'
import { useConnectionsPanelPopoutDock } from '@/app/connections/use-connections-panel-popout-dock'
import {
  readConnectionsPreviewPlacement,
  type ConnectionsPreviewPlacement
} from '@/app/connections/connections-preview-storage'
import { ConnectionsAiScanPanel } from '@/app/connections/ConnectionsAiScanPanel'
import { ConnectionsEmbeddingIndexBar } from '@/app/connections/ConnectionsEmbeddingIndexBar'
import { ConnectionsGraphControls } from '@/components/connections/ConnectionsGraphControls'
import { ConnectionsObjectPalette } from '@/components/connections/ConnectionsObjectPalette'
import {
  moduleColumnHeaderActionsClass,
  moduleColumnHeaderOutlineSmClass,
  moduleColumnHeaderShellBarClass
} from '@/components/ModuleColumnHeader'
import { useResizableWidth, VerticalSplitter } from '@/components/ResizableSplitter'
import {
  moduleNavColumnClass,
  modulePaneStackClass,
  moduleShellClass
} from '@/components/module-shell-layout'
import { useModuleNavColumnWidth } from '@/lib/module-nav-column-width'
import { cn } from '@/lib/utils'
import {
  fetchEntityLinkGraphDensityStats,
  fetchEntityLinkPath,
  fetchEntityLinkQuality,
  fetchEntityLinksGraph,
  fetchEntityLinkSuggestionCounts,
  subscribeEntityLinksChanged
} from '@/lib/entity-links-client'
import { openEntityRef } from '@/lib/entity-link-nav'
import { useAppModeStore } from '@/stores/app-mode'
import { useConnectionsGraphFocusStore } from '@/stores/connections-graph-focus'

interface StagedGraphEntry {
  ref: ChronellEntityRef
  title: string
  subtitle: string | null
  x: number
  y: number
}

function nodeFromPaletteItem(
  item: EntityLinkTargetCandidate,
  graph: EntityGraphSnapshot | null
): EntityGraphNode {
  const key = entityRefKey(item.target)
  const existing = graph?.nodes.find((n) => n.key === key)
  if (existing) return existing
  return {
    key,
    ref: item.target,
    kind: item.target.kind,
    title: item.title,
    subtitle: item.subtitle,
    clusterKey: `kind:${item.target.kind}`
  }
}

export function ConnectionsShell(): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const highlightKey = useConnectionsGraphFocusStore((s) => s.highlightKey)
  const setHighlightRef = useConnectionsGraphFocusStore((s) => s.setHighlightRef)
  const setEmphasisKeys = useConnectionsGraphFocusStore((s) => s.setEmphasisKeys)
  const requestFitToKeys = useConnectionsGraphFocusStore((s) => s.requestFitToKeys)
  const pendingFocusClusterKey = useConnectionsGraphFocusStore((s) => s.pendingFocusClusterKey)
  const clearPendingClusterFocus = useConnectionsGraphFocusStore((s) => s.clearPendingClusterFocus)
  const pendingScanAnchors = useConnectionsGraphFocusStore((s) => s.pendingScanAnchors)
  const pendingAutoStartScan = useConnectionsGraphFocusStore((s) => s.pendingAutoStartScan)
  const clearPendingAiScan = useConnectionsGraphFocusStore((s) => s.clearPendingAiScan)

  const [graph, setGraph] = useState<EntityGraphSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewSettings, setViewSettings] = useState<ConnectionsGraphViewSettings>(() =>
    loadGraphViewSettings()
  )

  const renameComponentIsland = useCallback((clusterKey: string, name: string): void => {
    setViewSettings((s) => ({
      ...s,
      componentIslandLabels: { ...s.componentIslandLabels, [clusterKey]: name }
    }))
  }, [])

  const resetComponentIsland = useCallback((clusterKey: string): void => {
    setViewSettings((s) => {
      const componentIslandLabels = { ...s.componentIslandLabels }
      delete componentIslandLabels[clusterKey]
      return { ...s, componentIslandLabels }
    })
  }, [])

  const setIslandStyle = useCallback((clusterKey: string, style: ClusterIslandStyle): void => {
      setViewSettings((s) => ({
        ...s,
        clusterIslandStyles: { ...s.clusterIslandStyles, [clusterKey]: style }
      }))
    },
    []
  )

  const resetIslandStyle = useCallback((clusterKey: string): void => {
    setViewSettings((s) => {
      const clusterIslandStyles = { ...s.clusterIslandStyles }
      delete clusterIslandStyles[clusterKey]
      return { ...s, clusterIslandStyles }
    })
  }, [])

  const [graphLayoutEpoch, setGraphLayoutEpoch] = useState(0)
  const [saveLayoutRequest, setSaveLayoutRequest] = useState(0)

  const persistGraphLayout = useCallback(
    (
      structureKey: string,
      nodePositions: Record<string, { x: number; y: number }>,
      options?: { replace?: boolean }
    ): void => {
      setViewSettings((s) => {
        const prev = s.savedGraphLayout?.nodePositions ?? {}
        return {
          ...s,
          savedGraphLayout: {
            structureKey,
            nodePositions: options?.replace
              ? nodePositions
              : { ...prev, ...nodePositions }
          }
        }
      })
    },
    []
  )

  const mergeSavedNodePosition = useCallback(
    (nodeKey: string, x: number, y: number): void => {
      setViewSettings((s) => ({
        ...s,
        savedGraphLayout: {
          structureKey: s.savedGraphLayout?.structureKey ?? '',
          nodePositions: {
            ...(s.savedGraphLayout?.nodePositions ?? {}),
            [nodeKey]: { x, y }
          }
        }
      }))
    },
    []
  )

  const relayoutGraph = useCallback((): void => {
    setGraphLayoutEpoch((n) => n + 1)
  }, [])

  const saveGraphLayout = useCallback((): void => {
    setSaveLayoutRequest((n) => n + 1)
  }, [])

  useEffect(() => {
    saveGraphViewSettings(viewSettings)
  }, [viewSettings])
  const [selected, setSelected] = useState<EntityGraphNode | null>(null)
  const [pathPickEnd, setPathPickEnd] = useState(false)
  const [pathOverlay, setPathOverlay] = useState<EntityLinkPathResult | null>(null)
  const [pathHops, setPathHops] = useState<number | null>(null)
  const [pathBusy, setPathBusy] = useState(false)
  const [pathNotFound, setPathNotFound] = useState(false)
  const [staged, setStaged] = useState<StagedGraphEntry[]>([])
  const [pinnedPositions, setPinnedPositions] = useState<
    Map<string, { x: number; y: number }>
  >(() => new Map())
  const [linkBusy, setLinkBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [previewPlacement, setPreviewPlacement] = useState<ConnectionsPreviewPlacement>(
    readConnectionsPreviewPlacement
  )
  const [scanPanelOpen, setScanPanelOpen] = useState(false)
  const [multiSelectedKeys, setMultiSelectedKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [scanProfile, setScanProfile] = useState<EntityLinkAiScanProfile | null>(null)
  const [density, setDensity] = useState<EntityLinkGraphDensityStats | null>(null)
  const [showLinkQualityOnGraph, setShowLinkQualityOnGraph] = useState(false)
  const [linkQualityByLinkId, setLinkQualityByLinkId] = useState<
    Map<number, EntityLinkQuality>
  >(() => new Map())
  const [suggestionHints, setSuggestionHints] = useState<
    ReadonlyMap<string, EntityLinkSuggestionCountEntry>
  >(() => new Map())

  const [paletteWidth, setPaletteWidth] = useModuleNavColumnWidth()

  const [previewWidth, setPreviewWidth] = useResizableWidth({
    storageKey: 'mailclient.connections.previewWidth',
    defaultWidth: 380,
    minWidth: 300,
    maxWidth: 720
  })

  const onDragPaletteWidth = useCallback(
    (deltaX: number): void => {
      setPaletteWidth((w) => w + deltaX)
    },
    [setPaletteWidth]
  )

  const onDragPreviewWidth = useCallback(
    (deltaX: number): void => {
      setPreviewWidth((w) => w - deltaX)
    },
    [setPreviewWidth]
  )

  const loadGraph = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const snap = await fetchEntityLinksGraph()
      setGraph(snap)
    } catch (e) {
      console.error('[connections] listGraph failed', e)
      setGraph({ nodes: [], edges: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  const {
    nodeContextMenu,
    closeNodeContextMenu,
    openNodeContextMenu
  } = useGraphNodeContextMenu(loadGraph)

  useEffect(() => {
    void loadGraph()
  }, [loadGraph])

  useEffect(() => {
    if (!graph) return
    setViewSettings((prev) => {
      const migrated = migrateLegacyComponentIslandMaps(
        graph.nodes,
        graph.edges,
        prev.componentIslandLabels,
        prev.clusterIslandStyles,
        prev.clusterIslandOffsets
      )
      if (!migrated.changed) return prev
      return {
        ...prev,
        componentIslandLabels: migrated.componentIslandLabels,
        clusterIslandStyles: migrated.clusterIslandStyles,
        clusterIslandOffsets: migrated.clusterIslandOffsets
      }
    })
  }, [graph])

  useEffect(() => {
    return subscribeEntityLinksChanged(() => {
      void loadGraph()
    })
  }, [loadGraph])

  useEffect(() => {
    if (!highlightKey || !graph) return
    const node = graph.nodes.find((n) => n.key === highlightKey)
    if (node) setSelected(node)
  }, [highlightKey, graph])

  useEffect(() => {
    if (selected) setPreviewOpen(true)
  }, [selected?.key])

  useConnectionsPanelPopoutDock({
    setPreviewOpen,
    setPreviewPlacement,
    setSelected,
    graphNodes: graph?.nodes ?? []
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || multiSelectedKeys.size === 0) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return
      setMultiSelectedKeys(new Set())
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [multiSelectedKeys.size])

  const buildScanAnchorsFromKeys = useCallback(
    (keys: Iterable<string>): EntityLinkAiScanAnchor[] => {
      if (!graph) return []
      const out: EntityLinkAiScanAnchor[] = []
      for (const key of keys) {
        const node = graph.nodes.find((n) => n.key === key)
        if (node) out.push({ ref: node.ref, title: node.title })
      }
      return out.slice(0, 50)
    },
    [graph]
  )

  const handleToggleMultiSelect = useCallback((key: string): void => {
    setMultiSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const scanAnchorsForPanel = useMemo((): EntityLinkAiScanAnchor[] | null => {
    if (multiSelectedKeys.size === 0) return null
    return buildScanAnchorsFromKeys(multiSelectedKeys)
  }, [multiSelectedKeys, buildScanAnchorsFromKeys])

  useEffect(() => {
    if (!graph) return
    void window.mailClient.aiConnections
      .getSettings()
      .then((s) => {
        setShowLinkQualityOnGraph(
          s.showLinkQualityOnGraph && s.enabled && s.hasActiveApiKey
        )
        return fetchEntityLinkGraphDensityStats(s.scanLookbackDays)
      })
      .then(setDensity)
      .catch(() => {
        setDensity(null)
        setShowLinkQualityOnGraph(false)
      })
  }, [graph])

  const reloadSuggestionHints = useCallback((): void => {
    if (!graph?.nodes.length) {
      setSuggestionHints(new Map())
      return
    }
    const refs = graph.nodes
      .filter((n) => n.kind === 'mail' || n.kind === 'mail_todo')
      .map((n) => n.ref)
    if (refs.length === 0) {
      setSuggestionHints(new Map())
      return
    }
    void fetchEntityLinkSuggestionCounts(refs)
      .then((entries) => {
        const m = new Map<string, EntityLinkSuggestionCountEntry>()
        for (const e of entries) {
          if (e.count > 0) m.set(e.anchorKey, e)
        }
        setSuggestionHints(m)
      })
      .catch(() => setSuggestionHints(new Map()))
  }, [graph])

  useEffect(() => {
    reloadSuggestionHints()
  }, [reloadSuggestionHints])

  useEffect(() => {
    if (!graph) return
    return subscribeEntityLinksChanged(() => {
      reloadSuggestionHints()
    })
  }, [graph, reloadSuggestionHints])

  const openScan = useCallback(
    (opts?: { anchors?: EntityLinkAiScanAnchor[]; profile?: EntityLinkAiScanProfile | null }): void => {
      if (opts?.anchors?.length) {
        setMultiSelectedKeys(new Set(opts.anchors.map((a) => entityRefKey(a.ref))))
      }
      setScanProfile(opts?.profile ?? null)
      setScanPanelOpen(true)
    },
    []
  )

  useEffect(() => {
    if (!pendingScanAnchors?.length) return
    setMultiSelectedKeys(new Set(pendingScanAnchors.map((a) => entityRefKey(a.ref))))
    openScan({ anchors: pendingScanAnchors })
    clearPendingAiScan()
  }, [pendingScanAnchors, clearPendingAiScan, openScan])

  useEffect(() => {
    if (!graph || !pendingFocusClusterKey) return
    const islandNodes = graph.nodes.filter((n) => n.clusterKey === pendingFocusClusterKey)
    if (islandNodes.length === 0) {
      clearPendingClusterFocus()
      return
    }
    const keys = islandNodes.map((n) => n.key)
    setEmphasisKeys(keys)
    requestFitToKeys(keys)
    clearPendingClusterFocus()
  }, [
    graph,
    pendingFocusClusterKey,
    setEmphasisKeys,
    requestFitToKeys,
    clearPendingClusterFocus
  ])

  const handleScanIsland = useCallback(
    (clusterKey: string): void => {
      if (!graph) return
      const islandNodes = graph.nodes.filter((n) => n.clusterKey === clusterKey)
      if (islandNodes.length === 0) return
      openScan({
        anchors: islandNodes.slice(0, 50).map((n) => ({ ref: n.ref, title: n.title }))
      })
    },
    [graph, openScan]
  )

  const handleMarqueeComplete = useCallback((nodeKeys: string[]): void => {
    if (nodeKeys.length === 0) return
    setMultiSelectedKeys(new Set(nodeKeys))
    openScan()
  }, [openScan])

  const handleFocusScanItem = useCallback(
    (item: EntityLinkAiScanItem): void => {
      const anchorKey = entityRefKey(item.anchor)
      const keys = item.chain
        ? item.chain.steps.map((s) => entityRefKey(s.ref))
        : [anchorKey, entityRefKey(item.suggestion.target)]
      setEmphasisKeys(keys)
      requestFitToKeys(keys)
      const anchorNode = graph?.nodes.find((n) => n.key === anchorKey)
      if (anchorNode) {
        setSelected(anchorNode)
        setHighlightRef(anchorNode.ref)
        setPreviewOpen(true)
      }
    },
    [graph, setEmphasisKeys, requestFitToKeys]
  )

  useEffect(() => {
    if (!graph) return
    setStaged((prev) =>
      prev.filter((s) => !graph.nodes.some((n) => n.key === entityRefKey(s.ref)))
    )
  }, [graph])

  const selectedKey = selected ? entityRefKey(selected.ref) : null

  const loadGraphLinkQuality = useCallback(async (): Promise<void> => {
    if (!selected || !showLinkQualityOnGraph) {
      setLinkQualityByLinkId(new Map())
      return
    }
    try {
      const result = await fetchEntityLinkQuality({ anchor: selected.ref })
      const map = new Map<number, EntityLinkQuality>()
      for (const row of result.assessments) {
        map.set(row.linkId, row.quality)
      }
      setLinkQualityByLinkId(map)
    } catch {
      setLinkQualityByLinkId(new Map())
    }
  }, [selected, showLinkQualityOnGraph])

  useEffect(() => {
    void loadGraphLinkQuality()
  }, [loadGraphLinkQuality])

  useEffect(() => {
    if (!showLinkQualityOnGraph) return
    const onRefresh = (): void => {
      void loadGraphLinkQuality()
    }
    window.addEventListener('entity-link-quality:updated', onRefresh)
    const unsub = subscribeEntityLinksChanged(onRefresh)
    return (): void => {
      window.removeEventListener('entity-link-quality:updated', onRefresh)
      unsub()
    }
  }, [showLinkQualityOnGraph, loadGraphLinkQuality])

  const stagedNodes = useMemo((): EntityGraphNode[] => {
    return staged.map((s) => ({
      key: entityRefKey(s.ref),
      ref: s.ref,
      kind: s.ref.kind,
      title: s.title,
      subtitle: s.subtitle,
      clusterKey: `kind:${s.ref.kind}`
    }))
  }, [staged])

  const fixedPositions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const s of staged) {
      m.set(entityRefKey(s.ref), { x: s.x, y: s.y })
    }
    for (const [key, pos] of pinnedPositions) {
      m.set(key, pos)
    }
    return m
  }, [staged, pinnedPositions])

  const pathHighlight: GraphPathHighlight | null = useMemo(() => {
    if (!pathOverlay) return null
    return {
      nodeKeys: new Set(pathOverlay.nodes.map((n) => n.key)),
      edgeIds: new Set(pathOverlay.edges.map((e) => e.linkId))
    }
  }, [pathOverlay])

  const clearPath = useCallback((): void => {
    setPathOverlay(null)
    setPathHops(null)
    setPathPickEnd(false)
    setPathNotFound(false)
  }, [])

  const removeStaged = useCallback((ref: ChronellEntityRef): void => {
    const key = entityRefKey(ref)
    setStaged((prev) => prev.filter((s) => entityRefKey(s.ref) !== key))
  }, [])

  const createLink = useCallback(
    async (a: ChronellEntityRef, b: ChronellEntityRef): Promise<boolean> => {
      if (entityRefKey(a) === entityRefKey(b)) return false
      setLinkBusy(true)
      try {
        await window.mailClient.entityLinks.add({ a, b })
        removeStaged(a)
        removeStaged(b)
        await loadGraph()
        return true
      } catch {
        return false
      } finally {
        setLinkBusy(false)
      }
    },
    [loadGraph, removeStaged]
  )

  const handlePaletteLink = useCallback(
    async (dragged: ChronellEntityRef, target: EntityGraphNode): Promise<void> => {
      const ok = await createLink(dragged, target.ref)
      if (ok) {
        setSelected(target)
        setHighlightRef(target.ref)
      }
    },
    [createLink, setHighlightRef]
  )

  const handlePalettePlace = useCallback(
    async (payload: GraphEntityDragPayload, x: number, y: number): Promise<void> => {
      const key = entityRefKey(payload.ref)
      const graphNode = graph?.nodes.find((n) => n.key === key)

      if (graphNode) {
        setPinnedPositions((prev) => {
          const next = new Map(prev)
          next.set(key, { x, y })
          return next
        })
        setSelected(graphNode)
        setHighlightRef(graphNode.ref)
        setPreviewOpen(true)
        return
      }

      const placed: EntityGraphNode = {
        key,
        ref: payload.ref,
        kind: payload.ref.kind,
        title: payload.title,
        subtitle: null,
        clusterKey: `kind:${payload.ref.kind}`
      }
      setStaged((prev) => {
        const rest = prev.filter((s) => entityRefKey(s.ref) !== key)
        return [
          ...rest,
          {
            ref: payload.ref,
            title: payload.title,
            subtitle: null,
            x,
            y
          }
        ]
      })
      setSelected(placed)
      setHighlightRef(payload.ref)
      setPreviewOpen(true)
      mergeSavedNodePosition(key, x, y)
    },
    [graph?.nodes, setHighlightRef, mergeSavedNodePosition]
  )

  const placeCreatedOnCanvas = useCallback(
    async (payload: {
      ref: ChronellEntityRef
      title: string
      subtitle: string | null
      anchor: ConnectionsCanvasCreateAnchor
      openPreview?: boolean
    }): Promise<void> => {
      const key = entityRefKey(payload.ref)
      const graphNode = graph?.nodes.find((n) => n.key === key)
      let placed: EntityGraphNode

      if (graphNode) {
        setPinnedPositions((prev) => {
          const next = new Map(prev)
          next.set(key, { x: payload.anchor.graphX, y: payload.anchor.graphY })
          return next
        })
        placed = graphNode
      } else {
        placed = {
          key,
          ref: payload.ref,
          kind: payload.ref.kind,
          title: payload.title,
          subtitle: payload.subtitle,
          clusterKey: `kind:${payload.ref.kind}`
        }
        setStaged((prev) => {
          const rest = prev.filter((s) => entityRefKey(s.ref) !== key)
          return [
            ...rest,
            {
              ref: payload.ref,
              title: payload.title,
              subtitle: payload.subtitle,
              x: payload.anchor.graphX,
              y: payload.anchor.graphY
            }
          ]
        })
      }

      setSelected(placed)
      setHighlightRef(payload.ref)
      if (payload.openPreview !== false) {
        setPreviewOpen(true)
      }

      mergeSavedNodePosition(key, payload.anchor.graphX, payload.anchor.graphY)

      if (selected && entityRefKey(selected.ref) !== key) {
        await createLink(selected.ref, payload.ref)
      }
    },
    [graph?.nodes, selected, createLink, setHighlightRef, mergeSavedNodePosition]
  )

  const { contextMenuProps: canvasCreateMenu, dialogs: canvasCreateDialogs } =
    useConnectionsCanvasCreate({ onEntityPlaced: placeCreatedOnCanvas })

  const handlePaletteSelect = useCallback(
    (item: EntityLinkTargetCandidate): void => {
      const node = nodeFromPaletteItem(item, graph)
      setSelected(node)
      setHighlightRef(item.target)
      setPreviewOpen(true)
      if (pathOverlay) clearPath()
    },
    [graph, setHighlightRef, pathOverlay, clearPath]
  )

  const runPathTo = useCallback(
    async (end: EntityGraphNode): Promise<void> => {
      if (!selected) return
      if (entityRefKey(end.ref) === entityRefKey(selected.ref)) {
        setPathPickEnd(false)
        return
      }
      setPathBusy(true)
      try {
        const result = await fetchEntityLinkPath({ from: selected.ref, to: end.ref })
        if (!result || result.nodes.length < 2) {
          setPathOverlay(null)
          setPathHops(null)
          setPathNotFound(true)
        } else {
          setPathNotFound(false)
          setPathOverlay(result)
          setPathHops(result.nodes.length - 1)
        }
      } finally {
        setPathBusy(false)
        setPathPickEnd(false)
      }
    },
    [selected]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={moduleShellClass}>
        <aside style={{ width: paletteWidth }} className={cn(moduleNavColumnClass, 'shrink-0')}>
          <ConnectionsObjectPalette
            className="min-h-0 flex-1"
            selectedKey={selectedKey}
            onSelectItem={handlePaletteSelect}
          />
        </aside>
        <VerticalSplitter
          variant="moduleNav"
          onDrag={onDragPaletteWidth}
          ariaLabel={t('common.moduleNavSplitter')}
        />

        <div className={cn(modulePaneStackClass, 'min-h-0 flex-col')}>
          <div className="relative z-20 shrink-0 border-b border-border">
            <div className={moduleColumnHeaderShellBarClass}>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <ConnectionsGraphControls
                  clusterMode={viewSettings.clusterMode}
                  onClusterModeChange={(mode): void =>
                    setViewSettings((s) => ({ ...s, clusterMode: mode }))
                  }
                  settings={viewSettings}
                  onSettingsChange={setViewSettings}
                />
                <div className="relative w-28 shrink-0 sm:w-36 md:w-44">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e): void => setQuery(e.target.value)}
                    placeholder={t('connections.shell.searchPlaceholder')}
                    className="h-7 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                {selected ? (
                  <button
                    type="button"
                    disabled={pathBusy || pathPickEnd}
                    onClick={(): void => {
                      clearPath()
                      setPathPickEnd(true)
                    }}
                    className={cn(moduleColumnHeaderOutlineSmClass, 'h-7 shrink-0 gap-1 px-2')}
                    title={t('connections.path.findTitle')}
                  >
                    <Route className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden lg:inline">{t('connections.path.find')}</span>
                  </button>
                ) : null}
                {pathOverlay || pathPickEnd ? (
                  <button
                    type="button"
                    onClick={clearPath}
                    className={cn(moduleColumnHeaderOutlineSmClass, 'h-7 shrink-0 px-2')}
                    title={t('connections.path.clear')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <div className={cn(moduleColumnHeaderActionsClass, 'gap-1')}>
                {selected ? (
                  <CalendarPreviewPaneToolbarButton
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    hideTitleKey="connections.preview.hideTitle"
                    showTitleKey="connections.preview.showTitle"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={saveGraphLayout}
                  className={cn(moduleColumnHeaderOutlineSmClass, 'h-7 shrink-0 gap-1 px-2')}
                  title={t('connections.shell.saveLayoutTitle')}
                >
                  <Save className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden lg:inline">{t('connections.shell.saveLayout')}</span>
                </button>
                <button
                  type="button"
                  onClick={relayoutGraph}
                  disabled={!graph}
                  className={cn(moduleColumnHeaderOutlineSmClass, 'h-7 shrink-0 gap-1 px-2')}
                  title={t('connections.shell.relayoutTitle')}
                >
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden lg:inline">{t('connections.shell.relayout')}</span>
                </button>
                <button
                  type="button"
                  onClick={(): void => (scanPanelOpen ? setScanPanelOpen(false) : openScan())}
                  className={cn(
                    moduleColumnHeaderOutlineSmClass,
                    'h-7 shrink-0 gap-1 px-2',
                    scanPanelOpen && 'border-primary bg-primary/10'
                  )}
                  title={
                    multiSelectedKeys.size > 0
                      ? t('connections.scan.titleSelection', {
                          count: multiSelectedKeys.size
                        })
                      : t('connections.scan.title')
                  }
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden lg:inline">{t('connections.scan.title')}</span>
                </button>
                {density && density.mailUnlinked > 0 ? (
                  <button
                    type="button"
                    onClick={(): void => openScan({ profile: 'sparse_mails' })}
                    className={cn(moduleColumnHeaderOutlineSmClass, 'h-7 shrink-0 gap-1 px-2')}
                    title={t('connections.shell.densityScanTitle')}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden xl:inline">
                      {t('connections.shell.densityScan', {
                        percent: density.mailUnlinkedPercent
                      })}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
            <p
              className={cn(
                'truncate border-t border-border/50 px-2 py-1 text-[11px] text-muted-foreground sm:px-3',
                (pathPickEnd || pathNotFound || pathHops != null) && 'text-foreground'
              )}
            >
              {pathPickEnd
                ? t('connections.path.pickEndHint')
                : pathNotFound
                  ? t('connections.path.none')
                  : pathHops != null
                    ? t('connections.path.result', { hops: pathHops })
                    : density && density.mailInRange > 0
                      ? t('connections.shell.densityHint', {
                          percent: density.mailUnlinkedPercent,
                          count: density.mailUnlinked
                        })
                      : graph
                        ? t('connections.shell.stats', {
                            nodes: graph.nodes.length,
                            edges: graph.edges.length
                          })
                        : t('connections.shell.subtitle')}
            </p>
            <ConnectionsEmbeddingIndexBar />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-row">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {loading && !graph ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('connections.shell.loading')}
            </div>
          ) : graph ? (
            <ConnectionsGraphWithFilter
              allNodes={graph.nodes}
              allEdges={graph.edges}
              query={query}
              clusterMode={viewSettings.clusterMode}
              viewSettings={viewSettings}
              onRenameComponentIsland={renameComponentIsland}
              onResetComponentIsland={resetComponentIsland}
              onSetIslandStyle={setIslandStyle}
              onResetIslandStyle={resetIslandStyle}
              layoutEpoch={graphLayoutEpoch}
              saveLayoutRequest={saveLayoutRequest}
              onPersistGraphLayout={persistGraphLayout}
              selectedKey={selectedKey}
              pathHighlight={pathHighlight}
              pathOverlay={pathOverlay}
              stagedNodes={stagedNodes}
              fixedPositions={fixedPositions}
              enablePaletteDrop
              onPaletteLink={handlePaletteLink}
              onPalettePlace={handlePalettePlace}
              onCanvasContextMenu={canvasCreateMenu.onCanvasContextMenu}
              onNodeContextMenu={(node, anchor): void => {
                setSelected(node)
                setHighlightRef(node.ref)
                setPreviewOpen(true)
                openNodeContextMenu(node, anchor)
              }}
              multiSelectedKeys={multiSelectedKeys}
              onToggleMultiSelect={handleToggleMultiSelect}
              onMarqueeComplete={handleMarqueeComplete}
              onScanIsland={handleScanIsland}
              suggestionHints={suggestionHints}
              linkQualityByLinkId={
                showLinkQualityOnGraph ? linkQualityByLinkId : undefined
              }
              onSelectNode={(node): void => {
                if (pathPickEnd && node) {
                  void runPathTo(node)
                  setSelected(node)
                  setHighlightRef(node.ref)
                  return
                }
                setMultiSelectedKeys(new Set())
                setEmphasisKeys(null)
                setSelected(node)
                if (node) setPreviewOpen(true)
                setHighlightRef(node?.ref ?? null)
                if (pathOverlay) clearPath()
              }}
            />
          ) : null}
          {linkBusy ? (
            <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-border bg-card/95 px-2 py-1 text-[10px] shadow-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('connections.graph.linking')}
            </div>
          ) : null}
          <ConnectionsAiScanPanel
            open={scanPanelOpen}
            scanAnchors={scanAnchorsForPanel}
            scanProfile={scanProfile}
            autoStartScan={pendingAutoStartScan}
            onClose={(): void => {
              setScanPanelOpen(false)
              setScanProfile(null)
            }}
            onAccepted={(): void => void loadGraph()}
            onFocusItem={handleFocusScanItem}
          />
          </div>

        {selected ? (
          <>
            <ConnectionsPreviewPane
              key={selectedKey ?? undefined}
              node={selected}
              open={previewOpen}
              placement={previewPlacement}
              onPlacementChange={setPreviewPlacement}
              onClose={(): void => setPreviewOpen(false)}
              dockWidthPx={previewWidth}
              onDockWidthDrag={onDragPreviewWidth}
              onOpenInModule={(): void => {
                void openEntityRef(selected.ref, setAppMode)
              }}
            />
            {!previewOpen && previewPlacement === 'dock' ? (
              <aside className="hidden w-56 shrink-0 items-center justify-center border-l border-border p-4 text-center text-xs text-muted-foreground lg:flex">
                {t('connections.preview.closedHint')}
              </aside>
            ) : null}
          </>
        ) : (
          <aside className="hidden w-56 shrink-0 items-center justify-center border-l border-border p-4 text-center text-xs text-muted-foreground lg:flex">
            {t('connections.shell.selectNodeHint')}
          </aside>
        )}
          </div>
        </div>
      </div>
      {canvasCreateDialogs}
      {nodeContextMenu ? (
        <ContextMenu
          x={nodeContextMenu.x}
          y={nodeContextMenu.y}
          items={nodeContextMenu.items}
          onClose={closeNodeContextMenu}
        />
      ) : null}
    </div>
  )
}
