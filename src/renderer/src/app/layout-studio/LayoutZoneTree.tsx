import { useMemo, useRef, useState } from 'react'
import { Columns2, GripVertical, LayoutPanelLeft, Rows2, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { HorizontalSplitter, VerticalSplitter } from '@/components/ResizableSplitter'
import { moduleColumnHeaderUppercaseLabelClass } from '@/components/ModuleColumnHeader'
import { cn } from '@/lib/utils'
import { LayoutStudioPanel } from '@/app/layout-studio/LayoutStudioPanel'
import { walkZoneLeaves, type LayoutZoneNode } from '@/app/layout-studio/layout-zone-model'
import { LayoutStudioPanelSelect } from '@/app/layout-studio/LayoutStudioPanelSelect'
import {
  LAYOUT_ZONE_LEAF_DND_MIME,
  hasLayoutZoneLeafDrag,
  readLayoutZoneLeafDragId
} from '@/app/layout-studio/layout-zone-dnd'
import { layoutStudioPanelTitleKey } from '@/app/layout-studio/layout-studio-panel-ids'
import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-storage'

export type LayoutZonePopoutConfig = {
  viewId: string
  isPopped: (leafId: string) => boolean
  onPopOut: (leafId: string, panel: LayoutStudioPanelId) => void
  onDockIn: (leafId: string) => void
}

export function LayoutZoneTree({
  root,
  editMode,
  selectedLeafId,
  zonePopout,
  onSelectLeaf,
  onSetPanel,
  onSwapPanels,
  onSplitLeaf,
  onRemoveLeaf,
  onAdjustRatio
}: {
  root: LayoutZoneNode
  editMode: boolean
  selectedLeafId: string | null
  zonePopout?: LayoutZonePopoutConfig
  onSelectLeaf: (leafId: string) => void
  onSetPanel: (leafId: string, panel: LayoutStudioPanelId) => void
  onSwapPanels: (leafIdA: string, leafIdB: string) => void
  onSplitLeaf: (leafId: string, direction: 'vertical' | 'horizontal') => void
  onRemoveLeaf: (leafId: string) => void
  onAdjustRatio: (splitId: string, deltaPx: number, containerSizePx: number) => void
}): JSX.Element {
  const [draggingLeafId, setDraggingLeafId] = useState<string | null>(null)

  const zoneLabelsMap = useMemo(() => {
    const labels: Record<string, number> = {}
    let i = 1
    walkZoneLeaves(root, (leaf) => {
      labels[leaf.id] = i
      i += 1
    })
    return labels
  }, [root])

  const leafCount = Object.keys(zoneLabelsMap).length

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <ZoneNodeView
        node={root}
        editMode={editMode}
        selectedLeafId={selectedLeafId}
        zonePopout={zonePopout}
        zoneLabels={zoneLabelsMap}
        leafCount={leafCount}
        onSelectLeaf={onSelectLeaf}
        onSetPanel={onSetPanel}
        onSwapPanels={onSwapPanels}
        draggingLeafId={draggingLeafId}
        onDragLeafStart={setDraggingLeafId}
        onDragLeafEnd={(): void => setDraggingLeafId(null)}
        onSplitLeaf={onSplitLeaf}
        onRemoveLeaf={onRemoveLeaf}
        onAdjustRatio={onAdjustRatio}
      />
    </div>
  )
}

