import { create } from 'zustand'
import {
  applyLayoutStudioPreset,
  type LayoutStudioPresetId
} from '@/app/layout-studio/layout-studio-presets'
import {
  adjustZoneSplitRatioByDelta,
  removeZoneLeaf,
  setZoneLeafPanel,
  splitZoneLeaf,
  swapZoneLeafPanels
} from '@/app/layout-studio/layout-zone-ops'
import {
  buildZoneTemplate,
  type LayoutZoneTemplateId
} from '@/app/layout-studio/layout-zone-templates'
import type { LayoutZoneNode } from '@/app/layout-studio/layout-zone-model'
import {
  LAYOUT_ZONE_DEFAULT_NAME,
  readLayoutZoneLayoutName,
  readLayoutZoneRoot,
  writeLayoutZoneLayoutName,
  writeLayoutZoneRoot
} from '@/app/layout-studio/layout-zone-storage'
import {
  LAYOUT_STUDIO_DEFAULT_COLUMNS,
  LAYOUT_STUDIO_MAX_COLUMNS,
  createLayoutStudioColumn,
  readLayoutStudioColumns,
  writeLayoutStudioColumns,
  type LayoutStudioColumn,
  type LayoutStudioPanelId
} from '@/app/layout-studio/layout-studio-storage'

interface LayoutStudioState {
  zoneRoot: LayoutZoneNode
  layoutName: string
  editMode: boolean
  selectedLeafId: string | null
  /** Legacy-Spaltenmodus (nur Migration / Kompatibilität). */
  columns: LayoutStudioColumn[]
  setZoneRoot: (root: LayoutZoneNode) => void
  setLayoutName: (name: string) => void
  setEditMode: (edit: boolean) => void
  setSelectedLeafId: (id: string | null) => void
  setZonePanel: (leafId: string, panel: LayoutStudioPanelId) => void
  swapZonePanels: (leafIdA: string, leafIdB: string) => void
  splitZone: (leafId: string, direction: 'vertical' | 'horizontal') => void
  removeZone: (leafId: string) => void
  adjustZoneRatio: (splitId: string, deltaPx: number, containerSizePx: number) => void
  applyZoneTemplate: (id: LayoutZoneTemplateId) => void
  setColumns: (columns: LayoutStudioColumn[]) => void
  setColumnPanel: (id: string, panel: LayoutStudioPanelId) => void
  setColumnWidth: (id: string, widthPx: number) => void
  reorderColumns: (activeId: string, overId: string) => void
  removeColumn: (id: string) => void
  addColumn: () => void
  applyPreset: (preset: LayoutStudioPresetId) => void
  resetLayout: () => void
}

function persistZone(root: LayoutZoneNode): void {
  writeLayoutZoneRoot(root)
}

export const useLayoutStudioStore = create<LayoutStudioState>((set, get) => ({
  zoneRoot: readLayoutZoneRoot(),
  layoutName: readLayoutZoneLayoutName(),
  editMode: false,
  selectedLeafId: null,
  columns: readLayoutStudioColumns(),

  setZoneRoot(root): void {
    persistZone(root)
    set({ zoneRoot: root })
  },

  setLayoutName(name): void {
    const trimmed = name.trim() || LAYOUT_ZONE_DEFAULT_NAME
    writeLayoutZoneLayoutName(trimmed)
    set({ layoutName: trimmed })
  },

  setEditMode(edit): void {
    set({ editMode: edit, selectedLeafId: edit ? get().selectedLeafId : null })
  },

  setSelectedLeafId(id): void {
    set({ selectedLeafId: id })
  },

  setZonePanel(leafId, panel): void {
    const next = setZoneLeafPanel(get().zoneRoot, leafId, panel)
    get().setZoneRoot(next)
  },

  swapZonePanels(leafIdA, leafIdB): void {
    const next = swapZoneLeafPanels(get().zoneRoot, leafIdA, leafIdB)
    get().setZoneRoot(next)
  },

  splitZone(leafId, direction): void {
    const next = splitZoneLeaf(get().zoneRoot, leafId, direction)
    get().setZoneRoot(next)
  },

  removeZone(leafId): void {
    const next = removeZoneLeaf(get().zoneRoot, leafId)
    get().setZoneRoot(next)
    if (get().selectedLeafId === leafId) set({ selectedLeafId: null })
  },

  adjustZoneRatio(splitId, deltaPx, containerSizePx): void {
    const next = adjustZoneSplitRatioByDelta(
      get().zoneRoot,
      splitId,
      deltaPx,
      containerSizePx
    )
    get().setZoneRoot(next)
  },

  applyZoneTemplate(id): void {
    get().setZoneRoot(buildZoneTemplate(id))
    set({ selectedLeafId: null })
  },

  setColumns(columns): void {
    writeLayoutStudioColumns(columns)
    set({ columns })
  },

  setColumnPanel(id, panel): void {
    const next = get().columns.map((c) => (c.id === id ? { ...c, panel } : c))
    get().setColumns(next)
  },

  setColumnWidth(id, widthPx): void {
    const next = get().columns.map((c) =>
      c.id === id ? { ...c, widthPx: Math.round(widthPx) } : c
    )
    get().setColumns(next)
  },

  reorderColumns(activeId, overId): void {
    if (activeId === overId) return
    const prev = get().columns
    const oldIndex = prev.findIndex((c) => c.id === activeId)
    const newIndex = prev.findIndex((c) => c.id === overId)
    if (oldIndex < 0 || newIndex < 0) return
    const next = [...prev]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    get().setColumns(next)
  },

  removeColumn(id): void {
    const prev = get().columns
    if (prev.length <= 1) return
    get().setColumns(prev.filter((c) => c.id !== id))
  },

  addColumn(): void {
    const prev = get().columns
    if (prev.length >= LAYOUT_STUDIO_MAX_COLUMNS) return
    get().setColumns([...prev, createLayoutStudioColumn('none')])
  },

  applyPreset(preset): void {
    get().setColumns(applyLayoutStudioPreset(preset))
  },

  resetLayout(): void {
    get().setZoneRoot(buildZoneTemplate('mailWorkbench'))
    get().setColumns([...LAYOUT_STUDIO_DEFAULT_COLUMNS])
    set({ layoutName: readLayoutZoneLayoutName(), selectedLeafId: null })
  }
}))
