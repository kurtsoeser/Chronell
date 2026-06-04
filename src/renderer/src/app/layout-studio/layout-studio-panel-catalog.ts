import {
  AlarmClock,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CircleDashed,
  Clock,
  CloudSun,
  Eye,
  FilePlus,
  FileText,
  Folder,
  Globe,
  Inbox,
  Infinity,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  List,
  ListTodo,
  MapPin,
  Minus,
  Moon,
  PanelRight,
  PenLine,
  PenSquare,
  Reply,
  Search,
  Star,
  StickyNote,
  Sun,
  Sunrise,
  User,
  Video,
  type LucideIcon
} from 'lucide-react'
import type { TFunction } from 'i18next'
import { DASHBOARD_TILE_IDS, type DashboardTileId } from '@/app/home/dashboard-layout'
import {
  LAYOUT_STUDIO_CORE_PANEL_IDS,
  LAYOUT_STUDIO_TILE_PREFIX,
  layoutStudioPanelTitleKey,
  tilePanelId,
  type LayoutStudioCorePanelId,
  type LayoutStudioPanelId
} from '@/app/layout-studio/layout-studio-panel-ids'

export type LayoutStudioPanelCategory =
  | 'general'
  | 'start'
  | 'mail'
  | 'calendar'
  | 'context'
  | 'tasks'
  | 'notes'
  | 'contacts'
  | 'widgets'

export type LayoutStudioPanelCatalogEntry = {
  id: LayoutStudioPanelId
  category: LayoutStudioPanelCategory
  Icon: LucideIcon
}

const CORE_PANEL_META: Record<LayoutStudioCorePanelId, Omit<LayoutStudioPanelCatalogEntry, 'id'>> = {
  none: { category: 'general', Icon: Minus },
  startDashboard: { category: 'start', Icon: LayoutDashboard },
  mailList: { category: 'mail', Icon: Inbox },
  reading: { category: 'mail', Icon: BookOpen },
  contextSidebar: { category: 'context', Icon: PanelRight },
  dashboardSidebar: { category: 'context', Icon: LayoutGrid },
  agenda: { category: 'calendar', Icon: CalendarDays },
  calendarDay: { category: 'calendar', Icon: Calendar },
  contactSidebar: { category: 'contacts', Icon: User },
  tasksSidebar: { category: 'tasks', Icon: ListTodo },
  notesSidebar: { category: 'notes', Icon: StickyNote },
  mailFolders: { category: 'mail', Icon: Folder },
  zeitliste: { category: 'calendar', Icon: List },
  eventPreview: { category: 'context', Icon: CalendarClock },
  contextPreview: { category: 'context', Icon: Eye },
  composer: { category: 'mail', Icon: PenSquare },
  calendarWeek: { category: 'calendar', Icon: CalendarRange },
  calendarMonth: { category: 'calendar', Icon: Calendar },
  calendarWeekFull: { category: 'calendar', Icon: CalendarDays },
  calendarMonthFull: { category: 'calendar', Icon: Calendar },
  calendarMain: { category: 'calendar', Icon: CalendarDays },
  calendarToday: { category: 'calendar', Icon: Clock }
}

const TILE_PANEL_META: Record<DashboardTileId, Omit<LayoutStudioPanelCatalogEntry, 'id'>> = {
  todo_all: { category: 'tasks', Icon: ListTodo },
  todo_overdue: { category: 'tasks', Icon: AlarmClock },
  todo_today: { category: 'tasks', Icon: Sun },
  todo_tomorrow: { category: 'tasks', Icon: Sunrise },
  todo_week: { category: 'tasks', Icon: CalendarRange },
  todo_later: { category: 'tasks', Icon: Infinity },
  inbox: { category: 'mail', Icon: Inbox },
  waiting: { category: 'mail', Icon: Reply },
  snoozed: { category: 'mail', Icon: Moon },
  search: { category: 'mail', Icon: Search },
  calendar: { category: 'calendar', Icon: Calendar },
  week: { category: 'calendar', Icon: CalendarRange },
  month: { category: 'calendar', Icon: Calendar },
  today_timeline: { category: 'calendar', Icon: CalendarClock },
  deadlines: { category: 'calendar', Icon: AlarmClock },
  favorites: { category: 'mail', Icon: Star },
  weather: { category: 'widgets', Icon: CloudSun },
  today_clock: { category: 'widgets', Icon: Clock },
  world_clock: { category: 'widgets', Icon: Globe },
  next_online_meeting: { category: 'calendar', Icon: Video },
  desk_note: { category: 'notes', Icon: StickyNote },
  work_all: { category: 'tasks', Icon: Layers },
  notes_new: { category: 'notes', Icon: FilePlus },
  notes_overview: { category: 'notes', Icon: BookOpen },
  notes_last: { category: 'notes', Icon: FileText },
  composer: { category: 'mail', Icon: PenLine },
  pinned_shortcuts: { category: 'start', Icon: MapPin }
}

