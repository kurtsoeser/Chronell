import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CalendarDays,
  LayoutPanelLeft,
  ListTree
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CalendarShellColumnId } from '@/app/calendar/calendar-shell-column-order'
import { moduleColumnHeaderIconGlyphClass } from '@/components/ModuleColumnHeader'
import { cn } from '@/lib/utils'

const COLUMN_META: Record<
  Exclude<CalendarShellColumnId, never>,
  { icon: LucideIcon; showKey: string; hideKey: string }
> = {
  zeitliste: {
    icon: ListTree,
    showKey: 'calendar.posteingangUi.toggleInboxShow',
    hideKey: 'calendar.posteingangUi.toggleInboxHide'
  },
  calendar: {
    icon: CalendarDays,
    showKey: 'calendar.shell.topbarToggleCalendarShow',
    hideKey: 'calendar.shell.topbarToggleCalendarHide'
  },
  preview: {
    icon: BookOpen,
    showKey: 'calendar.posteingangUi.togglePreviewShow',
    hideKey: 'calendar.posteingangUi.togglePreviewHide'
  },
  context: {
    icon: LayoutPanelLeft,
    showKey: 'calendar.posteingangUi.toggleContextShow',
    hideKey: 'calendar.posteingangUi.toggleContextHide'
  }
}

export function topbarColumnToggleButtonClass(open: boolean): string {
  return cn(
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
    open
      ? 'border border-primary/40 bg-primary/10 text-foreground'
      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
  )
}

export function CalendarShellColumnTopbarToggle({
  columnId,
  open,
  onOpenChange
}: {
  columnId: CalendarShellColumnId
  open: boolean
  onOpenChange: (next: boolean) => void
}): JSX.Element {
  const { t } = useTranslation()
  const meta = COLUMN_META[columnId]
  const Icon = meta.icon

  return (
    <button
      type="button"
      title={open ? t(meta.hideKey) : t(meta.showKey)}
      aria-label={open ? t(meta.hideKey) : t(meta.showKey)}
      aria-pressed={open}
      onClick={(): void => onOpenChange(!open)}
      className={topbarColumnToggleButtonClass(open)}
    >
      <Icon className={moduleColumnHeaderIconGlyphClass} aria-hidden />
    </button>
  )
}
