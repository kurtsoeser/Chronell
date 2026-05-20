import type { ReactNode } from 'react'
import { MiniMonthGrid, type MiniMonthGridProps } from '@/app/calendar/MiniMonthGrid'
import {
  moduleNavColumnMiniMonthFooterClass,
  moduleNavColumnMiniMonthShellClass
} from '@/components/module-shell-layout'
import { cn } from '@/lib/utils'

export type ModuleNavMiniMonthProps = MiniMonthGridProps & {
  className?: string
  footer?: ReactNode
}

/**
 * Mini-Monat in Modul-Nav-Spalten (Kalender, Aufgaben, Notizen): einheitliche Ränder.
 */
export function ModuleNavMiniMonth({
  className,
  footer,
  ...gridProps
}: ModuleNavMiniMonthProps): JSX.Element {
  return (
    <div className={cn(moduleNavColumnMiniMonthShellClass, className)}>
      <MiniMonthGrid {...gridProps} />
      {footer ? <div className={moduleNavColumnMiniMonthFooterClass}>{footer}</div> : null}
    </div>
  )
}
