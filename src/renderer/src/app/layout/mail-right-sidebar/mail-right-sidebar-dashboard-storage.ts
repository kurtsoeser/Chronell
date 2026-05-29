import { DASHBOARD_TILE_IDS, type DashboardTileId } from '@/app/home/dashboard-layout'

/** Mail-Terminspalte mit Mini-Monat + Agenda (reicher als die Start-Kachel `calendar`). */
export type MailRightSidebarAgendaTileId = 'mail_inbox_agenda'

export type MailRightSidebarTileId = DashboardTileId | MailRightSidebarAgendaTileId

export const MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID: MailRightSidebarAgendaTileId = 'mail_inbox_agenda'

const K_TILE_ORDER = 'mailclient.mailRightSidebar.dashboardTiles.v1'

const DEFAULT_TILE_ORDER: MailRightSidebarTileId[] = [
  MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID,
  'weather'
]

const ALL_PICKABLE_TILE_IDS: MailRightSidebarTileId[] = [
  MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID,
  ...DASHBOARD_TILE_IDS
]

function isDashboardTileId(v: string): v is DashboardTileId {
  return (DASHBOARD_TILE_IDS as string[]).includes(v)
}

function isMailRightSidebarTileId(v: string): v is MailRightSidebarTileId {
  return v === MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID || isDashboardTileId(v)
}

export function readMailRightSidebarTileOrder(): MailRightSidebarTileId[] {
  try {
    const raw = window.localStorage.getItem(K_TILE_ORDER)
    if (!raw) return [...DEFAULT_TILE_ORDER]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_TILE_ORDER]
    const out: MailRightSidebarTileId[] = []
    const seen = new Set<string>()
    for (const item of parsed) {
      if (typeof item !== 'string' || !isMailRightSidebarTileId(item) || seen.has(item)) continue
      seen.add(item)
      out.push(item)
    }
    return out.length > 0 ? out : [...DEFAULT_TILE_ORDER]
  } catch {
    return [...DEFAULT_TILE_ORDER]
  }
}

export function writeMailRightSidebarTileOrder(order: MailRightSidebarTileId[]): void {
  try {
    window.localStorage.setItem(K_TILE_ORDER, JSON.stringify(order))
  } catch {
    // ignore
  }
}

export function listPickableMailRightSidebarTileIds(): MailRightSidebarTileId[] {
  return [...ALL_PICKABLE_TILE_IDS]
}
