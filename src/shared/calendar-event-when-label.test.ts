import { describe, expect, it } from 'vitest'
import { formatCalendarEventWhenLabel, formatDueIsoWhenLabel } from './calendar-datetime'

describe('formatCalendarEventWhenLabel', () => {
  it('formats timed events in de with calendar timezone', () => {
    const label = formatCalendarEventWhenLabel(
      '2026-05-20T10:30:00.000Z',
      'Europe/Vienna',
      'de',
      false
    )
    expect(label).toBe('20.05.2026 12:30')
  })

  it('formats all-day events without time', () => {
    const label = formatCalendarEventWhenLabel(
      '2026-05-20T10:30:00.000Z',
      'Europe/Vienna',
      'de',
      true
    )
    expect(label).toBe('20.05.2026')
  })
})

describe('formatDueIsoWhenLabel', () => {
  it('formats date-only due in de', () => {
    expect(formatDueIsoWhenLabel('2026-06-29', 'Europe/Vienna', 'de')).toBe('29.06.2026')
  })
})