export const LAYOUT_STUDIO_PANEL_CATEGORY_ORDER: LayoutStudioPanelCategory[] = [
  'general',
  'start',
  'mail',
  'calendar',
  'context',
  'tasks',
  'notes',
  'contacts',
  'widgets'
]

export function layoutStudioPanelCategoryLabelKey(category: LayoutStudioPanelCategory): string {
  return `layoutStudio.panelCategory.${category}`
}

export function getLayoutStudioPanelCatalogEntry(id: LayoutStudioPanelId): LayoutStudioPanelCatalogEntry {
  if (id.startsWith(LAYOUT_STUDIO_TILE_PREFIX)) {
    const tileId = id.slice(LAYOUT_STUDIO_TILE_PREFIX.length) as DashboardTileId
    const meta = TILE_PANEL_META[tileId]
    if (meta) return { id, ...meta }
    return { id, category: 'start', Icon: LayoutDashboard }
  }
  const core = id as LayoutStudioCorePanelId
  const meta = CORE_PANEL_META[core]
  return { id, ...meta }
}

/** Im Modul-Dropdown nur `contextPreview`; `eventPreview` bleibt für gespeicherte Layouts. */
const HIDDEN_LAYOUT_STUDIO_PICKER_CORE_IDS = new Set<LayoutStudioCorePanelId>([
  'eventPreview',
  /** Duplikat von `calendarDay` (gleiches Stunden-Raster). */
  'calendarMain'
])

/** Start-Kacheln, die als eigenes Kern-Panel existieren — nicht doppelt im Picker. */
const HIDDEN_LAYOUT_STUDIO_PICKER_TILE_IDS = new Set<DashboardTileId>([
  'week',
  'month',
  'today_timeline'
])

/** Reihenfolge in der Kategorie „Kalender“ (Tag → Woche → Monat → Listen). */
const CALENDAR_PANEL_PICKER_ORDER: Partial<Record<LayoutStudioPanelId, number>> = {
  calendarDay: 10,
  calendarToday: 20,
  agenda: 30,
  calendarWeek: 40,
  calendarWeekFull: 50,
  calendarMonth: 60,
  calendarMonthFull: 70,
  'tile:calendar': 80,
  'tile:next_online_meeting': 90,
  'tile:deadlines': 100,
  zeitliste: 110
}

export function buildAllLayoutStudioPanelEntries(): LayoutStudioPanelCatalogEntry[] {
  const core = LAYOUT_STUDIO_CORE_PANEL_IDS.filter(
    (id) => !HIDDEN_LAYOUT_STUDIO_PICKER_CORE_IDS.has(id)
  ).map((id) => getLayoutStudioPanelCatalogEntry(id))
  const tiles = DASHBOARD_TILE_IDS.filter(
    (id) => id !== 'composer' && !HIDDEN_LAYOUT_STUDIO_PICKER_TILE_IDS.has(id)
  ).map((id) => getLayoutStudioPanelCatalogEntry(tilePanelId(id)))
  return [...core, ...tiles]
}

export type LayoutStudioPanelGroup = {
  category: LayoutStudioPanelCategory
  categoryLabel: string
  items: Array<{
    id: LayoutStudioPanelId
    label: string
    Icon: LucideIcon
  }>
}

/** Gruppen nach Typ, Kategorien und Einträge alphabetisch nach Anzeigename. */
export function buildLayoutStudioPanelGroups(t: TFunction, locale: string): LayoutStudioPanelGroup[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' })
  const byCategory = new Map<LayoutStudioPanelCategory, LayoutStudioPanelGroup['items']>()

  for (const entry of buildAllLayoutStudioPanelEntries()) {
    const label = t(layoutStudioPanelTitleKey(entry.id))
    const list = byCategory.get(entry.category) ?? []
    list.push({ id: entry.id, label, Icon: entry.Icon })
    byCategory.set(entry.category, list)
  }

  const groups: LayoutStudioPanelGroup[] = []
  for (const category of LAYOUT_STUDIO_PANEL_CATEGORY_ORDER) {
    const items = byCategory.get(category)
    if (!items?.length) continue
    if (category === 'calendar') {
      items.sort((a, b) => {
        const oa = CALENDAR_PANEL_PICKER_ORDER[a.id] ?? 500
        const ob = CALENDAR_PANEL_PICKER_ORDER[b.id] ?? 500
        if (oa !== ob) return oa - ob
        return collator.compare(a.label, b.label)
      })
    } else {
      items.sort((a, b) => collator.compare(a.label, b.label))
    }
    groups.push({
      category,
      categoryLabel: t(layoutStudioPanelCategoryLabelKey(category)),
      items
    })
  }

  groups.sort((a, b) => collator.compare(a.categoryLabel, b.categoryLabel))
  return groups
}

/** Fallback-Icon für unbekannte Panel-IDs. */
export function layoutStudioPanelFallbackIcon(): LucideIcon {
  return CircleDashed
}
