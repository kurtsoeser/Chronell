import { PanelRightClose, SquareArrowOutUpRight } from 'lucide-react'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderDockBarRowClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderUppercaseLabelClass
} from '@/components/ModuleColumnHeader'
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
    <div
      className={cn(
        'calendar-shell-column-header flex shrink-0 flex-col justify-center border-b border-border px-2 py-1',
        className
      )}
    >
      <div className={moduleColumnHeaderDockBarRowClass}>
        <span
          className={cn(moduleColumnHeaderUppercaseLabelClass, 'min-w-0 flex-1 text-left')}
        >
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {onUndock ? (
            <ModuleColumnHeaderIconButton title={undockTitle} onClick={onUndock}>
              <SquareArrowOutUpRight className={moduleColumnHeaderIconGlyphClass} />
            </ModuleColumnHeaderIconButton>
          ) : null}
          <ModuleColumnHeaderIconButton title={hideTitle} onClick={onHide}>
            <PanelRightClose className={moduleColumnHeaderIconGlyphClass} />
          </ModuleColumnHeaderIconButton>
        </div>
      </div>
    </div>
  )
}
