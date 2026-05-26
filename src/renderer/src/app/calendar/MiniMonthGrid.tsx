import { useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  compareAsc,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEK_REF_MONDAY = new Date(2024, 0, 1)

function dayFromEventTarget(target: EventTarget | null): Date | null {
  let el: Element | null = target as Element | null
  while (el) {
    if (el instanceof HTMLElement && el.dataset.miniCalDay) {
      const ms = Date.parse(el.dataset.miniCalDay)
      return Number.isNaN(ms) ? null : new Date(ms)
    }
    el = el.parentElement
  }
  return null
}

export interface MiniMonthInboxDropHandlers {
  dropHoverDate: string | null
  onDayDragOver: (e: React.DragEvent, dateStr: string) => void
  onDayDragLeave: (e: React.DragEvent, dateStr: string) => void
  onDayDrop: (e: React.DragEvent, dateStr: string) => void
}

export interface MiniMonthSelectedRange {
  startInclusive: Date
  endInclusive: Date
}

export interface MiniMonthGridProps {
  monthAnchor: Date
  /** Vergleich fuer «Heute»-Markierung; Standard: jetzt. */
  today?: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  /** Persistente Markierung (z. B. Notizen-Filter). */
  selectedRange?: MiniMonthSelectedRange | null
  /** Kalender-Modul: Zeiger-Zug waehlt einen Tag- oder Mehr-Tage-Zeitraum. */
  onSelectDayRange?: (startInclusive: Date, endInclusive: Date) => void
  /** Inbox-Spalte: Mail per Drag auf Tag terminieren. */
  inboxDrop?: MiniMonthInboxDropHandlers
  /** Optional: einzelner Klick (Inbox). */
  onDayClick?: (day: Date) => void
  /** Kompaktere Darstellung (Datums-Popover). */
  compact?: boolean
}

/**
 * Monatsuebersicht wie in der Kalender-Shell: abgerundeter Kartenrahmen, Wochentage,
 * «Heute» mit destructive-Kreis, ausserhalb des Monats abgeschwaecht.
 */
function dayInInclusiveRange(d: Date, range: MiniMonthSelectedRange): boolean {
  const lo =
    compareAsc(range.startInclusive, range.endInclusive) <= 0
      ? startOfDay(range.startInclusive)
      : startOfDay(range.endInclusive)
  const hi =
    compareAsc(range.startInclusive, range.endInclusive) <= 0
      ? startOfDay(range.endInclusive)
      : startOfDay(range.startInclusive)
  const day = startOfDay(d)
  return compareAsc(day, lo) >= 0 && compareAsc(day, hi) <= 0
}

export function MiniMonthGrid({
  monthAnchor,
  today = new Date(),
  onPrevMonth,
  onNextMonth,
  selectedRange = null,
  onSelectDayRange,
  inboxDrop,
  onDayClick,
  compact = false
}: MiniMonthGridProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const dfLocale = i18n.language.startsWith('de') ? deFns : enUSFns
  const weekdayLabels = useMemo(() => {
    const ws = startOfWeek(WEEK_REF_MONDAY, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => format(addDays(ws, i), 'EEE', { locale: dfLocale }))
  }, [dfLocale])

  const gridStart = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const dragRef = useRef<{ anchor: Date; hover: Date } | null>(null)
  const [dragPaint, setDragPaint] = useState<{ anchor: Date; hover: Date } | null>(null)

  function finishDrag(): void {
    const g = dragRef.current
    dragRef.current = null
    setDragPaint(null)
    if (!g || !onSelectDayRange) return
    const lo = compareAsc(g.anchor, g.hover) <= 0 ? g.anchor : g.hover
    const hi = compareAsc(g.anchor, g.hover) <= 0 ? g.hover : g.anchor
    onSelectDayRange(lo, hi)
  }

  function dayInDraftRange(d: Date): boolean {
    if (!dragPaint) return false
    const lo = compareAsc(dragPaint.anchor, dragPaint.hover) <= 0 ? dragPaint.anchor : dragPaint.hover
    const hi = compareAsc(dragPaint.anchor, dragPaint.hover) <= 0 ? dragPaint.hover : dragPaint.anchor
    return compareAsc(d, lo) >= 0 && compareAsc(d, hi) <= 0
  }

  return (
    <div className={cn('rounded-md bg-card', compact ? 'p-1.5' : 'border border-border p-3')}>
      <div className={cn('flex items-center justify-between gap-2', compact ? 'mb-1' : 'mb-2')}>
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('calendar.miniMonth.prevMonthAria')}
        >
          <ChevronLeft className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
        <span className="chronell-type-mini-cal-title capitalize text-foreground">
          {format(monthAnchor, 'LLLL yyyy', { locale: dfLocale })}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('calendar.miniMonth.nextMonthAria')}
        >
          <ChevronRight className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </div>
      <div
        className={cn(
          'chronell-type-mini-cal-weekday grid grid-cols-7 text-center text-muted-foreground',
          compact ? 'gap-y-0' : 'gap-y-1'
        )}
      >
        {weekdayLabels.map((d) => (
          <div key={d} className={compact ? 'py-0.5' : 'py-1'}>
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid touch-none select-none grid-cols-7 gap-y-0.5 text-center"
        style={onSelectDayRange ? { touchAction: 'none' } : undefined}
      >
        {days.map((d) => {
          const inMonth = isSameMonth(d, monthAnchor)
          const isTodayCell = isSameDay(d, today)
          const inDraft = Boolean(onSelectDayRange) && dayInDraftRange(d)
          const inSelected = Boolean(selectedRange) && dayInInclusiveRange(d, selectedRange!)
          const dateStr = format(d, 'yyyy-MM-dd')
          const dropHover = Boolean(inboxDrop && inboxDrop.dropHoverDate === dateStr)
          const rangeOrDrop = inDraft || dropHover || inSelected

          return (
            <button
              key={d.toISOString()}
              type="button"
              data-mini-cal-day={d.toISOString()}
              data-date={inboxDrop ? dateStr : undefined}
              onClick={(): void => onDayClick?.(d)}
              onDragOver={
                inboxDrop
                  ? (e): void => {
                      inboxDrop.onDayDragOver(e, dateStr)
                    }
                  : undefined
              }
              onDragLeave={
                inboxDrop
                  ? (e): void => {
                      inboxDrop.onDayDragLeave(e, dateStr)
                    }
                  : undefined
              }
              onDrop={
                inboxDrop
                  ? (e): void => {
                      inboxDrop.onDayDrop(e, dateStr)
                    }
                  : undefined
              }
              onPointerDown={
                onSelectDayRange
                  ? (e): void => {
                      if (e.button !== 0) return
                      e.preventDefault()
                      dragRef.current = { anchor: d, hover: d }
                      setDragPaint({ anchor: d, hover: d })

                      const onMove = (ev: PointerEvent): void => {
                        const el = document.elementFromPoint(ev.clientX, ev.clientY)
                        const hit = dayFromEventTarget(el)
                        if (!hit || !dragRef.current) return
                        dragRef.current = { anchor: dragRef.current.anchor, hover: hit }
                        setDragPaint({ anchor: dragRef.current.anchor, hover: hit })
                      }
                      const onUp = (): void => {
                        window.removeEventListener('pointermove', onMove)
                        window.removeEventListener('pointerup', onUp)
                        window.removeEventListener('pointercancel', onUp)
                        finishDrag()
                      }
                      window.addEventListener('pointermove', onMove)
                      window.addEventListener('pointerup', onUp)
                      window.addEventListener('pointercancel', onUp)
                    }
                  : undefined
              }
              className={cn(
                'chronell-type-mini-cal-day mx-auto flex items-center justify-center rounded-full transition-colors',
                compact ? 'h-6 w-6' : 'h-7 w-7',
                !inMonth && 'text-muted-foreground/40',
                inMonth && !isTodayCell && !rangeOrDrop && 'text-foreground hover:bg-secondary',
                rangeOrDrop && 'bg-primary/25 text-foreground ring-1 ring-primary/35',
                isTodayCell &&
                  !rangeOrDrop &&
                  'bg-destructive text-destructive-foreground shadow-sm ring-1 ring-destructive/30 hover:bg-destructive/90',
                isTodayCell && rangeOrDrop && 'bg-primary/35 text-foreground ring-2 ring-destructive/50'
              )}
            >
              {format(d, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
