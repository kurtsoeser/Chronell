import type { CalendarZonedParts } from '@shared/calendar-datetime'
import { rruleUntilUtcFromDateOnly } from '@shared/calendar-datetime'
import type { CalendarSaveEventRecurrence } from '@shared/types'

const GRAPH_DOW = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const

const GOOGLE_BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

function graphDayOfWeek(parts: CalendarZonedParts): (typeof GRAPH_DOW)[number] {
  const idx = Math.min(Math.max(parts.weekday - 1, 0), 6)
  return GRAPH_DOW[idx]!
}
function normalizedWeekdays(
  recurrence: CalendarSaveEventRecurrence,
  fallback: (typeof GRAPH_DOW)[number]
): (typeof GRAPH_DOW)[number][] {
  const input = recurrence.weekdays ?? []
  const valid = input.filter((d): d is (typeof GRAPH_DOW)[number] =>
    (GRAPH_DOW as readonly string[]).includes(d)
  )
  return valid.length > 0 ? Array.from(new Set(valid)) : [fallback]
}

function googleByDay(parts: CalendarZonedParts): string {
  return GOOGLE_BYDAY[parts.weekday - 1]!
}

/**
 * Microsoft Graph `event.recurrence` = PatternedRecurrence (`pattern` + `range`).
 */
export function buildMicrosoftGraphRecurrencePayload(
  recurrence: CalendarSaveEventRecurrence,
  startLocal: CalendarZonedParts,
  recurrenceTimeZoneWindows: string
): { recurrence: Record<string, unknown> } {
  const startDateStr = startLocal.dateOnly
  let pattern: Record<string, unknown>
  switch (recurrence.frequency) {
    case 'daily':
      pattern = { type: 'daily', interval: 1 }
      break
    case 'weekly':
      {
        const days = normalizedWeekdays(recurrence, graphDayOfWeek(startLocal))
      pattern = {
        type: 'weekly',
        interval: 1,
        daysOfWeek: days,
        firstDayOfWeek: 'monday'
      }
      }
      break
    case 'biweekly':
      {
        const days = normalizedWeekdays(recurrence, graphDayOfWeek(startLocal))
      pattern = {
        type: 'weekly',
        interval: 2,
        daysOfWeek: days,
        firstDayOfWeek: 'monday'
      }
      }
      break
    case 'monthly':
      pattern = { type: 'absoluteMonthly', interval: 1, dayOfMonth: startLocal.day }
      break
    case 'yearly':
      pattern = {
        type: 'absoluteYearly',
        interval: 1,
        month: startLocal.month,
        dayOfMonth: startLocal.day
      }
      break
    default:
      pattern = { type: 'daily', interval: 1 }
  }

  const range: Record<string, unknown> = {
    recurrenceTimeZone: recurrenceTimeZoneWindows,
    startDate: startDateStr
  }
  switch (recurrence.rangeEnd) {
    case 'never':
      range.type = 'noEnd'
      break
    case 'until': {
      const ed = recurrence.untilDate?.trim()
      if (!ed || !/^\d{4}-\d{2}-\d{2}$/.test(ed)) {
        throw new Error('Serientermin: Enddatum (JJJJ-MM-TT) fehlt oder ist ungueltig.')
      }
      range.type = 'endDate'
      range.endDate = ed
      break
    }
    case 'count': {
      const n = recurrence.count
      if (n == null || !Number.isFinite(n) || n < 1 || n > 999) {
        throw new Error('Serientermin: Anzahl muss zwischen 1 und 999 liegen.')
      }
      range.type = 'numbered'
      range.numberOfOccurrences = Math.floor(n)
      break
    }
    default:
      range.type = 'noEnd'
  }

  return { recurrence: { pattern, range } }
}

/**
 * Google Calendar API: `event.recurrence` = RFC5545-Zeilen, z. B. `RRULE:...`.
 */
export function buildGoogleEventRecurrence(
  recurrence: CalendarSaveEventRecurrence,
  startLocal: CalendarZonedParts,
  calendarIanaTz: string,
  isAllDay: boolean
): string[] {
  const byday = normalizedWeekdays(recurrence, graphDayOfWeek(startLocal))
    .map((d) => GOOGLE_BYDAY[GRAPH_DOW.indexOf(d)]!)
    .join(',')
  let freqPart = ''
  switch (recurrence.frequency) {
    case 'daily':
      freqPart = 'FREQ=DAILY'
      break
    case 'weekly':
      freqPart = `FREQ=WEEKLY;INTERVAL=1;BYDAY=${byday}`
      break
    case 'biweekly':
      freqPart = `FREQ=WEEKLY;INTERVAL=2;BYDAY=${byday}`
      break
    case 'monthly':
      freqPart = `FREQ=MONTHLY;BYMONTHDAY=${startLocal.day}`
      break
    case 'yearly':
      freqPart = `FREQ=YEARLY;BYMONTH=${startLocal.month};BYMONTHDAY=${startLocal.day}`
      break
    default:
      freqPart = 'FREQ=DAILY'
  }

  let tail = ''
  if (recurrence.rangeEnd === 'count' && recurrence.count != null) {
    const n = Math.floor(recurrence.count)
    if (!Number.isFinite(n) || n < 1 || n > 999) {
      throw new Error('Serientermin: Anzahl muss zwischen 1 und 999 liegen.')
    }
    tail += `;COUNT=${n}`
  } else if (recurrence.rangeEnd === 'until' && recurrence.untilDate) {
    const u = recurrence.untilDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(u)) {
      throw new Error('Serientermin: Enddatum ungueltig.')
    }
    if (isAllDay) {
      tail += `;UNTIL=${u.replace(/-/g, '')}`
    } else {
      const untilUtc = rruleUntilUtcFromDateOnly(u, calendarIanaTz)
      if (!untilUtc) {
        throw new Error('Serientermin: Enddatum ungueltig.')
      }
      tail += `;UNTIL=${untilUtc}`
    }
  }

  return [`RRULE:${freqPart}${tail}`]
}

