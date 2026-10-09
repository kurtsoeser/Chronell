import {
  addCalendarDaysIsoDate,
  isoDateInTimeZone,
  zonedDayBoundsUtcIso,
  zonedLocalDateTimeToUtcIso
} from '@shared/zoned-iso-date'

export type TimelinePeriodGroupKey =
  | 'earlier'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'next_week'
  | 'later'
  | 'no_date'

export const TIMELINE_PERIOD_GROUP_RANK: Record<TimelinePeriodGroupKey, number> = {
  earlier: 0,
  today: 1,
  tomorrow: 2,
  this_week: 3,
  next_week: 4,
  later: 5,
  no_date: 6
}

function daysUntilSundayInZone(nowMs: number, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(
    new Date(nowMs)
  )
  if (weekday === 'Sun') return 0
  if (weekday === 'Mon') return 6
  if (weekday === 'Tue') return 5
  if (weekday === 'Wed') return 4
  if (weekday === 'Thu') return 3
  if (weekday === 'Fri') return 2
  return 1
}

/** Ende der Kalenderwoche (Sonntag 23:59:59) und Ende der Folgewoche — wie ToDo-„diese Woche“. */
export function timelinePeriodEndNextWeekIso(timeZone: string, nowMs = Date.now()): string {
  const today = isoDateInTimeZone(new Date(nowMs), timeZone)
  const weekEndDate = addCalendarDaysIsoDate(today, daysUntilSundayInZone(nowMs, timeZone), timeZone)
  const nextWeekEndDate = addCalendarDaysIsoDate(weekEndDate, 7, timeZone)
  return zonedLocalDateTimeToUtcIso(nextWeekEndDate, 23, 59, 59, timeZone)
}

/**
 * Gruppiert Einträge der Zeitliste nach Heute / Morgen / diese Woche / nächste Woche / später
 * (anhand der effektiven Sortierzeit, typisch Planung vor Fälligkeit).
 */
export function classifyTimelinePeriodFromIso(
  isoRaw: string | null | undefined,
  timeZone: string,
  nowMs = Date.now()
): TimelinePeriodGroupKey {
  const iso = isoRaw?.trim()
  if (!iso) return 'no_date'

  const b = zonedDayBoundsUtcIso(nowMs, timeZone)
  const endNextWeekIso = timelinePeriodEndNextWeekIso(timeZone, nowMs)

  if (iso < b.startTodayIso) return 'earlier'
  if (iso <= b.endTodayIso) return 'today'
  if (iso <= b.endTomorrowIso) return 'tomorrow'
  if (iso <= b.endWeekIso) return 'this_week'
  if (iso <= endNextWeekIso) return 'next_week'
  return 'later'
}
