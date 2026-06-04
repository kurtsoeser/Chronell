import { LayoutDashboard, type LucideIcon } from 'lucide-react'
import {
  calendarEventIconIsExplicit,
  isCalendarEventIconId,
  resolveCalendarEventIcon
} from '@/lib/calendar-event-icons'

/** Standard-Tab-Symbol für eigene Ansichten (Lucide-Katalog). */
export const CUSTOM_VIEW_DEFAULT_ICON_ID = 'layout-dashboard'

export function normalizeCustomViewIconId(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const id = raw.trim()
  if (!isCalendarEventIconId(id) || id === 'calendar') return undefined
  return id
}

export function resolveCustomViewTabIcon(iconId: string | undefined): LucideIcon {
  const id = iconId?.trim() ? iconId.trim() : CUSTOM_VIEW_DEFAULT_ICON_ID
  if (calendarEventIconIsExplicit(id)) return resolveCalendarEventIcon(id)
  return LayoutDashboard
}
