import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Palette, RefreshCw, Sparkles } from 'lucide-react'
import { ClusterIslandColorSubmenu } from '@/app/connections/ClusterIslandColorSubmenu'
import type { ClusterIslandStyle } from '@/app/connections/cluster-island-style'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import type { ClusterHull } from '@/app/connections/connections-graph-layout'
import type { GraphViewport } from '@/app/connections/use-graph-viewport'
import { cn } from '@/lib/utils'

const BLUR_GUARD_MS = 280

function hullLabelBox(
  viewport: GraphViewport,
  hull: ClusterHull
): { left: number; top: number; width: number; height: number } {
  return {
    left: viewport.x + (hull.x + 6) * viewport.scale,
    top: viewport.y + (hull.y + 1) * viewport.scale,
    width: Math.max(100, Math.min(hull.w - 12, 220) * viewport.scale),
    height: Math.max(20, 22 * viewport.scale)
  }
}

function hullRelayoutButtonBox(
  viewport: GraphViewport,
  hull: ClusterHull
): { left: number; top: number; width: number; height: number } {
  const size = Math.max(18, Math.min(24, 20 * viewport.scale))
  return {
    left: viewport.x + (hull.x + hull.w) * viewport.scale - size - 6,
    top: viewport.y + hull.y * viewport.scale + 4,
    width: size,
    height: size
  }
}

/** Hintergrund-Hulls (unter den Knoten, nur SVG). */
export function ClusterIslandHullBackground({
  hulls,
  hullOpacity,
  clusterFill,
  clusterStroke,
  hullStrokeClass,
  showLabels = true
}: {
  hulls: ClusterHull[]
  hullOpacity: (hull: ClusterHull) => number
  clusterFill: (clusterKey: string) => string
  /** Explizite Randfarbe (z. B. Kontenfarbe bei Gruppierung nach Konto). */
  clusterStroke?: (clusterKey: string) => string | undefined
  hullStrokeClass?: (hull: ClusterHull) => string
  /** Bei Verbindungs-Inseln zeigt das HTML-Overlay die Titel. */
  showLabels?: boolean
}): JSX.Element | null {
  if (hulls.length === 0) return null
  return (
    <>
      {hulls.map((hull) => {
        const strokeColor = clusterStroke?.(hull.key)
        return (
        <g key={hull.key} opacity={hullOpacity(hull)} className="pointer-events-none">
          <rect
            x={hull.x}
            y={hull.y}
            width={hull.w}
            height={hull.h}
            rx={14}
            fill={clusterFill(hull.key)}
            stroke={strokeColor ?? 'currentColor'}
            className={cn(!strokeColor && 'text-border/80', hullStrokeClass?.(hull))}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          {showLabels ? (
            <text
              x={hull.x + 10}
              y={hull.y + 14}
              className="fill-muted-foreground text-[9px] font-medium pointer-events-none select-none"
            >
              {hull.label}
            </text>
          ) : null}
        </g>
        )
      })}
    </>
  )
}

