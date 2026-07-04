import { compareAsc, endOfDay, format, parseISO, startOfDay, startOfMonth } from 'date-fns'
import { resolveDateFnsLocale } from '@/lib/date-fns-locale'
import type { MiniMonthSelectedRange } from '@/app/calendar/MiniMonthGrid'
import {
  resolveNoteCalendarSpanForMode,
  type NoteCalendarSpan,
  type NotesCalendarDateMode
} from '@shared/note-calendar-span'
import type { UserNoteListItem } from '@shared/types'

function calendarSpanTimeBounds(span: NoteCalendarSpan): { startMs: number; endMs: number } {
  if (span.allDay) {
    const startMs = startOfDay(parseISO(span.startIso.slice(0, 10))).getTime()
    const endExclusiveMs = startOfDay(parseISO(span.endIso.slice(0, 10))).getTime()
    return { startMs, endMs: endExclusiveMs - 1 }
  }
  return {
    startMs: new Date(span.startIso).getTime(),
    endMs: new Date(span.endIso).getTime()
  }
}

export function noteOverlapsMiniCalendarRange(
  note: UserNoteListItem,
  range: MiniMonthSelectedRange,
  dateMode: NotesCalendarDateMode
): boolean {
  const span = resolveNoteCalendarSpanForMode(note, dateMode)
  if (!span) return false
  const filterStartMs = startOfDay(range.startInclusive).getTime()
  const filterEndMs = endOfDay(range.endInclusive).getTime()
  const { startMs, endMs } = calendarSpanTimeBounds(span)
  return startMs <= filterEndMs && endMs >= filterStartMs
}

export function notesForMiniCalendarRange(
  notes: UserNoteListItem[],
  range: MiniMonthSelectedRange | null,
  dateMode: NotesCalendarDateMode
): UserNoteListItem[] {
  if (!range) return notes
  return notes.filter((note) => noteOverlapsMiniCalendarRange(note, range, dateMode))
}

export function notesSelectedRange(dateFrom: string, dateTo: string): MiniMonthSelectedRange | null {
  if (!dateFrom.trim() && !dateTo.trim()) return null
  const from = dateFrom.trim() || dateTo.trim()
  const to = dateTo.trim() || dateFrom.trim()
  const start = startOfDay(parseISO(from))
  const end = startOfDay(parseISO(to))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return compareAsc(start, end) <= 0
    ? { startInclusive: start, endInclusive: end }
    : { startInclusive: end, endInclusive: start }
}

export function notesDateRangeLabel(dateFrom: string, dateTo: string, locale: string): string {
  const range = notesSelectedRange(dateFrom, dateTo)
  if (!range) return ''
  const dfLocale = resolveDateFnsLocale(locale)
  const sameDay = range.startInclusive.getTime() === range.endInclusive.getTime()
  if (sameDay) {
    return format(range.startInclusive, 'd. MMM yyyy', { locale: dfLocale })
  }
  return `${format(range.startInclusive, 'd. MMM', { locale: dfLocale })} – ${format(range.endInclusive, 'd. MMM yyyy', { locale: dfLocale })}`
}

export function applyNotesMiniCalendarRange(
  startInclusive: Date,
  endInclusive: Date,
  setDateFrom: (v: string) => void,
  setDateTo: (v: string) => void,
  setMiniMonth: (v: Date | ((prev: Date) => Date)) => void
): void {
  const lo = compareAsc(startInclusive, endInclusive) <= 0 ? startInclusive : endInclusive
  const hi = compareAsc(startInclusive, endInclusive) <= 0 ? endInclusive : startInclusive
  setDateFrom(format(lo, 'yyyy-MM-dd'))
  setDateTo(format(hi, 'yyyy-MM-dd'))
  setMiniMonth(startOfMonth(lo))
}

export function clearNotesDateRange(
  setDateFrom: (v: string) => void,
  setDateTo: (v: string) => void
): void {
  setDateFrom('')
  setDateTo('')
}
