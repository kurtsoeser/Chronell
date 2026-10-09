import type { ReactNode } from 'react'
import type { CalendarShellColumnId } from '@/app/calendar/calendar-shell-column-order'
import { chronellPanelDividerClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'

export function CalendarShellDockColumn({
  columnId,
  isFirst,
  isLast,
  children,
  className
}: {
  columnId: CalendarShellColumnId
  isFirst: boolean
  isLast: boolean
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div
      data-calendar-dock-column={columnId}
      className={cn(
        'calendar-shell-dock-column flex h-full min-h-0 flex-col overflow-hidden',
        chronellPanelDividerClass,
        !isLast && 'border-r',
        isFirst && 'rounded-tl-[var(--radius-panel)]',
        columnId === 'calendar' && 'calendar-shell-dock-column--calendar min-w-0 flex-1',
        className
      )}
    >
      {children}
    </div>
  )
}
