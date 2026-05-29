import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  format,
  getISOWeek,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear
} from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { TimeGridSlotMinutes } from '@/app/calendar/calendar-shell-storage'

export const GANTT_TIMELINE_VIEW_ID = 'ganttTimeline' as const

export type GanttTimelineScale =
  | 'hour'
  | 'day'
  | 'week'
  | 'twoWeeks'
  | 'month'
  | 'quarter'
  | 'year'

export const GANTT_TIMELINE_SCALES: readonly GanttTimelineScale[] = [
  'hour',
  'day',
  'week',
  'twoWeeks',
  'month',
  'quarter',
  'year'
] as const

export interface GanttScaleConfig {
  /** Sichtbares Zeitfenster [start, end). */
  visibleRange: (anchor: Date) => { start: Date; end: Date }
  /** Verschiebung bei Vor/Zurück. */
  navStep: (anchor: Date, direction: -1 | 1) => Date
  /** Mindestbreite einer Spalte in px. */
  columnWidthPx: number
  /** Raster-Snap beim Ziehen (ms); 0 = kein Snap. */
  snapMs: number
}

const WEEK_OPTS = { weekStartsOn: 1 as const, firstWeekContainsDate: 4 as const }

export const GANTT_SCALE_CONFIG: Record<GanttTimelineScale, GanttScaleConfig> = {
  hour: {
    visibleRange: (anchor) => {
      const day = startOfDay(anchor)
      return { start: day, end: addDays(day, 1) }
    },
    navStep: (anchor, dir) => addDays(startOfDay(anchor), dir),
    columnWidthPx: 44,
    snapMs: 15 * 60 * 1000
  },
  day: {
    visibleRange: (anchor) => {
      const c = startOfDay(anchor)
      return { start: addDays(c, -7), end: addDays(c, 21) }
    },
    navStep: (anchor, dir) => addDays(startOfDay(anchor), dir * 7),
    columnWidthPx: 520,
    snapMs: 24 * 60 * 60 * 1000
  },
  week: {
    visibleRange: (anchor) => {
      const c = startOfDay(anchor)
      const start = startOfWeek(addWeeks(c, -4), WEEK_OPTS)
      const end = endOfWeek(addWeeks(c, 8), WEEK_OPTS)
      return { start, end: addDays(end, 1) }
    },
    navStep: (anchor, dir) => addWeeks(startOfDay(anchor), dir),
    columnWidthPx: 1080,
    snapMs: 24 * 60 * 60 * 1000
  },
  twoWeeks: {
    visibleRange: (anchor) => {
      const c = startOfDay(anchor)
      const start = startOfWeek(addWeeks(c, -6), WEEK_OPTS)
      const end = endOfWeek(addWeeks(c, 10), WEEK_OPTS)
      return { start, end: addDays(end, 1) }
    },
    navStep: (anchor, dir) => addWeeks(startOfDay(anchor), dir * 2),
    columnWidthPx: 88,
    snapMs: 24 * 60 * 60 * 1000
  },
  month: {
    visibleRange: (anchor) => {
      const c = startOfMonth(anchor)
      return { start: addMonths(c, -2), end: addMonths(c, 5) }
    },
    navStep: (anchor, dir) => addMonths(startOfMonth(anchor), dir),
    columnWidthPx: 1000,
    snapMs: 24 * 60 * 60 * 1000
  },
  quarter: {
    visibleRange: (anchor) => {
      const c = startOfQuarter(anchor)
      return { start: addQuarters(c, -2), end: addQuarters(c, 3) }
    },
    navStep: (anchor, dir) => addQuarters(startOfQuarter(anchor), dir),
    columnWidthPx: 112,
    snapMs: 7 * 24 * 60 * 60 * 1000
  },
  year: {
    visibleRange: (anchor) => {
      const c = startOfYear(anchor)
      return { start: addYears(c, -1), end: addYears(c, 2) }
    },
    navStep: (anchor, dir) => addYears(startOfYear(anchor), dir),
    columnWidthPx: 128,
    snapMs: 30 * 24 * 60 * 60 * 1000
  }
}

export function ganttVisibleRange(
  anchor: Date,
  scale: GanttTimelineScale
): { start: Date; end: Date } {
  return GANTT_SCALE_CONFIG[scale].visibleRange(anchor)
}

export function ganttNavStepAnchor(
  anchor: Date,
  scale: GanttTimelineScale,
  direction: -1 | 1
): Date {
  return GANTT_SCALE_CONFIG[scale].navStep(anchor, direction)
}

