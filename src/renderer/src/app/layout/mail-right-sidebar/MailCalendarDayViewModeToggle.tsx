import { Calendar1, CalendarDays, CalendarRange } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { MailCalendarSidebarViewMode } from '@/app/layout/mail-right-sidebar/mail-right-sidebar-calendar-view-mode'

const MODES = [
  { id: 'day' as const, icon: Calendar1, labelKey: 'calendar.views.day' },
  { id: 'week' as const, icon: CalendarRange, labelKey: 'calendar.views.week' },
  { id: 'month' as const, icon: CalendarDays, labelKey: 'calendar.views.month' }
] as const

export type MailCalendarDayViewModeToggleProps = {
  viewMode: MailCalendarSidebarViewMode
  onChange: (mode: MailCalendarSidebarViewMode) => void
  className?: string
}

export function MailCalendarDayViewModeToggle({
  viewMode,
  onChange,
  className
}: MailCalendarDayViewModeToggleProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div
      className={cn('flex shrink-0 items-center gap-px rounded-md border border-border/60 p-px', className)}
      role="group"
      aria-label={t('mail.rightSidebar.dayViewModeAria')}
    >
      {MODES.map(({ id, icon: Icon, labelKey }) => {
        const active = viewMode === id
        const label = t(labelKey)
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={(): void => onChange(id)}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-[3px] transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={2.25} />
          </button>
        )
      })}
    </div>
  )
}
