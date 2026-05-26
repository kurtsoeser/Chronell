import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link2, Loader2, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type { EntityLinkSuggestionCountEntry } from '@shared/entity-link-ai-payload'
import type { EntityGraphClusterMode, EntityGraphEdge, EntityGraphNode } from '@shared/entity-links'
import { formatCalendarEventWhenLabel, formatDueIsoWhenLabel } from '@shared/calendar-datetime'
import {
  islandStyleToFillRgba,
  islandStyleToStrokeRgba
} from '@/app/connections/cluster-island-style'
import { accountColorToRgba } from '@/lib/avatar-color'
import { cn } from '@/lib/utils'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import { useAccountsStore } from '@/stores/accounts'
import { graphEdgeQualityStroke } from '@/app/connections/graph-link-quality-colors'
import { useConnectionsGraphFocusStore } from '@/stores/connections-graph-focus'
import type { EntityLinkQuality } from '@shared/entity-links'
import type { ConnectionsGraphViewSettings } from '@/app/connections/connections-graph-view-settings'
import { clusterLabelForKey } from '@/app/connections/connections-graph-labels'
import { applyConnectionsGraphFilters } from '@/app/connections/connections-graph-filters'
import {
  applyNodePositions,
  buildMeasuredLayout,
  pickSavedNodePositions,
  computeClusterHulls,
  filterGraphByQuery,
  graphContentBounds,
  graphLayoutStructureKey,
  layoutNodesToRecord,
  relayoutIslandClusterNodes,
  runAutoGraphLayout,
  type ClusterHull,
  type LayoutNode
} from '@/app/connections/connections-graph-layout'
import { useClusterIslandDrag } from '@/app/connections/use-cluster-island-drag'
import { useGraphNodeDrag } from '@/app/connections/use-graph-node-drag'
import {
  buildGraphFocus,
  edgeActiveForFocus,
  edgeOnPath,
  edgeOpacity,
  nodeOnPath,
  nodeRoleForFocus,
  type GraphPathHighlight
} from '@/app/connections/graph-focus'
import {
  boundsForLayoutKeys,
  buildUndirectedEdgePairSet,
  clientToGraphPoint,
  edgeLineBetweenNodes,
  hitTestLayoutNode
} from '@/app/connections/graph-coords'
import { useGraphMarqueeSelect } from '@/app/connections/use-graph-marquee-select'
import type { ConnectionsCanvasCreateAnchor } from '@/app/connections/connections-canvas-create'
import { useGraphLinkDrag } from '@/app/connections/use-graph-link-drag'
import { useGraphPaletteDrop } from '@/app/connections/use-graph-palette-drop'
import { useGraphViewport } from '@/app/connections/use-graph-viewport'
import {
  ClusterIslandHullBackground,
  ClusterIslandHullLabelOverlay
} from '@/app/connections/ClusterIslandHullLabels'
import { useListClusterLabels } from '@/app/connections/use-list-cluster-labels'

