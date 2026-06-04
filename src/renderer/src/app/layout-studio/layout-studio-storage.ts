export type {
  LayoutStudioCorePanelId,
  LayoutStudioPanelId,
  LayoutStudioTilePanelId
} from '@/app/layout-studio/layout-studio-panel-ids'
export {
  isLayoutStudioPanelId,
  LAYOUT_STUDIO_CORE_PANEL_IDS,
  LAYOUT_STUDIO_TILE_PANEL_IDS,
  LAYOUT_STUDIO_TILE_PREFIX,
  layoutStudioPanelTitleKey,
  parseDashboardTileIdFromPanel,
  tilePanelId
} from '@/app/layout-studio/layout-studio-panel-ids'

import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import { isLayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'

export type LayoutStudioColumn = {
  id: string
  panel: LayoutStudioPanelId
  widthPx: number
}

export const LAYOUT_STUDIO_STORAGE_KEY = 'mailclient.layoutStudio.columns.v1'
export const LAYOUT_STUDIO_MAX_COLUMNS = 5
export const LAYOUT_STUDIO_MIN_COLUMNS = 1
export const LAYOUT_STUDIO_COLUMN_MIN_PX = 200
export const LAYOUT_STUDIO_COLUMN_MAX_PX = 1200
export const LAYOUT_STUDIO_COLUMN_DEFAULT_PX = 320

function newColumnId(): string {
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const LAYOUT_STUDIO_DEFAULT_COLUMNS: LayoutStudioColumn[] = [
  { id: 'col-start', panel: 'startDashboard', widthPx: 480 },
  { id: 'col-list', panel: 'mailList', widthPx: 300 },
  { id: 'col-read', panel: 'reading', widthPx: 380 },
  { id: 'col-side', panel: 'contextSidebar', widthPx: 348 }
]

function normalizeColumn(raw: unknown): LayoutStudioColumn | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newColumnId()
  const panelRaw = o.panel
  const panel = isLayoutStudioPanelId(panelRaw) ? panelRaw : 'none'
  const w = Number(o.widthPx)
  const widthPx = Number.isFinite(w)
    ? Math.min(LAYOUT_STUDIO_COLUMN_MAX_PX, Math.max(LAYOUT_STUDIO_COLUMN_MIN_PX, Math.round(w)))
    : LAYOUT_STUDIO_COLUMN_DEFAULT_PX
  return { id, panel, widthPx }
}

export function readLayoutStudioColumns(): LayoutStudioColumn[] {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STUDIO_STORAGE_KEY)
    if (!raw) return [...LAYOUT_STUDIO_DEFAULT_COLUMNS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return [...LAYOUT_STUDIO_DEFAULT_COLUMNS]
    const cols = parsed
      .map(normalizeColumn)
      .filter((c): c is LayoutStudioColumn => c != null)
      .slice(0, LAYOUT_STUDIO_MAX_COLUMNS)
    if (cols.length < LAYOUT_STUDIO_MIN_COLUMNS) return [...LAYOUT_STUDIO_DEFAULT_COLUMNS]
    return cols
  } catch {
    return [...LAYOUT_STUDIO_DEFAULT_COLUMNS]
  }
}

export function writeLayoutStudioColumns(columns: LayoutStudioColumn[]): void {
  const trimmed = columns.slice(0, LAYOUT_STUDIO_MAX_COLUMNS)
  if (trimmed.length < LAYOUT_STUDIO_MIN_COLUMNS) return
  try {
    window.localStorage.setItem(LAYOUT_STUDIO_STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore
  }
}

export function createLayoutStudioColumn(
  panel: LayoutStudioPanelId = 'none',
  widthPx: number = LAYOUT_STUDIO_COLUMN_DEFAULT_PX
): LayoutStudioColumn {
  const w = Number.isFinite(widthPx)
    ? Math.min(LAYOUT_STUDIO_COLUMN_MAX_PX, Math.max(LAYOUT_STUDIO_COLUMN_MIN_PX, Math.round(widthPx)))
    : LAYOUT_STUDIO_COLUMN_DEFAULT_PX
  return {
    id: newColumnId(),
    panel,
    widthPx: w
  }
}