export interface GanttHeaderColumn {
  key: string
  start: Date
  end: Date
  /** Primäre Beschriftung (Zahl oder Uhrzeit). */
  primary: string
  /** Sekundär (Wochentag / KW). */
  secondary?: string
  /** Monatszeile darüber (bei Tagesraster). */
  monthLabel?: string
  /** Tageszeile (Stundenansicht). */
  dayLabel?: string
  isWeekend?: boolean
  isToday?: boolean
  /** Aktueller Raster-Slot (Stundenansicht). */
  isNowSlot?: boolean
  /** Volle Stunde (Stundenansicht, stärkere Gitterlinie). */
  isHourBoundary?: boolean
}

/** Lesbare Spaltenbreite pro Slot – feineres Raster = mehr Spalten = breiterer Tag. */
const HOUR_SLOT_WIDTH_PX: Record<TimeGridSlotMinutes, number> = {
  5: 14,
  6: 16,
  10: 22,
  12: 26,
  15: 36,
  20: 44,
  30: 56,
  60: 96
}

export function ganttHourSlotColumnWidthPx(slotMinutes: TimeGridSlotMinutes): number {
  return HOUR_SLOT_WIDTH_PX[slotMinutes] ?? 36
}

export function ganttHourDayWidthPx(slotMinutes: TimeGridSlotMinutes): number {
  const slotsPerDay = (24 * 60) / slotMinutes
  return Math.round(slotsPerDay * ganttHourSlotColumnWidthPx(slotMinutes))
}

function alignGanttRangeStartToSlot(rangeStart: Date, slotMinutes: number): Date {
  const slotMs = slotMinutes * 60 * 1000
  const aligned = Math.floor(rangeStart.getTime() / slotMs) * slotMs
  return new Date(aligned)
}

function hourSlotPrimaryLabel(t: Date, locale: typeof deFns): string {
  if (t.getMinutes() !== 0) return ''
  return format(t, 'HH:mm', { locale })
}

export function buildGanttHeaderColumns(
  rangeStart: Date,
  rangeEnd: Date,
  scale: GanttTimelineScale,
  localeCode: string,
  now = new Date(),
  hourSlotMinutes: TimeGridSlotMinutes = 15
): GanttHeaderColumn[] {
  const locale = localeCode.startsWith('de') ? deFns : enUSFns
  const todayStart = startOfDay(now).getTime()
  const cols: GanttHeaderColumn[] = []

  if (scale === 'hour') {
    const slotMinutes = hourSlotMinutes
    let t = alignGanttRangeStartToSlot(rangeStart, slotMinutes)
    let prevDayStart: number | null = null
    let prevMonthKey: string | null = null
    const nowMs = now.getTime()
    while (t.getTime() < rangeEnd.getTime()) {
      const end = addMinutes(t, slotMinutes)
      const slotStartMs = t.getTime()
      const slotEndMs = end.getTime()
      const dayStart = startOfDay(t).getTime()
      const monthKey = format(t, 'yyyy-MM', { locale })
      const isNewDay = prevDayStart == null || dayStart !== prevDayStart
      const isNewMonth = prevMonthKey == null || monthKey !== prevMonthKey
      cols.push({
        key: t.toISOString(),
        start: t,
        end,
        primary: hourSlotPrimaryLabel(t, locale),
        dayLabel: isNewDay ? format(t, 'EEE d. MMM', { locale }) : undefined,
        monthLabel: isNewMonth ? format(t, 'MMMM yyyy', { locale }) : undefined,
        isToday: dayStart === todayStart,
        isNowSlot: nowMs >= slotStartMs && nowMs < slotEndMs,
        isHourBoundary: t.getMinutes() === 0
      })
      prevDayStart = dayStart
      prevMonthKey = monthKey
      t = end
    }
    return cols
  }

  if (scale === 'day' || scale === 'week' || scale === 'twoWeeks') {
    const stepDays = scale === 'day' ? 1 : scale === 'week' ? 7 : 14
    let t = startOfDay(rangeStart)
    if (scale !== 'day') {
      t = startOfWeek(t, WEEK_OPTS)
    }
    while (t.getTime() < rangeEnd.getTime()) {
      const end = addDays(t, stepDays)
      const isToday = startOfDay(t).getTime() === todayStart
      const weekNum = getISOWeek(t)
      cols.push({
        key: t.toISOString(),
        start: t,
        end,
        primary: scale === 'day' ? format(t, 'd', { locale }) : format(t, 'd MMM', { locale }),
        secondary:
          scale === 'day'
            ? format(t, 'EEEEE', { locale })
            : scale === 'week'
              ? localeCode.startsWith('de')
                ? `KW ${weekNum}`
                : `W${weekNum}`
              : undefined,
        monthLabel:
          t.getDate() === 1 || cols.length === 0 ? format(t, 'MMM yyyy', { locale }) : undefined,
        isWeekend: t.getDay() === 0 || t.getDay() === 6,
        isToday
      })
      t = end
    }
    return cols
  }

  if (scale === 'month') {
    let t = startOfMonth(rangeStart)
    while (t.getTime() < rangeEnd.getTime()) {
      const end = addMonths(t, 1)
      cols.push({
        key: t.toISOString(),
        start: t,
        end,
        primary: format(t, 'MMM', { locale }),
        monthLabel: format(t, 'yyyy', { locale }),
        isToday: now >= t && now < end
      })
      t = end
    }
    return cols
  }

  if (scale === 'quarter') {
    let t = startOfQuarter(rangeStart)
    while (t.getTime() < rangeEnd.getTime()) {
      const end = addQuarters(t, 1)
      cols.push({
        key: t.toISOString(),
        start: t,
        end,
        primary: `Q${Math.floor(t.getMonth() / 3) + 1}`,
        monthLabel: format(t, 'yyyy', { locale }),
        isToday: now >= t && now < end
      })
      t = end
    }
    return cols
  }

  let t = startOfYear(rangeStart)
  while (t.getTime() < rangeEnd.getTime()) {
    const end = addYears(t, 1)
    cols.push({
      key: t.toISOString(),
      start: t,
      end,
      primary: format(t, 'yyyy', { locale }),
      isToday: now >= t && now < end
    })
    t = end
  }
  return cols
}