function resolveRendererCalendarTimeZone(configured: string | null | undefined): string {
  const t = configured?.trim()
  if (t && t !== 'local') return t
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function withFormattedGraphSubtitles(
  nodes: EntityGraphNode[],
  timeZone: string,
  localeCode: 'de' | 'en'
): EntityGraphNode[] {
  return nodes.map((node) => {
    if (!node.subtitle?.trim()) return node
    const raw = node.subtitle.trim()
    if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return node
    let formatted: string | null = null
    if (node.ref.kind === 'calendar_event') {
      formatted = formatCalendarEventWhenLabel(raw, timeZone, localeCode, false)
    } else if (node.ref.kind === 'cloud_task' || node.ref.kind === 'mail_todo') {
      formatted = formatDueIsoWhenLabel(raw, timeZone, localeCode)
    }
    return formatted ? { ...node, subtitle: formatted } : node
  })
}

const KIND_DOT: Record<string, string> = {
  mail: '#0ea5e9',
  mail_todo: '#f59e0b',
  cloud_task: '#10b981',
  calendar_event: '#8b5cf6',
  note: '#ca8a04',
  people_contact: '#f43f5e'
}

const CLUSTER_FILL: Record<string, string> = {
  'scope:notes': 'rgba(202, 138, 4, 0.06)',
  'scope:contacts': 'rgba(244, 63, 94, 0.06)'
}

const DEFAULT_CLUSTER_FILL = 'rgba(148, 163, 184, 0.05)'

/** Halo um fokussierte Knoten (px, Graph-Koordinaten). */
const NODE_FOCUS_SHADOW_PAD = 6
const NODE_FOCUS_RING_PAD = 4
const NODE_CORNER_RX = 8

export function ConnectionsGraph({
  nodes,
  edges,
  allEdges,
  selectedKey,
  clusterMode,
  viewSettings,
  pathHighlight = null,
  compact = false,
  fixedPositions,
  stagedKeys,
  enablePaletteDrop = false,
  onPaletteLink,
  onPalettePlace,
  onRenameComponentIsland,
  onResetComponentIsland,
  onSetIslandStyle,
  onResetIslandStyle,
  layoutEpoch = 0,
  saveLayoutRequest = 0,
  onPersistGraphLayout,
  onCanvasContextMenu,
  onNodeContextMenu,
  onSelectNode,
  multiSelectedKeys,
  onToggleMultiSelect,
  onMarqueeComplete,
  onScanIsland,
  suggestionHints,
  linkQualityByLinkId
}: {
  nodes: EntityGraphNode[]
  edges: EntityGraphEdge[]
  /** Alle Kanten (auch außerhalb des Filters) für Duplikat-Prüfung beim Ziehen. */
  allEdges: EntityGraphEdge[]
  selectedKey: string | null
  clusterMode: EntityGraphClusterMode
  viewSettings?: ConnectionsGraphViewSettings
  pathHighlight?: GraphPathHighlight | null
  /** Kompakte Einbettung (z. B. Lesefenster): weniger Höhe, keine Zoom-Leiste. */
  compact?: boolean
  fixedPositions?: Map<string, { x: number; y: number }>
  stagedKeys?: ReadonlySet<string>
  enablePaletteDrop?: boolean
  onPaletteLink?: (dragged: ChronellEntityRef, target: EntityGraphNode) => void | Promise<void>
  onPalettePlace?: (
    payload: import('@/app/connections/graph-entity-drag').GraphEntityDragPayload,
    x: number,
    y: number
  ) => void | Promise<void>
  onRenameComponentIsland?: (clusterKey: string, name: string) => void
  onResetComponentIsland?: (clusterKey: string) => void
  onSetIslandStyle?: (
    clusterKey: string,
    style: import('@/app/connections/cluster-island-style').ClusterIslandStyle
  ) => void
  onResetIslandStyle?: (clusterKey: string) => void
  /** Erhoehen loest automatische Neu-Anordnung aus (Aktualisieren-Button). */
  layoutEpoch?: number
  /** Erhoehen speichert die aktuelle Anordnung explizit. */
  saveLayoutRequest?: number
  onPersistGraphLayout?: (
    structureKey: string,
    nodePositions: Record<string, { x: number; y: number }>,
    options?: { replace?: boolean }
  ) => void
  onCanvasContextMenu?: (anchor: ConnectionsCanvasCreateAnchor) => void
  onNodeContextMenu?: (
    node: EntityGraphNode,
    anchor: { x: number; y: number }
  ) => void
  onSelectNode: (node: EntityGraphNode | null) => void
  multiSelectedKeys?: ReadonlySet<string>
  onToggleMultiSelect?: (key: string) => void
  onMarqueeComplete?: (nodeKeys: string[]) => void
  onScanIsland?: (clusterKey: string) => void
  suggestionHints?: ReadonlyMap<string, EntityLinkSuggestionCountEntry>
  linkQualityByLinkId?: ReadonlyMap<number, EntityLinkQuality>
}): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const graphGroupRef = useRef<SVGGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 520 })
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const highlightKey = useConnectionsGraphFocusStore((s) => s.highlightKey)
  const emphasisKeys = useConnectionsGraphFocusStore((s) => s.emphasisKeys)
  const fitToKeys = useConnectionsGraphFocusStore((s) => s.fitToKeys)
  const clearFitToKeys = useConnectionsGraphFocusStore((s) => s.clearFitToKeys)
  const layoutStructureKey = useMemo(
    () => graphLayoutStructureKey(nodes, edges, clusterMode),
    [nodes, edges, clusterMode]
  )
  const displayLayoutRef = useRef<LayoutNode[]>([])
  const fitAfterRelayoutRef = useRef(false)
  const lastProcessedLayoutEpochRef = useRef(0)

  const effectiveFocusKey = pathHighlight ? null : selectedKey ?? highlightKey
  const emphasisFocus = useMemo(() => {
    if (pathHighlight || !emphasisKeys?.length) return null
    const keys = new Set(emphasisKeys)
    const activeEdgeIds = new Set<number>()
    for (const e of edges) {
      if (keys.has(e.aKey) && keys.has(e.bKey)) activeEdgeIds.add(e.linkId)
    }
    const neighborKeys = new Set(emphasisKeys)
    neighborKeys.delete(emphasisKeys[0]!)
    return {
      focusKey: emphasisKeys[0]!,
      neighborKeys,
      highlightKeys: keys,
      activeEdgeIds,
      degree: Math.max(0, emphasisKeys.length - 1)
    }
  }, [emphasisKeys, edges, pathHighlight])
  const focus = useMemo(() => {
    if (emphasisFocus) return emphasisFocus
    if (!effectiveFocusKey) return null
    const depth = viewSettings?.focusDepth === 2 ? 2 : 1
    return buildGraphFocus(effectiveFocusKey, edges, depth)
  }, [emphasisFocus, effectiveFocusKey, edges, viewSettings?.focusDepth])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({ w: Math.max(320, cr.width), h: Math.max(280, cr.height) })
    })
    ro.observe(el)
    return (): void => ro.disconnect()
  }, [])

  const measuredLayout = useMemo(
    () => buildMeasuredLayout(nodes, edges, clusterMode),
    [nodes, edges, clusterMode]
  )

  const savedLayout = viewSettings?.savedGraphLayout

  const baseLayout = useMemo(() => {
    const pinned = fixedPositions
    const keys = measuredLayout.map((n) => n.key)
    const positions = pickSavedNodePositions(keys, savedLayout)
    const laid = applyNodePositions(measuredLayout, positions, size.w, size.h)
    if (!pinned?.size) return laid
    return laid.map((n) => {
      const pin = pinned.get(n.key)
      return pin ? { ...n, x: pin.x, y: pin.y } : n
    })
  }, [measuredLayout, savedLayout, size.w, size.h, fixedPositions])

  useEffect(() => {
    if (compact || nodes.length === 0 || !onPersistGraphLayout) return
    if (layoutEpoch === 0 || layoutEpoch <= lastProcessedLayoutEpochRef.current) return
    lastProcessedLayoutEpochRef.current = layoutEpoch

    const result = runAutoGraphLayout(
      nodes,
      edges,
      size.w,
      size.h,
      clusterMode,
      viewSettings?.clusterSpacing ?? 1
    )
    onPersistGraphLayout(layoutStructureKey, layoutNodesToRecord(result), { replace: true })
    fitAfterRelayoutRef.current = true
  }, [
    layoutEpoch,
    compact,
    nodes,
    edges,
    size.w,
    size.h,
    clusterMode,
    layoutStructureKey,
    onPersistGraphLayout,
    viewSettings?.clusterSpacing
  ])

  const listClusterLabels = useListClusterLabels(nodes)

  const accountColorById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.color] as const)),
    [accounts]
  )

  const islandStyles = viewSettings?.clusterIslandStyles ?? {}

  const clusterFill = useCallback(
    (key: string): string => {
      const custom = islandStyles[key]
      if (custom) return islandStyleToFillRgba(custom)
      if (CLUSTER_FILL[key]) return CLUSTER_FILL[key]!
      if (key.startsWith('account:')) {
        const id = key.slice('account:'.length)
        return accountColorToRgba(accountColorById.get(id), 0.045) ?? DEFAULT_CLUSTER_FILL
      }
      if (key.startsWith('kind:')) return 'rgba(148, 163, 184, 0.06)'
      return DEFAULT_CLUSTER_FILL
    },
    [accountColorById, islandStyles]
  )

  const clusterStroke = useCallback(
    (key: string): string | undefined => {
      const custom = islandStyles[key]
      if (custom) return islandStyleToStrokeRgba(custom)
      if (clusterMode !== 'account' || !key.startsWith('account:')) return undefined
      const id = key.slice('account:'.length)
      return accountColorToRgba(accountColorById.get(id), 0.28) ?? undefined
    },
    [accountColorById, clusterMode, islandStyles]
  )

  const labelForCluster = useCallback(
    (key: string): string =>
      clusterLabelForKey(
        key,
        t,
        accounts,
        viewSettings?.componentIslandLabels,
        listClusterLabels
      ),
    [t, accounts, viewSettings?.componentIslandLabels, listClusterLabels]
  )

  const edgeScale = viewSettings?.edgeThickness ?? 1

  const persistCurrentLayout = useCallback(
    (layoutNodes: LayoutNode[]): void => {
      if (!onPersistGraphLayout) return
      onPersistGraphLayout(layoutStructureKey, layoutNodesToRecord(layoutNodes))
    },
    [layoutStructureKey, onPersistGraphLayout]
  )

  const commitIslandShift = useCallback(
    (clusterKey: string, dx: number, dy: number): void => {
      const next = baseLayout.map((n) =>
        n.layoutClusterKey === clusterKey ? { ...n, x: n.x + dx, y: n.y + dy } : n
      )
      persistCurrentLayout(next)
    },
    [baseLayout, persistCurrentLayout]
  )

  const commitNodeShift = useCallback(
    (nodeKey: string, dx: number, dy: number): void => {
      const next = baseLayout.map((n) =>
        n.key === nodeKey ? { ...n, x: n.x + dx, y: n.y + dy } : n
      )
      persistCurrentLayout(next)
    },
    [baseLayout, persistCurrentLayout]
  )

  const bounds = useMemo(() => graphContentBounds(baseLayout), [baseLayout])

  const hullOpacityForFocus = useCallback(
    (hull: ClusterHull): number => {
      if (!focus) return 1
      const hullActive = baseLayout.some(
        (n) =>
          n.layoutClusterKey === hull.key &&
          (n.key === focus.focusKey || focus.neighborKeys.has(n.key))
      )
      return hullActive ? 0.95 : 0.2
    },
    [focus, baseLayout]
  )

  const hullStrokeClassForFocus = useCallback(
    (hull: ClusterHull): string | undefined => {
      if (clusterMode === 'account' && hull.key.startsWith('account:')) return undefined
      if (!focus) return undefined
      const hullActive = baseLayout.some(
        (n) =>
          n.layoutClusterKey === hull.key &&
          (n.key === focus.focusKey || focus.neighborKeys.has(n.key))
      )
      return hullActive ? 'text-primary/50' : undefined
    },
    [focus, baseLayout, clusterMode]
  )

  const kindDot = useCallback(
    (kind: string): string =>
      viewSettings?.kindColors[kind as keyof typeof viewSettings.kindColors] ??
      KIND_DOT[kind] ??
      '#94a3b8',
    [viewSettings?.kindColors]
  )

  const { viewport, fitToContent, fitToBounds, resetView, zoomBy, onPointerDown, onPointerMove, onPointerUp } =
    useGraphViewport(size, bounds, containerRef)

  useEffect(() => {
    if (!fitToKeys?.length) return
    const b = boundsForLayoutKeys(displayLayoutRef.current, fitToKeys)
    if (b) fitToBounds(b)
    clearFitToKeys()
  }, [fitToKeys, fitToBounds, clearFitToKeys])

  const { liveOffset: islandDragLive, onIslandDragStart } = useClusterIslandDrag({
    viewport,
    svgRef,
    enabled: clusterMode !== 'none' && !compact && Boolean(onPersistGraphLayout),
    onCommit: commitIslandShift
  })

  const { liveDrag: nodeDragLive, onNodeDragStart, didDragRef: nodeDidDragRef } =
    useGraphNodeDrag({
      viewport,
      svgRef,
      enabled: !compact && Boolean(onPersistGraphLayout),
      onCommit: commitNodeShift
    })

  const displayLayout = useMemo(() => {
    let out = baseLayout
    if (islandDragLive) {
      out = out.map((n) =>
        n.layoutClusterKey === islandDragLive.clusterKey
          ? { ...n, x: n.x + islandDragLive.dx, y: n.y + islandDragLive.dy }
          : n
      )
    }
    if (nodeDragLive) {
      out = out.map((n) =>
        n.key === nodeDragLive.nodeKey
          ? { ...n, x: n.x + nodeDragLive.dx, y: n.y + nodeDragLive.dy }
          : n
      )
    }
    return out
  }, [baseLayout, islandDragLive, nodeDragLive])

  displayLayoutRef.current = displayLayout

  useEffect(() => {
    if (!saveLayoutRequest || !onPersistGraphLayout) return
    persistCurrentLayout(displayLayoutRef.current)
  }, [saveLayoutRequest, onPersistGraphLayout, persistCurrentLayout])

  const hulls = useMemo(
    () =>
      clusterMode === 'none'
        ? []
        : computeClusterHulls(displayLayout, labelForCluster),
    [displayLayout, labelForCluster, clusterMode]
  )

  const clusterNodeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of displayLayout) {
      const k = n.layoutClusterKey
      if (!k) continue
      counts[k] = (counts[k] ?? 0) + 1
    }
    return counts
  }, [displayLayout])

  const relayoutIslandCluster = useCallback(
    (clusterKey: string): void => {
      if (!onPersistGraphLayout) return
      const hull = hulls.find((h) => h.key === clusterKey)
      if (!hull) return
      const clusterNodes = displayLayoutRef.current.filter(
        (n) => n.layoutClusterKey === clusterKey
      )
      if (clusterNodes.length < 2) return
      const relayouted = relayoutIslandClusterNodes(
        hull,
        clusterNodes,
        edges,
        viewSettings?.clusterSpacing ?? 1
      )
      const byKey = new Map(relayouted.map((n) => [n.key, n]))
      const next = displayLayoutRef.current.map((n) => byKey.get(n.key) ?? n)
      persistCurrentLayout(next)
    },
    [hulls, edges, onPersistGraphLayout, persistCurrentLayout, viewSettings?.clusterSpacing]
  )

  const didInitialFitRef = useRef(false)
  useEffect(() => {
    if (compact) didInitialFitRef.current = false
  }, [compact, nodes, edges, size.w, size.h])

  useEffect(() => {
    if (!bounds) return
    if (!didInitialFitRef.current) {
      didInitialFitRef.current = true
      fitToContent()
      return
    }
    if (fitAfterRelayoutRef.current) {
      fitAfterRelayoutRef.current = false
      fitToContent()
    }
  }, [bounds, fitToContent])

  const posByKey = useMemo(() => {
    const m = new Map<string, LayoutNode>()
    for (const n of displayLayout) m.set(n.key, n)
    return m
  }, [displayLayout])

  const edgePairs = useMemo(() => buildUndirectedEdgePairSet(allEdges), [allEdges])

  const { linkDrag, dropTargetKey, linkBusy, startLinkDrag } = useGraphLinkDrag({
    layout: displayLayout,
    edgePairs,
    svgRef,
    graphGroupRef,
    onLinked: (target): void => onSelectNode(target)
  })

  const {
    paletteDragOver,
    paletteDropTargetKey,
    onDragEnter: onPaletteDragEnter,
    onDragOver,
    onDragLeave: onPaletteDragLeave,
    onDrop
  } = useGraphPaletteDrop({
      layout: displayLayout,
      svgRef,
      graphGroupRef,
      enabled: enablePaletteDrop && !compact,
      onDropOnNode: async (dragged, target): Promise<void> => {
        await onPaletteLink?.(dragged, target.node)
      },
      onDropOnCanvas: async (payload, x, y): Promise<void> => {
        await onPalettePlace?.(payload, x, y)
      }
    })

  const effectiveDropTargetKey = dropTargetKey ?? paletteDropTargetKey
  const showEmptyCanvasHint = nodes.length === 0 && enablePaletteDrop && !compact

  const openCanvasContextMenu = useCallback(
    (clientX: number, clientY: number, graphX: number, graphY: number): void => {
      if (!onCanvasContextMenu || linkDrag || paletteDragOver) return
      onCanvasContextMenu({ clientX, clientY, graphX, graphY })
    },
    [onCanvasContextMenu, linkDrag, paletteDragOver]
  )

  const {
    marquee,
    onContainerPointerDown: onMarqueePointerDown,
    onContainerPointerMove: onMarqueePointerMove,
    onContainerPointerUp: onMarqueePointerUp,
    onContainerContextMenu: onMarqueeContextMenu
  } = useGraphMarqueeSelect({
    enabled: !compact && Boolean(onCanvasContextMenu || onMarqueeComplete),
    layout: displayLayout,
    svgRef,
    graphGroupRef,
    onCanvasContextMenu: openCanvasContextMenu,
    onMarqueeComplete
  })

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-0 overflow-hidden bg-background',
        compact ? 'h-full min-h-0 flex-1' : 'flex-1',
        paletteDragOver && enablePaletteDrop && 'ring-2 ring-inset ring-primary/30'
      )}
      onContextMenu={!compact ? onMarqueeContextMenu : undefined}
      onPointerDown={!compact ? onMarqueePointerDown : undefined}
      onPointerMove={!compact ? onMarqueePointerMove : undefined}
      onPointerUp={!compact ? onMarqueePointerUp : undefined}
      onDragEnter={enablePaletteDrop && !compact ? onPaletteDragEnter : undefined}
      onDragOver={enablePaletteDrop && !compact ? onDragOver : undefined}
      onDragLeave={enablePaletteDrop && !compact ? onPaletteDragLeave : undefined}
      onDrop={enablePaletteDrop && !compact ? (e): void => void onDrop(e) : undefined}
    >
      {showEmptyCanvasHint ? (
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center p-8 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            {paletteDragOver
              ? t('connections.graph.emptyDropActive')
              : t('connections.graph.emptyDropHint')}
          </p>
        </div>
      ) : null}
      {!compact ? (
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
        <button
          type="button"
          title={t('connections.graph.zoomIn')}
          className="rounded-md border border-border bg-card/95 p-1.5 shadow-sm hover:bg-secondary"
          onClick={(): void => zoomBy(1.2)}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={t('connections.graph.zoomOut')}
          className="rounded-md border border-border bg-card/95 p-1.5 shadow-sm hover:bg-secondary"
          onClick={(): void => zoomBy(1 / 1.2)}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={t('connections.graph.fitView')}
          className="rounded-md border border-border bg-card/95 p-1.5 shadow-sm hover:bg-secondary"
          onClick={fitToContent}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={t('connections.graph.resetView')}
          className="rounded-md border border-border bg-card/95 p-1.5 shadow-sm hover:bg-secondary"
          onClick={resetView}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      ) : null}

      <p className="pointer-events-none absolute bottom-2 left-3 z-10 max-w-md text-xs text-muted-foreground">
        {paletteDragOver
          ? t('connections.palette.dropHint')
          : linkDrag
            ? t('connections.graph.hintLinkDrag')
            : (multiSelectedKeys?.size ?? 0) > 0
              ? t('connections.graph.multiSelectCount', {
                  count: multiSelectedKeys!.size
                })
              : pathHighlight
                ? t('connections.graph.hintPath')
                : focus
                  ? t('connections.graph.hintFocus', { count: focus.degree })
                  : compact
                    ? t('connections.localGraph.hint')
                    : enablePaletteDrop
                      ? t('connections.palette.hintGraph')
                      : t('connections.graph.hintPanZoom')}
      </p>

      {linkBusy ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-border bg-card/95 px-2 py-1 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('connections.graph.linking')}
        </div>
      ) : null}

      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className={cn(
          'h-full w-full touch-none select-none',
          (linkDrag || paletteDragOver) && 'cursor-crosshair'
        )}
        onDragEnter={enablePaletteDrop ? onPaletteDragEnter : undefined}
        onDragOver={enablePaletteDrop ? onDragOver : undefined}
        onDragLeave={enablePaletteDrop ? onPaletteDragLeave : undefined}
        onDrop={enablePaletteDrop ? (e): void => void onDrop(e) : undefined}
        onPointerDown={linkDrag || paletteDragOver ? undefined : onPointerDown}
        onPointerMove={linkDrag || paletteDragOver ? undefined : onPointerMove}
        onPointerUp={linkDrag || paletteDragOver ? undefined : onPointerUp}
        onClick={(): void => {
          if (linkDrag || paletteDragOver) return
          setHoverKey(null)
          onSelectNode(null)
        }}
      >
        <defs>
          <filter
            id="graph-node-focus-shadow"
            x="-45%"
            y="-45%"
            width="190%"
            height="190%"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow dx="0" dy="2" stdDeviation="7" floodColor="#000000" floodOpacity="0.72" />
          </filter>
        </defs>
        {focus || pathHighlight ? (
          <rect
            width={size.w}
            height={size.h}
            className="fill-background/40 pointer-events-none"
          />
        ) : null}
        <g
          ref={graphGroupRef}
          transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`}
        >
          {!compact ? (
            <ClusterIslandHullBackground
              hulls={hulls}
              clusterFill={clusterFill}
              clusterStroke={clusterStroke}
              hullOpacity={hullOpacityForFocus}
              hullStrokeClass={hullStrokeClassForFocus}
              showLabels={clusterMode !== 'component' && clusterMode !== 'none'}
            />
          ) : null}

          <g className="pointer-events-none" aria-hidden>
          {edges.map((e) => {
            const a = posByKey.get(e.aKey)
            const b = posByKey.get(e.bKey)
            if (!a || !b) return null
            const { x1, y1, x2, y2 } = edgeLineBetweenNodes(a, b)
            const onPath = edgeOnPath(e.linkId, pathHighlight)
            const active = pathHighlight ? onPath : edgeActiveForFocus(e, focus, hoverKey)
            const derived = e.linkKind === 'derived_from'
            const qualityStroke = graphEdgeQualityStroke(linkQualityByLinkId?.get(e.linkId))
            const stroke =
              qualityStroke ??
              (active ? 'hsl(var(--primary))' : 'currentColor')
            return (
              <line
                key={e.linkId}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                className={
                  qualityStroke ? undefined : active ? undefined : 'text-border'
                }
                strokeWidth={
                  (pathHighlight && onPath ? 3 : active ? 2.5 : 1) * edgeScale
                }
                strokeDasharray={derived ? '6 4' : undefined}
                opacity={
                  pathHighlight
                    ? onPath
                      ? 0.95
                      : 0.08
                    : edgeOpacity(active, Boolean(focus), Boolean(hoverKey))
                }
              />
            )
          })}
          </g>

          {linkDrag ? (
            <g className="pointer-events-none" aria-hidden>
              <line
                x1={linkDrag.fromX}
                y1={linkDrag.fromY}
                x2={linkDrag.toX}
                y2={linkDrag.toY}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.9}
              />
            </g>
          ) : null}

          {marquee ? (
            <g className="pointer-events-none" aria-hidden>
              <rect
                x={Math.min(marquee.x1, marquee.x2)}
                y={Math.min(marquee.y1, marquee.y2)}
                width={Math.abs(marquee.x2 - marquee.x1)}
                height={Math.abs(marquee.y2 - marquee.y1)}
                fill="hsl(var(--primary) / 0.15)"
                stroke="hsl(var(--primary))"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            </g>
          ) : null}

          {displayLayout.map((n) => {
            const role = nodeRoleForFocus(n.key, focus, hoverKey, edges)
            const Icon = entityRefKindIcon(n.node.kind)
            const dot = kindDot(n.node.kind)
            const x = n.x - n.w / 2
            const y = n.y - n.h / 2
            const onPathNode = nodeOnPath(n.key, pathHighlight)
            const dimmed = pathHighlight
              ? !onPathNode
              : role === 'dim' && !linkDrag
            const isFocus = !pathHighlight && role === 'focus'
            const isNeighbor = !pathHighlight && role === 'neighbor'
            const isHover = !pathHighlight && role === 'hover'
            const isDropTarget = effectiveDropTargetKey === n.key
            const isLinkSource = linkDrag?.fromKey === n.key
            const isStaged = stagedKeys?.has(n.key) ?? false
            const isMultiSelected = multiSelectedKeys?.has(n.key) ?? false
            const showHandle = !compact && (!linkDrag || isLinkSource)
            const handleX = n.x + n.w / 2 - 2
            const handleY = n.y
            return (
              <g
                key={n.key}
                data-graph-node
                className={cn(
                  'cursor-pointer',
                  !compact && onPersistGraphLayout && 'cursor-grab active:cursor-grabbing'
                )}
                onPointerDown={(ev): void => {
                  if (compact || linkDrag) return
                  if ((ev.target as Element).closest('[data-link-handle]')) return
                  ev.stopPropagation()
                  onNodeDragStart(n.key, ev.clientX, ev.clientY)
                }}
                opacity={
                  linkDrag && !isDropTarget && !isLinkSource
                    ? 0.35
                    : dimmed
                      ? 0.12
                      : pathHighlight && onPathNode
                        ? 1
                        : 1
                }
                onMouseEnter={(): void => {
                  if (!linkDrag) setHoverKey(n.key)
                }}
                onMouseLeave={(): void => {
                  if (!linkDrag) setHoverKey(null)
                }}
                onClick={(ev): void => {
                  if (linkDrag || nodeDidDragRef.current) {
                    nodeDidDragRef.current = false
                    return
                  }
                  ev.stopPropagation()
                  setHoverKey(null)
                  if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
                    onToggleMultiSelect?.(n.key)
                    return
                  }
                  onSelectNode(n.node)
                }}
                onContextMenu={
                  !compact && onNodeContextMenu
                    ? (ev): void => {
                        if (linkDrag) return
                        ev.preventDefault()
                        ev.stopPropagation()
                        onNodeContextMenu(n.node, { x: ev.clientX, y: ev.clientY })
                      }
                    : undefined
                }
              >
                {isMultiSelected ? (
                  <rect
                    x={x - NODE_FOCUS_RING_PAD}
                    y={y - NODE_FOCUS_RING_PAD}
                    width={n.w + NODE_FOCUS_RING_PAD * 2}
                    height={n.h + NODE_FOCUS_RING_PAD * 2}
                    rx={NODE_CORNER_RX + 2}
                    fill="hsl(var(--primary) / 0.12)"
                    className="stroke-primary"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                ) : null}
                {isFocus ? (
                  <rect
                    x={x - NODE_FOCUS_SHADOW_PAD}
                    y={y - NODE_FOCUS_SHADOW_PAD + 1}
                    width={n.w + NODE_FOCUS_SHADOW_PAD * 2}
                    height={n.h + NODE_FOCUS_SHADOW_PAD * 2}
                    rx={NODE_CORNER_RX + 2}
                    fill="#000000"
                    opacity={0.55}
                    filter="url(#graph-node-focus-shadow)"
                    className="pointer-events-none"
                  />
                ) : null}
                <rect
                  x={x}
                  y={y}
                  width={n.w}
                  height={n.h}
                  rx={NODE_CORNER_RX}
                  fill="hsl(var(--card))"
                  className={cn(
                    'stroke-border',
                    isStaged && 'stroke-amber-500/80',
                    pathHighlight && onPathNode && 'stroke-primary shadow-sm',
                    isDropTarget && 'stroke-primary ring-2 ring-primary/40',
                    (isNeighbor || isHover) &&
                      !isFocus &&
                      !isDropTarget &&
                      'stroke-primary/70',
                    isHover && !isDropTarget && 'stroke-primary/80'
                  )}
                  strokeWidth={isDropTarget ? 2 : isStaged ? 1.5 : isNeighbor || isHover ? 1.5 : 1}
                  strokeDasharray={isStaged ? '6 4' : undefined}
                />
                <circle cx={x + 10} cy={y + 14} r={3} fill={dot} />
                {(() => {
                  const hint = suggestionHints?.get(n.key)
                  if (!hint || hint.count <= 0) return null
                  const label = hint.count > 9 ? '9+' : String(hint.count)
                  const titleKey =
                    hint.source === 'ai_scan'
                      ? 'connections.hints.badgeAiScan'
                      : hint.source === 'ai_panel'
                        ? 'connections.hints.badgeAiPanel'
                        : 'connections.graph.suggestionBadge'
                  return (
                    <g className="pointer-events-none">
                      <circle
                        cx={x + n.w - 6}
                        cy={y + 6}
                        r={8}
                        className="fill-primary stroke-card"
                        strokeWidth={1}
                      />
                      <text
                        x={x + n.w - 6}
                        y={y + 9}
                        textAnchor="middle"
                        className="fill-primary-foreground text-[8px] font-semibold"
                      >
                        {label}
                      </text>
                      <title>{t(titleKey, { count: hint.count })}</title>
                    </g>
                  )
                })()}
                <foreignObject
                  x={x + 18}
                  y={y + 6}
                  width={Math.max(40, n.w - 24)}
                  height={n.h - 10}
                >
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    className="overflow-hidden text-[10px] leading-tight text-foreground"
                    style={{ width: n.w - 24, maxWidth: n.w - 24, height: n.h - 12 }}
                  >
                    <div className="flex items-start gap-1 font-medium">
                      <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        {n.titleLines.map((line, i) => (
                          <div key={i} className="break-words leading-[12px]">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                    {n.subtitleLine ? (
                      <div className="mt-0.5 truncate pl-4 text-[9px] text-muted-foreground">
                        {n.subtitleLine}
                      </div>
                    ) : null}
                  </div>
                </foreignObject>
                {showHandle ? (
                  <g
                    data-link-handle
                    className="cursor-crosshair"
                    onPointerDown={(ev): void => {
                      ev.stopPropagation()
                      ev.preventDefault()
                      startLinkDrag(n, ev.clientX, ev.clientY)
                    }}
                  >
                    <circle
                      cx={handleX}
                      cy={handleY}
                      r={9}
                      className="fill-card stroke-primary/80 hover:fill-primary/15"
                      strokeWidth={1.5}
                    />
                    <foreignObject
                      x={handleX - 6}
                      y={handleY - 6}
                      width={12}
                      height={12}
                      className="pointer-events-none"
                    >
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        className="flex h-3 w-3 items-center justify-center text-primary"
                      >
                        <Link2 className="h-2.5 w-2.5" />
                      </div>
                    </foreignObject>
                    <title>{t('connections.graph.linkHandle')}</title>
                  </g>
                ) : null}
              </g>
            )
          })}

        </g>
      </svg>

      {!compact && clusterMode !== 'none' && hulls.length > 0 ? (
        <ClusterIslandHullLabelOverlay
          hulls={hulls}
          viewport={viewport}
          showOverlayLabels={clusterMode === 'component'}
          canRename={Boolean(onRenameComponentIsland && onResetComponentIsland)}
          canDrag={Boolean(onPersistGraphLayout)}
          islandStyles={islandStyles}
          onRename={(key, name): void => onRenameComponentIsland?.(key, name)}
          onResetName={(key): void => onResetComponentIsland?.(key)}
          onSetIslandStyle={onSetIslandStyle}
          onResetIslandStyle={onResetIslandStyle}
          onIslandDragStart={onIslandDragStart}
          clusterNodeCounts={clusterNodeCounts}
          onRelayoutIslandCluster={
            onPersistGraphLayout ? relayoutIslandCluster : undefined
          }
          onScanIsland={onScanIsland}
        />
      ) : null}
    </div>
  )
}

function mergePathIntoGraph(
  base: { nodes: EntityGraphNode[]; edges: EntityGraphEdge[] },
  overlay: { nodes: EntityGraphNode[]; edges: EntityGraphEdge[] } | null | undefined
): { nodes: EntityGraphNode[]; edges: EntityGraphEdge[] } {
  if (!overlay?.nodes.length) return base
  const nodeKeys = new Set(base.nodes.map((n) => n.key))
  const nodes = [...base.nodes]
  for (const n of overlay.nodes) {
    if (!nodeKeys.has(n.key)) {
      nodes.push(n)
      nodeKeys.add(n.key)
    }
  }
  const edgeIds = new Set(base.edges.map((e) => e.linkId))
  const edges = [...base.edges]
  for (const e of overlay.edges) {
    if (!edgeIds.has(e.linkId)) {
      edges.push(e)
      edgeIds.add(e.linkId)
    }
  }
  return { nodes, edges }
}

function useCalendarSubtitleLocale(): { timeZone: string; localeCode: 'de' | 'en' } {
  const calendarTimeZoneConfig = useAccountsStore((s) => s.config?.calendarTimeZone)
  const { i18n } = useTranslation()
  const timeZone = useMemo(
    () => resolveRendererCalendarTimeZone(calendarTimeZoneConfig),
    [calendarTimeZoneConfig]
  )
  const localeCode = i18n.language.startsWith('de') ? 'de' : 'en'
  return { timeZone, localeCode }
}

export function ConnectionsGraphWithFilter(props: {
  allNodes: EntityGraphNode[]
  allEdges: EntityGraphEdge[]
  query: string
  selectedKey: string | null
  clusterMode: EntityGraphClusterMode
  viewSettings?: ConnectionsGraphViewSettings
  pathHighlight?: GraphPathHighlight | null
  pathOverlay?: { nodes: EntityGraphNode[]; edges: EntityGraphEdge[] } | null
  compact?: boolean
  stagedNodes?: EntityGraphNode[]
  fixedPositions?: Map<string, { x: number; y: number }>
  enablePaletteDrop?: boolean
  onPaletteLink?: (dragged: ChronellEntityRef, target: EntityGraphNode) => void | Promise<void>
  onPalettePlace?: (
    payload: import('@/app/connections/graph-entity-drag').GraphEntityDragPayload,
    x: number,
    y: number
  ) => void | Promise<void>
  onRenameComponentIsland?: (clusterKey: string, name: string) => void
  onResetComponentIsland?: (clusterKey: string) => void
  onSetIslandStyle?: (
    clusterKey: string,
    style: import('@/app/connections/cluster-island-style').ClusterIslandStyle
  ) => void
  onResetIslandStyle?: (clusterKey: string) => void
  layoutEpoch?: number
  saveLayoutRequest?: number
  onPersistGraphLayout?: (
    structureKey: string,
    nodePositions: Record<string, { x: number; y: number }>,
    options?: { replace?: boolean }
  ) => void
  onCanvasContextMenu?: (anchor: ConnectionsCanvasCreateAnchor) => void
  onNodeContextMenu?: (
    node: EntityGraphNode,
    anchor: { x: number; y: number }
  ) => void
  onSelectNode: (node: EntityGraphNode | null) => void
  multiSelectedKeys?: ReadonlySet<string>
  onToggleMultiSelect?: (key: string) => void
  onMarqueeComplete?: (nodeKeys: string[]) => void
  onScanIsland?: (clusterKey: string) => void
  suggestionHints?: ReadonlyMap<string, EntityLinkSuggestionCountEntry>
  linkQualityByLinkId?: ReadonlyMap<number, EntityLinkQuality>
}): JSX.Element {
  const { timeZone, localeCode } = useCalendarSubtitleLocale()
  const filtered = useMemo(() => {
    const base = filterGraphByQuery(props.allNodes, props.allEdges, props.query)
    const merged = mergePathIntoGraph(base, props.pathOverlay)
    const keys = new Set(merged.nodes.map((n) => n.key))
    const extra = (props.stagedNodes ?? []).filter((n) => !keys.has(n.key))
    const withStaged = {
      nodes: withFormattedGraphSubtitles(
        [...merged.nodes, ...extra],
        timeZone,
        localeCode
      ),
      edges: merged.edges
    }
    if (!props.viewSettings) return withStaged
    const stagedKeys = new Set((props.stagedNodes ?? []).map((n) => n.key))
    return applyConnectionsGraphFilters(
      withStaged.nodes,
      withStaged.edges,
      props.viewSettings,
      null,
      stagedKeys
    )
  }, [
    props.allNodes,
    props.allEdges,
    props.query,
    props.pathOverlay,
    props.stagedNodes,
    props.viewSettings,
    timeZone,
    localeCode
  ])

  return (
    <ConnectionsGraph
      nodes={filtered.nodes}
      edges={filtered.edges}
      allEdges={props.allEdges}
      selectedKey={props.selectedKey}
      clusterMode={props.clusterMode}
      viewSettings={props.viewSettings}
      pathHighlight={props.pathHighlight}
      compact={props.compact}
      fixedPositions={props.fixedPositions}
      stagedKeys={
        props.stagedNodes?.length
          ? new Set(props.stagedNodes.map((n) => n.key))
          : undefined
      }
      enablePaletteDrop={props.enablePaletteDrop}
      onPaletteLink={props.onPaletteLink}
      onPalettePlace={props.onPalettePlace}
      onRenameComponentIsland={props.onRenameComponentIsland}
      onResetComponentIsland={props.onResetComponentIsland}
      onSetIslandStyle={props.onSetIslandStyle}
      onResetIslandStyle={props.onResetIslandStyle}
      layoutEpoch={props.layoutEpoch}
      saveLayoutRequest={props.saveLayoutRequest}
      onPersistGraphLayout={props.onPersistGraphLayout}
      onCanvasContextMenu={props.onCanvasContextMenu}
      onNodeContextMenu={props.onNodeContextMenu}
      onSelectNode={props.onSelectNode}
      multiSelectedKeys={props.multiSelectedKeys}
      onToggleMultiSelect={props.onToggleMultiSelect}
      onMarqueeComplete={props.onMarqueeComplete}
      onScanIsland={props.onScanIsland}
      suggestionHints={props.suggestionHints}
      linkQualityByLinkId={props.linkQualityByLinkId}
    />
  )
}