/** HTML-Overlay für Insel-Titel (Klick, Kontextmenü, Umbenennen). */
export function ClusterIslandHullLabelOverlay({
  hulls,
  viewport,
  canRename,
  canDrag = true,
  showOverlayLabels = true,
  islandStyles = {},
  onRename,
  onResetName,
  onSetIslandStyle,
  onResetIslandStyle,
  onIslandDragStart,
  clusterNodeCounts,
  onRelayoutIslandCluster,
  onScanIsland
}: {
  hulls: ClusterHull[]
  viewport: GraphViewport
  canRename: boolean
  canDrag?: boolean
  /** Bei Zeit-/Konto-Gruppierung liegen die Titel im SVG-Hintergrund; Overlay nur für Buttons/Menü. */
  showOverlayLabels?: boolean
  islandStyles?: Readonly<Record<string, ClusterIslandStyle>>
  onRename: (clusterKey: string, name: string) => void
  onResetName: (clusterKey: string) => void
  onSetIslandStyle?: (clusterKey: string, style: ClusterIslandStyle) => void
  onResetIslandStyle?: (clusterKey: string) => void
  onIslandDragStart?: (clusterKey: string, clientX: number, clientY: number) => void
  clusterNodeCounts?: Readonly<Record<string, number>>
  onRelayoutIslandCluster?: (clusterKey: string) => void
  onScanIsland?: (clusterKey: string) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const [menu, setMenu] = useState<{ x: number; y: number; hull: ClusterHull } | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const blurGuardUntilRef = useRef(0)

  const startEdit = useCallback(
    (hull: ClusterHull): void => {
      if (!canRename || !hull.key.startsWith('comp:')) return
      setMenu(null)
      blurGuardUntilRef.current = Date.now() + BLUR_GUARD_MS
      setEditingKey(hull.key)
      setDraft(hull.label)
    },
    [canRename]
  )

  const commitEdit = useCallback((): void => {
    if (!editingKey) return
    const trimmed = draft.trim()
    if (trimmed) onRename(editingKey, trimmed)
    setEditingKey(null)
    setDraft('')
  }, [draft, editingKey, onRename])

  const cancelEdit = useCallback((): void => {
    setEditingKey(null)
    setDraft('')
  }, [])

  useEffect(() => {
    if (!editingKey) return
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [editingKey])

  const canStyle = Boolean(onSetIslandStyle && onResetIslandStyle)
  const canRelayoutInner = Boolean(onRelayoutIslandCluster)

  const menuItems: ContextMenuItem[] = useMemo(() => {
    if (!menu) return []
    const hull = menu.hull
    const renameable = canRename && hull.key.startsWith('comp:')
    const items: ContextMenuItem[] = []
    if (renameable) {
      items.push({
        id: 'rename',
        label: t('connections.graph.islandRename'),
        onSelect: (): void => startEdit(hull)
      })
    }
    if (canRelayoutInner && (clusterNodeCounts?.[hull.key] ?? 0) >= 2) {
      items.push({
        id: 'relayout-inner',
        label: t('connections.graph.islandRelayoutInner'),
        icon: RefreshCw,
        onSelect: (): void => {
          onRelayoutIslandCluster?.(hull.key)
          setMenu(null)
        }
      })
    }
    if (onScanIsland && (clusterNodeCounts?.[hull.key] ?? 0) > 0) {
      items.push({
        id: 'scan-island',
        label: t('connections.graph.islandScanAi'),
        icon: Sparkles,
        onSelect: (): void => {
          onScanIsland(hull.key)
          setMenu(null)
        }
      })
    }
    if (canStyle) {
      items.push({
        id: 'color',
        label: t('connections.graph.islandColor'),
        icon: Palette,
        submenuContent: (
          <ClusterIslandColorSubmenu
            style={islandStyles[hull.key] ?? null}
            onChange={(style): void => onSetIslandStyle?.(hull.key, style)}
            onReset={(): void => {
              onResetIslandStyle?.(hull.key)
              setMenu(null)
            }}
          />
        )
      })
    }
    if (renameable) {
      items.push({
        id: 'reset',
        label: t('connections.graph.islandResetName'),
        onSelect: (): void => {
          onResetName(hull.key)
          setMenu(null)
        }
      })
    }
    if (canStyle && islandStyles[hull.key]) {
      items.push({
        id: 'reset-color',
        label: t('connections.graph.islandResetColor'),
        onSelect: (): void => {
          onResetIslandStyle?.(hull.key)
          setMenu(null)
        }
      })
    }
    return items
  }, [
    menu,
    canRename,
    canStyle,
    islandStyles,
    onSetIslandStyle,
    onResetIslandStyle,
    onResetName,
    onRelayoutIslandCluster,
    clusterNodeCounts,
    canRelayoutInner,
    startEdit,
    t
  ])

  if (hulls.length === 0) return null

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[5]">
        {hulls.map((hull) => {
          const renameable = canRename && hull.key.startsWith('comp:')
          const hasContextMenu = renameable || canStyle || canRelayoutInner
          const nodeCount = clusterNodeCounts?.[hull.key] ?? 0
          const showRelayoutBtn = canRelayoutInner && nodeCount >= 2
          const box = hullLabelBox(viewport, hull)
          const relayoutBox = hullRelayoutButtonBox(viewport, hull)
          const isEditing = editingKey === hull.key
          const showLabelButton = showOverlayLabels

          if (!showLabelButton && !showRelayoutBtn) return null

          if (isEditing) {
            return (
              <input
                key={`edit-${hull.key}`}
                ref={inputRef}
                type="text"
                value={draft}
                style={{
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height
                }}
                className="pointer-events-auto absolute rounded border border-primary bg-card px-1.5 text-[11px] text-foreground shadow-md outline-none ring-1 ring-primary/30"
                onChange={(e): void => setDraft(e.target.value)}
                onBlur={(): void => {
                  if (Date.now() < blurGuardUntilRef.current) return
                  commitEdit()
                }}
                onKeyDown={(e): void => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitEdit()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelEdit()
                  }
                }}
                onPointerDown={(e): void => e.stopPropagation()}
                onClick={(e): void => e.stopPropagation()}
                aria-label={t('connections.graph.islandRename')}
              />
            )
          }

          return (
            <div key={`island-chrome-${hull.key}`}>
              {showRelayoutBtn ? (
                <button
                  type="button"
                  data-island-relayout=""
                  title={t('connections.graph.islandRelayoutInnerTitle')}
                  style={{
                    left: relayoutBox.left,
                    top: relayoutBox.top,
                    width: relayoutBox.width,
                    height: relayoutBox.height
                  }}
                  className="pointer-events-auto absolute flex items-center justify-center rounded-md border border-border/80 bg-card/90 text-muted-foreground shadow-sm hover:bg-card hover:text-foreground"
                  onClick={(e): void => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRelayoutIslandCluster?.(hull.key)
                  }}
                  onPointerDown={(e): void => e.stopPropagation()}
                >
                  <RefreshCw className="h-3 w-3 shrink-0" aria-hidden />
                </button>
              ) : null}
              {showLabelButton ? (
              <button
                type="button"
                data-island-label=""
                title={
                  canDrag
                    ? `${hull.label} — ${t('connections.graph.islandDrag')}`
                    : hull.label
                }
                style={{
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height
                }}
                className={cn(
                  'pointer-events-auto absolute truncate rounded px-1 text-left text-[10px] font-medium text-muted-foreground hover:bg-card/80 hover:text-foreground',
                  canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-text'
                )}
                onDoubleClick={(e): void => {
                  if (!renameable) return
                  e.preventDefault()
                  e.stopPropagation()
                  startEdit(hull)
                }}
                onContextMenu={(e): void => {
                  if (!hasContextMenu) return
                  e.preventDefault()
                  e.stopPropagation()
                  setMenu({ x: e.clientX, y: e.clientY, hull })
                }}
                onPointerDown={(e): void => {
                  e.stopPropagation()
                  if (canDrag && e.button === 0) {
                    onIslandDragStart?.(hull.key, e.clientX, e.clientY)
                  }
                }}
                onClick={(e): void => e.stopPropagation()}
              >
                {hull.label}
              </button>
              ) : null}
            </div>
          )
        })}
      </div>
      {menu && menuItems.length > 0 ? (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={(): void => setMenu(null)} />
      ) : null}
    </>
  )
}
