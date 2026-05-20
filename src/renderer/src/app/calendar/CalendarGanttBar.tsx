import { useCallback, useState } from 'react'
import { Calendar, Mail, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { cn } from '@/lib/utils'
import { tailwindAccountBgToHex } from '@/lib/calendar-event-chip-style'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { calendarEventIconIsExplicit, resolveCalendarEventIcon } from '@/lib/calendar-event-icons'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import {
  GANTT_ROW_HEIGHT,
  ganttBarTopPx,
  type GanttPlacedBar
} from '@/app/calendar/calendar-gantt-layout'
import { formatGanttBarTooltip } from '@/app/calendar/gantt-bar-tooltip'
import { openMailReadingPopout } from '@/lib/open-mail-reading-popout'
import { GanttBarHoverTooltip } from '@/components/GanttBarHoverTooltip'

function accountFillHex(account?: ConnectedAccount): string | null {
  if (!account) return null
  const css = resolvedAccountColorCss(account.color)
  if (/^#[0-9A-Fa-f]{6}$/i.test(css)) return css
  return tailwindAccountBgToHex(css)
}

function kindIcon(item: WorkItem): typeof Calendar {
  if (item.kind === 'mail_todo') return Mail
  if (item.kind === 'calendar_event') return Calendar
  if (item.kind === 'cloud_task' && item.linkedMessageIds.length > 0) return Mail
  return Square
}

function barColors(item: WorkItem, account?: ConnectedAccount): {
  background: string
  color: string
  borderLeft: string
} {
  if (item.kind === 'calendar_event') {
    const ev = item.event
    const hex =
      ev.displayColorHex?.trim() ||
      tailwindAccountBgToHex(ev.accountColorClass) ||
      accountFillHex(account)
    if (hex) {
      return {
        background: `${hex}dd`,
        color: '#0f172a',
        borderLeft: `4px solid ${hex}`
      }
    }
  }
  if (item.kind === 'mail_todo') {
    const hex = accountFillHex(account)
    if (hex) {
      return {
        background: `${hex}cc`,
        color: '#fafafa',
        borderLeft: `4px solid ${hex}`
      }
    }
    return {
      background: 'hsl(var(--secondary) / 0.85)',
      color: 'hsl(var(--secondary-foreground))',
      borderLeft: '4px solid hsl(var(--secondary))'
    }
  }
  if (item.kind === 'cloud_task') {
    const hex = accountFillHex(account)
    if (hex) {
      return {
        background: `${hex}bb`,
        color: '#fafafa',
        borderLeft: `4px solid ${hex}`
      }
    }
    return {
      background: 'hsl(var(--primary) / 0.2)',
      color: 'hsl(var(--foreground))',
      borderLeft: '4px solid hsl(var(--primary))'
    }
  }
  return {
    background: 'hsl(var(--muted))',
    color: 'hsl(var(--foreground))',
    borderLeft: '4px solid hsl(var(--border))'
  }
}

export interface CalendarGanttBarProps {
  bar: GanttPlacedBar
  allDayRowCount: number
  account?: ConnectedAccount
  selected: boolean
  onSelect: () => void
  onPointerDownMove: (e: React.PointerEvent) => void
  onPointerDownResizeStart: (e: React.PointerEvent) => void
  onPointerDownResizeEnd: (e: React.PointerEvent) => void
}

export function CalendarGanttBar({
  bar,
  allDayRowCount,
  account,
  selected,
  onSelect,
  onPointerDownMove,
  onPointerDownResizeStart,
  onPointerDownResizeEnd
}: CalendarGanttBarProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const { item, interval, leftPx, widthPx, editable } = bar
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number } | null>(null)
  const tooltipText = formatGanttBarTooltip(item, interval, i18n.language)

  const showTip = useCallback((e: React.MouseEvent): void => {
    setHoverTip({ x: e.clientX, y: e.clientY })
  }, [])
  const moveTip = useCallback((e: React.MouseEvent): void => {
    setHoverTip({ x: e.clientX, y: e.clientY })
  }, [])
  const hideTip = useCallback((): void => {
    setHoverTip(null)
  }, [])
  const colors = barColors(item, account)
  const KindIcon = kindIcon(item)

  let EventIcon: ReturnType<typeof resolveCalendarEventIcon> | null = null
  let iconColor: string | undefined
  if (item.kind === 'calendar_event' && calendarEventIconIsExplicit(item.event.icon)) {
    EventIcon = resolveCalendarEventIcon(item.event.icon)
  } else if (item.kind === 'cloud_task' && calendarEventIconIsExplicit(item.task.iconId)) {
    EventIcon = resolveCalendarEventIcon(item.task.iconId)
    iconColor = resolveEntityIconColor(item.task.iconColor) ?? undefined
  }

  const DisplayIcon = EventIcon ?? KindIcon

  return (
    <>
    <button
      type="button"
      className={cn(
        'calendar-gantt-bar group absolute flex min-w-[6px] items-center gap-1 overflow-hidden rounded-md border border-black/10 px-1.5 py-0.5 text-left text-[11px] font-medium shadow-sm transition-shadow',
        bar.lane === 'allDay' && 'calendar-gantt-bar--all-day',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-90'
      )}
      style={{
        left: leftPx,
        width: widthPx,
        top: ganttBarTopPx(bar, allDayRowCount),
        height: GANTT_ROW_HEIGHT - 6,
        ...colors
      }}
      aria-label={tooltipText}
      onMouseEnter={showTip}
      onMouseMove={moveTip}
      onMouseLeave={hideTip}
      onClick={(e): void => {
        e.stopPropagation()
        onSelect()
      }}
      onDoubleClick={(e): void => {
        if (item.kind !== 'mail_todo') return
        e.stopPropagation()
        openMailReadingPopout(item.messageId, { osWindow: e.shiftKey })
      }}
      onPointerDown={(e): void => {
        hideTip()
        if (!editable) return
        const target = e.target as HTMLElement
        if (target.closest('[data-gantt-resize]')) return
        onPointerDownMove(e)
      }}
    >
      {editable ? (
        <>
          <span
            data-gantt-resize="start"
            className="absolute inset-y-0 left-0 z-[2] w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
            aria-hidden
            onPointerDown={(e): void => {
              e.stopPropagation()
              onPointerDownResizeStart(e)
            }}
          />
          <span
            data-gantt-resize="end"
            className="absolute inset-y-0 right-0 z-[2] w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
            aria-hidden
            onPointerDown={(e): void => {
              e.stopPropagation()
              onPointerDownResizeEnd(e)
            }}
          />
        </>
      ) : null}
      <DisplayIcon
        className="h-3.5 w-3.5 shrink-0 opacity-90"
        style={iconColor ? { color: iconColor } : undefined}
        strokeWidth={2}
        aria-hidden
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          item.completed && 'text-muted-foreground line-through'
        )}
      >
        {item.title}
      </span>
      {!editable ? (
        <span className="sr-only">{t('calendar.gantt.readOnlyBar')}</span>
      ) : null}
    </button>
    <GanttBarHoverTooltip
      text={tooltipText}
      anchorX={hoverTip?.x ?? 0}
      anchorY={hoverTip?.y ?? 0}
      visible={hoverTip != null}
    />
    </>
  )
}

export { GANTT_ROW_HEIGHT }