type GraphPatternedRecurrence = {
  pattern?: {
    type?: string | null
    interval?: number | null
    daysOfWeek?: Array<string | null> | null
  } | null
  range?: {
    type?: string | null
    endDate?: string | null
    numberOfOccurrences?: number | null
  } | null
}

/** Microsoft Graph `event.recurrence` → UI-Modell (absolute Patterns). */
export function parseMicrosoftGraphRecurrence(
  raw: unknown
): CalendarSaveEventRecurrence | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as GraphPatternedRecurrence
  const pattern = rec.pattern
  const range = rec.range
  if (!pattern?.type) return null

  let frequency: CalendarSaveEventRecurrence['frequency']
  const interval = pattern.interval ?? 1
  switch (pattern.type) {
    case 'daily':
      frequency = 'daily'
      break
    case 'weekly':
      frequency = interval >= 2 ? 'biweekly' : 'weekly'
      break
    case 'absoluteMonthly':
      frequency = 'monthly'
      break
    case 'absoluteYearly':
      frequency = 'yearly'
      break
    default:
      return null
  }

  let rangeEnd: CalendarSaveEventRecurrence['rangeEnd'] = 'never'
  let untilDate: string | null | undefined
  let count: number | null | undefined
  switch (range?.type) {
    case 'endDate': {
      const ed = range.endDate?.trim()
      if (ed && /^\d{4}-\d{2}-\d{2}$/.test(ed) && !ed.startsWith('0001-')) {
        rangeEnd = 'until'
        untilDate = ed
      }
      break
    }
    case 'numbered': {
      const n = range.numberOfOccurrences
      if (n != null && Number.isFinite(n) && n >= 1 && n <= 999) {
        rangeEnd = 'count'
        count = Math.floor(n)
      }
      break
    }
    default:
      rangeEnd = 'never'
  }

  const weekdays = (pattern.daysOfWeek ?? [])
    .map((d) => (typeof d === 'string' ? d.toLowerCase() : ''))
    .filter((d): d is (typeof GRAPH_DOW)[number] => (GRAPH_DOW as readonly string[]).includes(d))

  return {
    frequency,
    rangeEnd,
    ...(weekdays.length > 0 ? { weekdays: Array.from(new Set(weekdays)) } : {}),
    ...(rangeEnd === 'until' ? { untilDate } : {}),
    ...(rangeEnd === 'count' ? { count } : {})
  }
}

const GOOGLE_BYDAY_TO_DOW: Record<string, (typeof GRAPH_DOW)[number]> = {
  MO: 'monday',
  TU: 'tuesday',
  WE: 'wednesday',
  TH: 'thursday',
  FR: 'friday',
  SA: 'saturday',
  SU: 'sunday'
}

/** Google `event.recurrence` (RRULE-Zeilen) → UI-Modell. */
export function parseGoogleEventRecurrence(
  lines: string[] | null | undefined
): CalendarSaveEventRecurrence | null {
  if (!lines?.length) return null
  const rruleLine = lines.find((l) => /^RRULE:/i.test(l.trim()))
  if (!rruleLine) return null
  const body = rruleLine.replace(/^RRULE:/i, '').trim()
  const parts = new Map<string, string>()
  for (const piece of body.split(';')) {
    const eq = piece.indexOf('=')
    if (eq <= 0) continue
    parts.set(piece.slice(0, eq).toUpperCase(), piece.slice(eq + 1))
  }
  const freq = (parts.get('FREQ') ?? '').toUpperCase()
  const interval = Math.max(1, parseInt(parts.get('INTERVAL') ?? '1', 10) || 1)

  let frequency: CalendarSaveEventRecurrence['frequency'] | null = null
  switch (freq) {
    case 'DAILY':
      frequency = 'daily'
      break
    case 'WEEKLY':
      frequency = interval >= 2 ? 'biweekly' : 'weekly'
      break
    case 'MONTHLY':
      frequency = 'monthly'
      break
    case 'YEARLY':
      frequency = 'yearly'
      break
    default:
      return null
  }

  const bydayRaw = parts.get('BYDAY') ?? ''
  const weekdays = bydayRaw
    .split(',')
    .map((d) => GOOGLE_BYDAY_TO_DOW[d.trim().toUpperCase().replace(/^[+-]?\d+/, '')] ?? null)
    .filter((d): d is (typeof GRAPH_DOW)[number] => d != null)

  let rangeEnd: CalendarSaveEventRecurrence['rangeEnd'] = 'never'
  let untilDate: string | null | undefined
  let count: number | null | undefined
  const countRaw = parts.get('COUNT')
  if (countRaw) {
    const n = parseInt(countRaw, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 999) {
      rangeEnd = 'count'
      count = n
    }
  } else {
    const untilRaw = parts.get('UNTIL')?.trim()
    if (untilRaw) {
      // YYYYMMDD or YYYYMMDDTHHMMSSZ
      const ymd = untilRaw.slice(0, 8)
      if (/^\d{8}$/.test(ymd)) {
        rangeEnd = 'until'
        untilDate = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
      }
    }
  }

  return {
    frequency,
    rangeEnd,
    ...(weekdays.length > 0 ? { weekdays: Array.from(new Set(weekdays)) } : {}),
    ...(rangeEnd === 'until' ? { untilDate } : {}),
    ...(rangeEnd === 'count' ? { count } : {})
  }
}