export function ganttTimelineWidthPx(
  columns: GanttHeaderColumn[],
  columnWidthPx: number
): number {
  return Math.max(columns.length * columnWidthPx, 480)
}

export function ganttColumnWidthPx(
  scale: GanttTimelineScale,
  hourSlotMinutes: TimeGridSlotMinutes = 15
): number {
  if (scale === 'hour') return ganttHourSlotColumnWidthPx(hourSlotMinutes)
  return GANTT_SCALE_CONFIG[scale].columnWidthPx
}

export function ganttSnapMs(
  scale: GanttTimelineScale,
  hourSlotMinutes: TimeGridSlotMinutes = 15
): number {
  if (scale === 'hour') return hourSlotMinutes * 60 * 1000
  return GANTT_SCALE_CONFIG[scale].snapMs
}

export function ganttRangeTitle(
  rangeStart: Date,
  rangeEnd: Date,
  localeCode: string
): string {
  const locale = localeCode.startsWith('de') ? deFns : enUSFns
  const endInclusive = addDays(endOfDay(addDays(rangeEnd, -1)), 0)
  if (differenceInCalendarDays(endInclusive, rangeStart) <= 1) {
    return format(rangeStart, 'd. MMMM yyyy', { locale })
  }
  const sameYear = rangeStart.getFullYear() === endInclusive.getFullYear()
  if (sameYear) {
    return `${format(rangeStart, 'd. MMM', { locale })} – ${format(endInclusive, 'd. MMM yyyy', { locale })}`
  }
  return `${format(rangeStart, 'd. MMM yyyy', { locale })} – ${format(endInclusive, 'd. MMM yyyy', { locale })}`
}

export function msToGanttX(
  ms: number,
  rangeStartMs: number,
  rangeEndMs: number,
  widthPx: number
): number {
  if (rangeEndMs <= rangeStartMs) return 0
  const t = (ms - rangeStartMs) / (rangeEndMs - rangeStartMs)
  return Math.max(0, Math.min(widthPx, t * widthPx))
}

export function ganttXToMs(
  x: number,
  rangeStartMs: number,
  rangeEndMs: number,
  widthPx: number
): number {
  if (widthPx <= 0) return rangeStartMs
  const t = x / widthPx
  return rangeStartMs + t * (rangeEndMs - rangeStartMs)
}

export function snapGanttMs(ms: number, snapMs: number): number {
  if (snapMs <= 0) return ms
  return Math.round(ms / snapMs) * snapMs
}

/** X-Position der „Jetzt“-Linie; null wenn außerhalb. */
export function ganttNowLineX(
  now: Date,
  rangeStart: Date,
  rangeEnd: Date,
  widthPx: number
): number | null {
  const ms = now.getTime()
  const start = rangeStart.getTime()
  const end = rangeEnd.getTime()
  if (ms < start || ms >= end) return null
  return msToGanttX(ms, start, end, widthPx)
}

export function endMsExclusiveForGantt(end: Date, allDay: boolean): number {
  if (!allDay) return end.getTime()
  return endOfDay(addDays(end, -1)).getTime() + 1
}
