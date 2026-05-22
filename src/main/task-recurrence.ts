import { calendarZonedPartsFromDateOnly } from '@shared/calendar-datetime'
import type { CalendarZonedParts } from '@shared/calendar-datetime'
import type { TaskSaveRecurrence } from '@shared/types'
import { buildMicrosoftGraphRecurrencePayload } from './calendar-recurrence'

const GRAPH_DOW = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const

interface GraphRecurrencePattern {
  type?: string | null
  interval?: number | null
  daysOfWeek?: string[] | null
}

interface GraphRecurrenceRange {
  type?: string | null
  endDate?: string | null
  numberOfOccurrences?: number | null
}

interface GraphPatternedRecurrence {
  pattern?: GraphRecurrencePattern | null
  range?: GraphRecurrenceRange | null
}

/** Fälligkeitsdatum als Serien-Start (Kalendertag in App-Zeitzone). */
export function taskStartLocalFromDueIso(dueIso: string, timeZone: string): CalendarZonedParts {
  const s = dueIso.trim()
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new Error('Wiederholende Aufgabe: gueltiges Faelligkeitsdatum (JJJJ-MM-TT) erforderlich.')
  }
  return calendarZonedPartsFromDateOnly(dateOnly, timeZone)
}

export function buildMicrosoftTodoRecurrencePayload(
  recurrence: TaskSaveRecurrence,
  dueIso: string,
  recurrenceTimeZoneWindows: string,
  calendarIanaTz: string
): { recurrence: Record<string, unknown> } {
  const startLocal = taskStartLocalFromDueIso(dueIso, calendarIanaTz)
  return buildMicrosoftGraphRecurrencePayload(recurrence, startLocal, recurrenceTimeZoneWindows)
}

/** Microsoft Graph `todoTask.recurrence` → provider-neutrales Modell. */
export function parseGraphTodoRecurrence(raw: unknown): TaskSaveRecurrence | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as GraphPatternedRecurrence
  const pattern = rec.pattern
  const range = rec.range
  if (!pattern?.type) return null

  let frequency: TaskSaveRecurrence['frequency']
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

  let rangeEnd: TaskSaveRecurrence['rangeEnd'] = 'never'
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
    .map((d) => d?.toLowerCase?.() ?? '')
    .filter((d): d is (typeof GRAPH_DOW)[number] => (GRAPH_DOW as readonly string[]).includes(d))

  return {
    frequency,
    rangeEnd,
    ...(weekdays.length > 0 ? { weekdays: Array.from(new Set(weekdays)) } : {}),
    ...(rangeEnd === 'until' ? { untilDate } : {}),
    ...(rangeEnd === 'count' ? { count } : {})
  }
}

export function serializeTaskRecurrence(recurrence: TaskSaveRecurrence | null | undefined): string | null {
  if (!recurrence) return null
  return JSON.stringify(recurrence)
}

export function deserializeTaskRecurrence(json: string | null | undefined): TaskSaveRecurrence | null {
  if (!json?.trim()) return null
  try {
    const parsed = JSON.parse(json) as TaskSaveRecurrence
    if (!parsed?.frequency || !parsed?.rangeEnd) return null
    return parsed
  } catch {
    return null
  }
}
