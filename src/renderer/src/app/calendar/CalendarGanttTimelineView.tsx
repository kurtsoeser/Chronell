import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject
} from 'react'
import { ChevronDown, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { cn } from '@/lib/utils'
import { useAccountsStore } from '@/stores/accounts'
import { loadMegaWorkItems } from '@/app/work-items/load-mega-work-items'
import { applyCalendarCompletionState } from '@/app/calendar/calendar-event-completion'
import { megaFetchRangeWithBuffer } from '@/app/work-items/load-master-work-items-for-range'
import {
  buildGanttHeaderColumns,
  GANTT_SCALE_CONFIG,
  GANTT_TIMELINE_SCALES,
  ganttNowLineX,
  ganttRangeTitle,
  ganttTimelineWidthPx,
  ganttVisibleRange,
  ganttXToMs,
  msToGanttX,
  snapGanttMs,
  type GanttTimelineScale
} from '@/app/calendar/calendar-gantt-scale'
import {
  ganttBarAreaHeightPx,
  intervalFromGanttDrag,
  layoutGanttBars,
  type GanttBarInterval,
  type GanttPlacedBar
} from '@/app/calendar/calendar-gantt-layout'
import { CalendarGanttBar } from '@/app/calendar/CalendarGanttBar'
import '@/app/calendar/calendar-gantt-timeline.css'

type DragMode = 'move' | 'resize-start' | 'resize-end'

interface ActiveDrag {
  mode: DragMode
  bar: GanttPlacedBar
  pointerId: number
  startPointerX: number
  origLeftPx: number
  origWidthPx: number
  origInterval: GanttBarInterval
}

export interface CalendarGanttTimelineViewProps {
  anchor: Date
  scale: GanttTimelineScale
  onScaleChange: (scale: GanttTimelineScale) => void
  onRangeTitleChange: (title: string) => void
  accounts: ConnectedAccount[]
  selectedKey: string | null
  onSelect: (item: WorkItem) => void
  onPersistSchedule: (item: WorkItem, interval: GanttBarInterval) => Promise<void>
  reloadSignal?: number
  reloadRef?: MutableRefObject<(() => void) | null>
  onLoadingChange?: (loading: boolean) => void
  scrollToTodaySignal?: number
  onNewEventClick?: () => void
  newEventDisabled?: boolean
}

export function CalendarGanttTimelineView({
  anchor,
  scale,
  onScaleChange,
  onRangeTitleChange,
  accounts,
  selectedKey,
  onSelect,
  onPersistSchedule,
  reloadSignal = 0,
  reloadRef,
  onLoadingChange,
  scrollToTodaySignal = 0,
  onNewEventClick,
  newEventDisabled
}: CalendarGanttTimelineViewProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const storeAccounts = useAccountsStore((s) => s.accounts)
  const taskAccounts = useMemo(
    () => storeAccounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [storeAccounts]
  )

  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scaleMenuOpen, setScaleMenuOpen] = useState(false)
  const scaleMenuRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragPreview, setDragPreview] = useState<GanttPlacedBar | null>(null)
  const activeDragRef = useRef<ActiveDrag | null>(null)

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => ganttVisibleRange(anchor, scale),
    [anchor, scale]
  )
  const rangeStartMs = rangeStart.getTime()
  const rangeEndMs = rangeEnd.getTime()

  const columns = useMemo(
    () => buildGanttHeaderColumns(rangeStart, rangeEnd, scale, i18n.language),
    [rangeStart, rangeEnd, scale, i18n.language]
  )
  const timelineWidthPx = useMemo(
    () => ganttTimelineWidthPx(columns, scale),
    [columns, scale]
  )
  const colWidthPx = GANTT_SCALE_CONFIG[scale].columnWidthPx
  const snapMs = GANTT_SCALE_CONFIG[scale].snapMs

  const placedBars = useMemo(() => {
    return layoutGanttBars(items, rangeStartMs, rangeEndMs, timelineWidthPx)
  }, [items, rangeStartMs, rangeEndMs, timelineWidthPx])

  const displayBars = dragPreview ? placedBars.map((b) => (b.item.stableKey === dragPreview.item.stableKey ? dragPreview : b)) : placedBars
  const rowCount = displayBars.reduce((m, b) => Math.max(m, b.row + 1), 0)
  const bodyHeightPx = ganttBarAreaHeightPx(rowCount)
  const nowLineX = ganttNowLineX(new Date(), rangeStart, rangeEnd, timelineWidthPx)

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts])

  useEffect(() => {
    onRangeTitleChange(ganttRangeTitle(rangeStart, rangeEnd, i18n.language))
  }, [rangeStart, rangeEnd, i18n.language, onRangeTitleChange])

  const loadItems = useCallback(async (): Promise<void> => {
    const { fetchStart, fetchEnd } = megaFetchRangeWithBuffer(rangeStart, rangeEnd)
    setLoading(true)
    onLoadingChange?.(true)
    setError(null)
    try {
      const result = await loadMegaWorkItems(taskAccounts, taskAccounts, {
        rangeStart: fetchStart,
        rangeEnd: fetchEnd,
        includeCompletedMail: true
      })
      setItems(applyCalendarCompletionState(result.items))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }, [rangeStart, rangeEnd, taskAccounts, onLoadingChange])

  useEffect(() => {
    void loadItems()
  }, [loadItems, reloadSignal])

  useEffect(() => {
    if (!reloadRef) return
    reloadRef.current = (): void => {
      void loadItems()
    }
    return (): void => {
      reloadRef.current = null
    }
  }, [reloadRef, loadItems])

  useLayoutEffect(() => {
    if (scrollToTodaySignal <= 0 || !scrollRef.current || nowLineX == null) return
    const el = scrollRef.current
    const target = Math.max(0, nowLineX - el.clientWidth * 0.3)
    el.scrollLeft = target
  }, [scrollToTodaySignal, nowLineX, scale])

  useEffect(() => {
    if (!scaleMenuOpen) return
    const onDoc = (e: MouseEvent): void => {
      if (scaleMenuRef.current?.contains(e.target as Node)) return
      setScaleMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [scaleMenuOpen])

  const finishDrag = useCallback(
    async (drag: ActiveDrag, finalBar: GanttPlacedBar): Promise<void> => {
      const changed =
        finalBar.interval.startMs !== drag.origInterval.startMs ||
        finalBar.interval.endMs !== drag.origInterval.endMs
      if (!changed) return
      try {
        await onPersistSchedule(drag.bar.item, finalBar.interval)
        setItems((prev) =>
          prev.map((it) => {
            if (it.stableKey !== drag.bar.item.stableKey) return it
            if (it.kind === 'calendar_event') {
              const sched = finalBar.interval
              return {
                ...it,
                planned: {
                  plannedStartIso: sched.allDay
                    ? new Date(sched.startMs).toISOString().slice(0, 10)
                    : new Date(sched.startMs).toISOString(),
                  plannedEndIso: sched.allDay
                    ? new Date(sched.endMs).toISOString().slice(0, 10)
                    : new Date(sched.endMs).toISOString()
                },
                event: {
                  ...it.event,
                  startIso: sched.allDay
                    ? new Date(sched.startMs).toISOString().slice(0, 10)
                    : new Date(sched.startMs).toISOString(),
                  endIso: sched.allDay
                    ? new Date(sched.endMs).toISOString().slice(0, 10)
                    : new Date(sched.endMs).toISOString(),
                  isAllDay: sched.allDay
                }
              }
            }
            if (it.kind === 'mail_todo') {
              return {
                ...it,
                planned: {
                  plannedStartIso: new Date(finalBar.interval.startMs).toISOString(),
                  plannedEndIso: new Date(finalBar.interval.endMs).toISOString()
                }
              }
            }
            return {
              ...it,
              planned: {
                plannedStartIso: new Date(finalBar.interval.startMs).toISOString(),
                plannedEndIso: new Date(finalBar.interval.endMs).toISOString()
              }
            }
          })
        )
        void loadItems()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [loadItems, onPersistSchedule]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent): void => {
      const drag = activeDragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      const dx = e.clientX - drag.startPointerX
      let left = drag.origLeftPx
      let width = drag.origWidthPx
      if (drag.mode === 'move') {
        left = drag.origLeftPx + dx
      } else if (drag.mode === 'resize-start') {
        left = drag.origLeftPx + dx
        width = drag.origWidthPx - dx
      } else {
        width = drag.origWidthPx + dx
      }
      width = Math.max(6, width)
      left = Math.max(0, Math.min(timelineWidthPx - width, left))
      const startMs = snapGanttMs(
        ganttXToMs(left, rangeStartMs, rangeEndMs, timelineWidthPx),
        snapMs
      )
      const endMs = snapGanttMs(
        ganttXToMs(left + width, rangeStartMs, rangeEndMs, timelineWidthPx),
        snapMs
      )
      const interval = intervalFromGanttDrag(
        startMs,
        endMs,
        drag.origInterval.allDay,
        snapMs
      )
      const preview: GanttPlacedBar = {
        ...drag.bar,
        leftPx: msToGanttX(interval.startMs, rangeStartMs, rangeEndMs, timelineWidthPx),
        widthPx: Math.max(
          6,
          msToGanttX(interval.endMs, rangeStartMs, rangeEndMs, timelineWidthPx) -
            msToGanttX(interval.startMs, rangeStartMs, rangeEndMs, timelineWidthPx)
        ),
        interval,
        row: drag.bar.row
      }
      setDragPreview(preview)
    },
    [rangeEndMs, rangeStartMs, snapMs, timelineWidthPx]
  )

  const onPointerUp = useCallback(
    (e: PointerEvent): void => {
      const drag = activeDragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      activeDragRef.current = null
      const finalBar = dragPreview ?? drag.bar
      setDragPreview(null)
      void finishDrag(drag, finalBar)
    },
    [dragPreview, finishDrag, onPointerMove]
  )

  const startDrag = useCallback(
    (mode: DragMode, bar: GanttPlacedBar, e: React.PointerEvent): void => {
      if (!bar.editable) return
      e.preventDefault()
      e.stopPropagation()
      const drag: ActiveDrag = {
        mode,
        bar,
        pointerId: e.pointerId,
        startPointerX: e.clientX,
        origLeftPx: bar.leftPx,
        origWidthPx: bar.widthPx,
        origInterval: { ...bar.interval }
      }
      activeDragRef.current = drag
      setDragPreview(bar)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [onPointerMove, onPointerUp]
  )

  const scaleLabel = (s: GanttTimelineScale): string => t(`calendar.gantt.scales.${s}`)

  return (
    <div className="calendar-gantt-root">
      <div className="calendar-gantt-toolbar">
        <div className="relative" ref={scaleMenuRef}>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
            onClick={(): void => setScaleMenuOpen((o) => !o)}
          >
            {scaleLabel(scale)}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </button>
          {scaleMenuOpen ? (
            <div className="calendar-gantt-scale-menu" role="menu">
              {GANTT_TIMELINE_SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  className={cn(
                    'flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-accent',
                    s === scale && 'bg-muted font-medium'
                  )}
                  onClick={(): void => {
                    onScaleChange(s)
                    setScaleMenuOpen(false)
                  }}
                >
                  {scaleLabel(s)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {onNewEventClick != null ? (
          <button
            type="button"
            disabled={Boolean(newEventDisabled)}
            className={cn(
              'ml-auto flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90',
              newEventDisabled && 'cursor-not-allowed opacity-45'
            )}
            onClick={(): void => {
              if (!newEventDisabled) onNewEventClick()
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('calendar.shell.newEvent')}
          </button>
        ) : null}
        {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>

      {error ? (
        <p className="shrink-0 px-3 py-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="calendar-gantt-scroll" ref={scrollRef}>
        <div className="calendar-gantt-header-sticky" style={{ width: timelineWidthPx }}>
          {columns.some((c) => c.monthLabel) ? (
            <div className="calendar-gantt-header-row">
              {columns.map((col) => (
                <div
                  key={`m-${col.key}`}
                  className="calendar-gantt-header-month"
                  style={{ width: colWidthPx }}
                >
                  {col.monthLabel ?? ''}
                </div>
              ))}
            </div>
          ) : null}
          <div className="calendar-gantt-header-row">
            {columns.map((col) => (
              <div
                key={col.key}
                className={cn(
                  'calendar-gantt-header-col',
                  col.isWeekend && 'calendar-gantt-header-col--weekend',
                  col.isToday && 'calendar-gantt-header-col--today'
                )}
                style={{ width: colWidthPx }}
              >
                {col.secondary ? (
                  <span className="calendar-gantt-header-secondary">{col.secondary}</span>
                ) : null}
                <span className="calendar-gantt-header-primary">{col.primary}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-gantt-body" style={{ width: timelineWidthPx, height: bodyHeightPx }}>
          {columns.map((col, i) => (
            <div
              key={`g-${col.key}`}
              className={cn(
                'calendar-gantt-grid-col',
                col.isWeekend && 'calendar-gantt-grid-col--weekend'
              )}
              style={{ left: i * colWidthPx, width: colWidthPx }}
            />
          ))}
          {nowLineX != null ? (
            <div className="calendar-gantt-now-line" style={{ left: nowLineX }} aria-hidden />
          ) : null}
          <div className="calendar-gantt-bar-layer" style={{ height: bodyHeightPx }}>
            {displayBars.length === 0 && !loading ? (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                {t('calendar.gantt.empty')}
              </p>
            ) : null}
            {displayBars.map((bar) => (
              <CalendarGanttBar
                key={bar.item.stableKey}
                bar={bar}
                account={accountById.get(bar.item.accountId)}
                selected={selectedKey === bar.item.stableKey}
                onSelect={(): void => onSelect(bar.item)}
                onPointerDownMove={(e): void => startDrag('move', bar, e)}
                onPointerDownResizeStart={(e): void => startDrag('resize-start', bar, e)}
                onPointerDownResizeEnd={(e): void => startDrag('resize-end', bar, e)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

