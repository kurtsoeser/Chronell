import { formatISO, startOfDay } from 'date-fns'
import { DashboardMiniMonth } from '@/app/home/DashboardMiniMonth'
import { DashboardMiniWeek } from '@/app/home/DashboardMiniWeek'
import { useDashboardTileCatalog } from '@/app/home/use-dashboard-tile-catalog'
import { MailCalendarDaySidebar } from '@/app/layout/mail-right-sidebar/MailCalendarDaySidebar'
import { LayoutStudioGraphCalendar } from '@/app/layout-studio/panels/LayoutStudioGraphCalendar'
import { useAppModeStore } from '@/stores/app-mode'
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'

function useCalendarNavHandlers(): {
  onOpenCalendarDay: (day: Date) => void
  onCreateEventOnDay: (day: Date) => void
} {
  const setAppMode = useAppModeStore((s) => s.setMode)
  return {
    onOpenCalendarDay: (day: Date): void => {
      useCalendarPendingFocusStore.getState().queueGotoDate(formatISO(startOfDay(day)))
      setAppMode('calendar')
    },
    onCreateEventOnDay: (day: Date): void => {
      useCalendarPendingFocusStore.getState().queueCreateEventOnDay(formatISO(startOfDay(day)))
      setAppMode('calendar')
    }
  }
}

export function LayoutStudioCalendarWeek(): JSX.Element {
  const nav = useCalendarNavHandlers()
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1">
      <DashboardMiniWeek {...nav} />
    </div>
  )
}

export function LayoutStudioCalendarMonth(): JSX.Element {
  const nav = useCalendarNavHandlers()
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1">
      <DashboardMiniMonth {...nav} />
    </div>
  )
}

export function LayoutStudioCalendarWeekFull(): JSX.Element {
  return <LayoutStudioGraphCalendar fcView="timeGridWeek" />
}

export function LayoutStudioCalendarMonthFull(): JSX.Element {
  return <LayoutStudioGraphCalendar fcView="dayGridMonth" />
}

export function LayoutStudioCalendarMain(): JSX.Element {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <MailCalendarDaySidebar />
    </div>
  )
}

export function LayoutStudioCalendarToday(): JSX.Element {
  const { tileById } = useDashboardTileCatalog()
  const tile = tileById.get('today_timeline')
  if (!tile?.body) {
    return <div className="min-h-0 flex-1" />
  }
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{tile.body}</div>
}
