import { DASHBOARD_TILE_IDS, type DashboardTileId } from '@/app/home/dashboard-layout'

export const LAYOUT_STUDIO_TILE_PREFIX = 'tile:' as const

export type LayoutStudioCorePanelId =
  | 'none'
  | 'startDashboard'
  | 'mailList'
  | 'reading'
  | 'contextSidebar'
  | 'dashboardSidebar'
  | 'agenda'
  | 'calendarDay'
  | 'contactSidebar'
  | 'tasksSidebar'
  | 'notesSidebar'
  | 'mailFolders'
  | 'zeitliste'
  | 'eventPreview'
  | 'contextPreview'
  | 'composer'
  | 'calendarWeek'
  | 'calendarMonth'
  | 'calendarWeekFull'
  | 'calendarMonthFull'
  | 'calendarMain'
  | 'calendarToday'

export type LayoutStudioTilePanelId = `tile:${DashboardTileId}`

export type LayoutStudioPanelId = LayoutStudioCorePanelId | LayoutStudioTilePanelId

export const LAYOUT_STUDIO_CORE_PANEL_IDS: LayoutStudioCorePanelId[] = [
  'none',
  'startDashboard',
  'mailList',
  'reading',
  'contextSidebar',
  'dashboardSidebar',
  'agenda',
  'calendarDay',
  'contactSidebar',
  'tasksSidebar',
  'notesSidebar',
  'mailFolders',
  'zeitliste',
  'eventPreview',
  'contextPreview',
  'composer',
  'calendarWeek',
  'calendarMonth',
  'calendarWeekFull',
  'calendarMonthFull',
  'calendarMain',
  'calendarToday'
]

/** Kacheln im Dropdown (Composer hat eigenes Panel). */
export const LAYOUT_STUDIO_TILE_PANEL_IDS: LayoutStudioTilePanelId[] = DASHBOARD_TILE_IDS.filter(
  (id) => id !== 'composer'
).map((id) => `${LAYOUT_STUDIO_TILE_PREFIX}${id}` as LayoutStudioTilePanelId)

export function tilePanelId(tileId: DashboardTileId): LayoutStudioTilePanelId {
  return `${LAYOUT_STUDIO_TILE_PREFIX}${tileId}`
}

export function parseDashboardTileIdFromPanel(
  panel: LayoutStudioPanelId
): DashboardTileId | null {
  if (!panel.startsWith(LAYOUT_STUDIO_TILE_PREFIX)) return null
  const raw = panel.slice(LAYOUT_STUDIO_TILE_PREFIX.length)
  return DASHBOARD_TILE_IDS.includes(raw as DashboardTileId) ? (raw as DashboardTileId) : null
}

export function isLayoutStudioPanelId(v: unknown): v is LayoutStudioPanelId {
  if (typeof v !== 'string') return false
  if ((LAYOUT_STUDIO_CORE_PANEL_IDS as string[]).includes(v)) return true
  return parseDashboardTileIdFromPanel(v as LayoutStudioPanelId) != null
}

/** i18n-Key für Panel-Bezeichnung im Dropdown. */
export function layoutStudioPanelTitleKey(panel: LayoutStudioPanelId): string {
  const tileId = parseDashboardTileIdFromPanel(panel)
  if (tileId) return dashboardTileTitleI18nKey(tileId)
  return `layoutStudio.panels.${panel}`
}

function dashboardTileTitleI18nKey(id: DashboardTileId): string {
  const camel = id.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  return `dashboard.tiles.${camel}Title`
}