function ZoneNodeView({
  node,
  editMode,
  selectedLeafId,
  zonePopout,
  zoneLabels,
  leafCount,
  draggingLeafId,
  onSelectLeaf,
  onSetPanel,
  onSwapPanels,
  onDragLeafStart,
  onDragLeafEnd,
  onSplitLeaf,
  onRemoveLeaf,
  onAdjustRatio
}: {
  node: LayoutZoneNode
  editMode: boolean
  selectedLeafId: string | null
  zonePopout?: LayoutZonePopoutConfig
  zoneLabels: Record<string, number>
  leafCount: number
  draggingLeafId: string | null
  onSelectLeaf: (leafId: string) => void
  onSetPanel: (leafId: string, panel: LayoutStudioPanelId) => void
  onSwapPanels: (leafIdA: string, leafIdB: string) => void
  onDragLeafStart: (leafId: string) => void
  onDragLeafEnd: () => void
  onSplitLeaf: (leafId: string, direction: 'vertical' | 'horizontal') => void
  onRemoveLeaf: (leafId: string) => void
  onAdjustRatio: (splitId: string, deltaPx: number, containerSizePx: number) => void
}): JSX.Element {
  if (node.type === 'leaf') {
    return (
      <ZoneLeafView
        leaf={node}
        editMode={editMode}
        selected={selectedLeafId === node.id}
        zonePopout={zonePopout}
        zoneNumber={zoneLabels[node.id] ?? 0}
        canRemove={leafCount > 1}
        onSelect={(): void => onSelectLeaf(node.id)}
        onSetPanel={(panel): void => onSetPanel(node.id, panel)}
        onSwapPanels={onSwapPanels}
        isDragging={draggingLeafId === node.id}
        onDragStart={(): void => onDragLeafStart(node.id)}
        onDragEnd={onDragLeafEnd}
        onSplitVertical={(): void => onSplitLeaf(node.id, 'vertical')}
        onSplitHorizontal={(): void => onSplitLeaf(node.id, 'horizontal')}
        onRemove={(): void => onRemoveLeaf(node.id)}
      />
    )
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const row = node.direction === 'vertical'

  return (
    <div
      ref={containerRef}
      className={cn('flex min-h-0 min-w-0 flex-1', row ? 'flex-row' : 'flex-col')}
    >
      <div className="flex min-h-0 min-w-0 flex-col" style={{ flex: node.ratio }}>
        <ZoneNodeView
          node={node.first}
          editMode={editMode}
          selectedLeafId={selectedLeafId}
          zonePopout={zonePopout}
          zoneLabels={zoneLabels}
          leafCount={leafCount}
          onSelectLeaf={onSelectLeaf}
          onSetPanel={onSetPanel}
          onSwapPanels={onSwapPanels}
          draggingLeafId={draggingLeafId}
          onDragLeafStart={onDragLeafStart}
          onDragLeafEnd={onDragLeafEnd}
          onSplitLeaf={onSplitLeaf}
          onRemoveLeaf={onRemoveLeaf}
          onAdjustRatio={onAdjustRatio}
        />
      </div>
      {row ? (
        <VerticalSplitter
          ariaLabel="Zonenbreite"
          onDrag={(delta): void => {
            const w = containerRef.current?.clientWidth ?? 0
            onAdjustRatio(node.id, delta, w)
          }}
        />
      ) : (
        <HorizontalSplitter
          ariaLabel="Zonenhöhe"
          onDrag={(delta): void => {
            const h = containerRef.current?.clientHeight ?? 0
            onAdjustRatio(node.id, delta, h)
          }}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-col" style={{ flex: 1 - node.ratio }}>
        <ZoneNodeView
          node={node.second}
          editMode={editMode}
          selectedLeafId={selectedLeafId}
          zonePopout={zonePopout}
          zoneLabels={zoneLabels}
          leafCount={leafCount}
          onSelectLeaf={onSelectLeaf}
          onSetPanel={onSetPanel}
          onSwapPanels={onSwapPanels}
          draggingLeafId={draggingLeafId}
          onDragLeafStart={onDragLeafStart}
          onDragLeafEnd={onDragLeafEnd}
          onSplitLeaf={onSplitLeaf}
          onRemoveLeaf={onRemoveLeaf}
          onAdjustRatio={onAdjustRatio}
        />
      </div>
    </div>
  )
}

function ZoneLeafView({
  leaf,
  editMode,
  selected,
  zonePopout,
  zoneNumber,
  canRemove,
  isDragging,
  onSelect,
  onSetPanel,
  onSwapPanels,
  onDragStart,
  onDragEnd,
  onSplitVertical,
  onSplitHorizontal,
  onRemove
}: {
  leaf: { id: string; panel: LayoutStudioPanelId }
  editMode: boolean
  selected: boolean
  zonePopout?: LayoutZonePopoutConfig
  zoneNumber: number
  canRemove: boolean
  isDragging: boolean
  onSelect: () => void
  onSetPanel: (panel: LayoutStudioPanelId) => void
  onSwapPanels: (leafIdA: string, leafIdB: string) => void
  onDragStart: () => void
  onDragEnd: () => void
  onSplitVertical: () => void
  onSplitHorizontal: () => void
  onRemove: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const [dropOver, setDropOver] = useState(false)
  const zoneRef = useRef<HTMLDivElement>(null)
  const isPopped = zonePopout?.isPopped(leaf.id) ?? false
  const canPopOut = zonePopout != null && leaf.panel !== 'none' && !isPopped
  const panelLabel = t(layoutStudioPanelTitleKey(leaf.panel))

  return (
    <div
      ref={zoneRef}
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        editMode && 'ring-inset',
        editMode && selected && 'ring-2 ring-primary/70',
        editMode && !selected && !dropOver && 'ring-1 ring-border/60',
        editMode && dropOver && 'ring-2 ring-dashed ring-primary',
        editMode && isDragging && 'opacity-55'
      )}
      onClick={editMode ? onSelect : undefined}
      onKeyDown={undefined}
      role={editMode ? 'button' : undefined}
      tabIndex={editMode ? 0 : undefined}
      onDragOver={
        editMode
          ? (e): void => {
              if (!hasLayoutZoneLeafDrag(e.dataTransfer)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDropOver(true)
            }
          : undefined
      }
      onDragLeave={
        editMode
          ? (e): void => {
              const next = e.relatedTarget as Node | null
              if (next && zoneRef.current?.contains(next)) return
              setDropOver(false)
            }
          : undefined
      }
      onDrop={
        editMode
          ? (e): void => {
              e.preventDefault()
              setDropOver(false)
              const fromId = readLayoutZoneLeafDragId(e.dataTransfer)
              if (fromId && fromId !== leaf.id) onSwapPanels(fromId, leaf.id)
            }
          : undefined
      }
    >
      {zonePopout && !editMode && !isPopped ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card/60 px-2 py-1">
          <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-muted-foreground">
            {panelLabel}
          </span>
          {canPopOut ? (
            <button
              type="button"
              title={t('customView.popout.popOutTitle')}
              aria-label={t('customView.popout.popOutAria', { module: panelLabel })}
              onClick={(): void => zonePopout.onPopOut(leaf.id, leaf.panel)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      {editMode ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-card/90 px-1.5 py-1">
          <button
            type="button"
            draggable
            title={t('layoutStudio.zoneDragTitle')}
            aria-label={t('layoutStudio.zoneDragAria', { zone: zoneNumber })}
            onClick={(e): void => e.stopPropagation()}
            onDragStart={(e): void => {
              e.dataTransfer.setData(LAYOUT_ZONE_LEAF_DND_MIME, leaf.id)
              e.dataTransfer.effectAllowed = 'move'
              onDragStart()
            }}
            onDragEnd={(): void => {
              onDragEnd()
              setDropOver(false)
            }}
            className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span
            className={cn(
              moduleColumnHeaderUppercaseLabelClass,
              'mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-[10px] text-primary'
            )}
          >
            {zoneNumber}
          </span>
          <div onClick={(e): void => e.stopPropagation()} className="min-w-0 flex-1">
            <LayoutStudioPanelSelect
              value={leaf.panel}
              aria-label={t('layoutStudio.zonePanelAria', { zone: zoneNumber })}
              onChange={onSetPanel}
              className="w-full max-w-[11rem] rounded border border-border bg-background px-1 py-0.5 text-[10px]"
            />
          </div>
          <button
            type="button"
            title={t('layoutStudio.zoneSplitVertical')}
            onClick={(e): void => {
              e.stopPropagation()
              onSplitVertical()
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Columns2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={t('layoutStudio.zoneSplitHorizontal')}
            onClick={(e): void => {
              e.stopPropagation()
              onSplitHorizontal()
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Rows2 className="h-3.5 w-3.5" />
          </button>
          {canPopOut ? (
            <button
              type="button"
              title={t('customView.popout.popOutTitle')}
              aria-label={t('customView.popout.popOutAria', { module: panelLabel })}
              onClick={(e): void => {
                e.stopPropagation()
                zonePopout?.onPopOut(leaf.id, leaf.panel)
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              title={t('layoutStudio.zoneRemove')}
              onClick={(e): void => {
                e.stopPropagation()
                onRemove()
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      {isPopped ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground">{t('customView.popout.placeholder')}</p>
          <button
            type="button"
            onClick={(): void => zonePopout?.onDockIn(leaf.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60"
          >
            <LayoutPanelLeft className="h-3.5 w-3.5" aria-hidden />
            {t('customView.popout.dockIn')}
          </button>
        </div>
      ) : (
        <div className="chronell-module-pane-stack flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <LayoutStudioPanel panel={leaf.panel} />
        </div>
      )}
    </div>
  )
}
