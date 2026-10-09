import { SquareArrowOutUpRight, X } from 'lucide-react'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderDockBarRowClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderUppercaseLabelClass
} from '@/components/ModuleColumnHeader'
import {
  CalendarShellColumnHeaderDragSurface,
  calendarColumnHeaderNoDragProps
} from '@/app/calendar/calendar-shell-column-dnd'
import { cn } from '@/lib/utils'

export function CalendarPreviewDockHeader({
  label,
  undockTitle,
  hideTitle,
  onUndock,
  onHide,
  className
}: {
  label: string
  undockTitle: string
  hideTitle: string
  onUndock?: () => void
  onHide: () => void
  className?: string
}): JSX.Element {
  return (
    <CalendarShellColumnHeaderDragSurface
      className={cn('calendar-shell-dock-column-header px-2', className)}
    >
      <div className={moduleColumnHeaderDockBarRowClass}>
        <span
          className={cn(moduleColumnHeaderUppercaseLabelClass, 'min-w-0 flex-1 text-left')}
        >
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-0.5" {...calendarColumnHeaderNoDragProps}>
          {onUndock ? (
            <ModuleColumnHeaderIconButton title={undockTitle} onClick={onUndock}>
              <SquareArrowOutUpRight className={moduleColumnHeaderIconGlyphClass} />
            </ModuleColumnHeaderIconButton>
          ) : null}
          <ModuleColumnHeaderIconButton title={hideTitle} onClick={onHide}>
            <X className={moduleColumnHeaderIconGlyphClass} />
          </ModuleColumnHeaderIconButton>
        </div>
      </div>
    </CalendarShellColumnHeaderDragSurface>
  )
}
