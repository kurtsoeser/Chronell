import {
  LAYOUT_STUDIO_DEFAULT_COLUMNS,
  readLayoutStudioColumns,
  type LayoutStudioColumn
} from '@/app/layout-studio/layout-studio-storage'
import {
  createZoneLeaf,
  normalizeZoneRoot,
  newZoneId,
  type LayoutZoneNode,
  type LayoutZoneSplit
} from '@/app/layout-studio/layout-zone-model'

export const LAYOUT_ZONE_TREE_STORAGE_KEY = 'mailclient.layoutStudio.zoneTree.v1'
export const LAYOUT_ZONE_LAYOUT_NAME_KEY = 'mailclient.layoutStudio.zoneLayoutName.v1'

export const LAYOUT_ZONE_DEFAULT_NAME = 'Benutzerdefiniert'

function columnsToZoneTree(columns: LayoutStudioColumn[]): LayoutZoneNode {
  if (columns.length === 0) return createZoneLeaf('none')
  if (columns.length === 1) {
    return { type: 'leaf', id: columns[0].id || newZoneId(), panel: columns[0].panel }
  }
  const total = columns.reduce((s, c) => s + Math.max(1, c.widthPx), 0)
  let acc: LayoutZoneNode = {
    type: 'leaf',
    id: columns[columns.length - 1].id || newZoneId(),
    panel: columns[columns.length - 1].panel
  }
  for (let i = columns.length - 2; i >= 0; i -= 1) {
    const col = columns[i]
    const ratio = Math.max(0.15, Math.min(0.85, col.widthPx / total))
    acc = {
      type: 'split',
      id: newZoneId(),
      direction: 'vertical',
      ratio,
      first: { type: 'leaf', id: col.id || newZoneId(), panel: col.panel },
      second: acc
    } satisfies LayoutZoneSplit
  }
  return acc
}

export function readLayoutZoneRoot(): LayoutZoneNode {
  try {
    const raw = window.localStorage.getItem(LAYOUT_ZONE_TREE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      return normalizeZoneRoot(parsed)
    }
  } catch {
    // ignore
  }
  return columnsToZoneTree(readLayoutStudioColumns())
}

export function writeLayoutZoneRoot(root: LayoutZoneNode): void {
  try {
    window.localStorage.setItem(LAYOUT_ZONE_TREE_STORAGE_KEY, JSON.stringify(root))
  } catch {
    // ignore
  }
}

export function readLayoutZoneLayoutName(): string {
  try {
    const v = window.localStorage.getItem(LAYOUT_ZONE_LAYOUT_NAME_KEY)
    if (v && v.trim()) return v.trim()
  } catch {
    // ignore
  }
  return LAYOUT_ZONE_DEFAULT_NAME
}

export function writeLayoutZoneLayoutName(name: string): void {
  try {
    window.localStorage.setItem(LAYOUT_ZONE_LAYOUT_NAME_KEY, name.trim() || LAYOUT_ZONE_DEFAULT_NAME)
  } catch {
    // ignore
  }
}
