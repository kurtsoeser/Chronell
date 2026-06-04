import { normalizeZoneRoot, type LayoutZoneNode } from '@/app/layout-studio/layout-zone-model'
import {
  CUSTOM_VIEW_DEFAULT_ICON_ID,
  normalizeCustomViewIconId
} from '@/lib/custom-view-tab-icon'

export const CUSTOM_VIEWS_STORAGE_KEY = 'mailclient.customViews.v1'
export const CUSTOM_VIEWS_TOPBAR_ORDER_KEY = 'mailclient.customViews.topbarOrder.v1'
export const ACTIVE_CUSTOM_VIEW_ID_KEY = 'mailclient.activeCustomViewId.v1'

export type CustomViewDefinition = {
  id: string
  name: string
  /** Tab-Symbol aus dem Termin-Icon-Katalog (Lucide). */
  iconId?: string
  zoneRoot: LayoutZoneNode
  createdAt: number
}

function newViewId(): string {
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeView(raw: unknown): CustomViewDefinition | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newViewId()
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Ansicht'
  const iconId = normalizeCustomViewIconId(o.iconId)
  const createdAt = Number(o.createdAt)
  const zoneRoot = normalizeZoneRoot(o.zoneRoot)
  const view: CustomViewDefinition = {
    id,
    name,
    zoneRoot,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now()
  }
  view.iconId = iconId ?? CUSTOM_VIEW_DEFAULT_ICON_ID
  return view
}

function viewsForPersistence(views: readonly CustomViewDefinition[]): CustomViewDefinition[] {
  return views.map((v) => ({
    id: v.id,
    name: v.name,
    zoneRoot: v.zoneRoot,
    createdAt: v.createdAt,
    iconId: normalizeCustomViewIconId(v.iconId) ?? CUSTOM_VIEW_DEFAULT_ICON_ID
  }))
}

export function customViewIconIdOrDefault(iconId: string | undefined): string {
  return iconId ?? CUSTOM_VIEW_DEFAULT_ICON_ID
}

export function readCustomViews(): CustomViewDefinition[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_VIEWS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeView)
      .filter((v): v is CustomViewDefinition => v != null)
  } catch {
    return []
  }
}

export function writeCustomViews(views: CustomViewDefinition[]): void {
  try {
    window.localStorage.setItem(
      CUSTOM_VIEWS_STORAGE_KEY,
      JSON.stringify(viewsForPersistence(views))
    )
  } catch {
    // ignore
  }
}

export function readCustomViewTopbarOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_VIEWS_TOPBAR_ORDER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)
  } catch {
    return []
  }
}

export function writeCustomViewTopbarOrder(ids: string[]): void {
  try {
    window.localStorage.setItem(CUSTOM_VIEWS_TOPBAR_ORDER_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

export function readActiveCustomViewId(): string | null {
  try {
    const v = window.localStorage.getItem(ACTIVE_CUSTOM_VIEW_ID_KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function writeActiveCustomViewId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_CUSTOM_VIEW_ID_KEY, id)
    else window.localStorage.removeItem(ACTIVE_CUSTOM_VIEW_ID_KEY)
  } catch {
    // ignore
  }
}

export function createCustomViewId(): string {
  return newViewId()
}

export function reconcileCustomViewTopbarOrder(
  views: readonly CustomViewDefinition[],
  order: readonly string[]
): string[] {
  const ids = new Set(views.map((v) => v.id))
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of order) {
    if (!ids.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const v of views) {
    if (!seen.has(v.id)) out.push(v.id)
  }
  return out
}
