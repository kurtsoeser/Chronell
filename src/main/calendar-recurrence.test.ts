import { describe, expect, it } from 'vitest'
import {
  parseGoogleEventRecurrence,
  parseMicrosoftGraphRecurrence
} from './calendar-recurrence'

describe('parseMicrosoftGraphRecurrence', () => {
  it('parst weekly + endDate', () => {
    expect(
      parseMicrosoftGraphRecurrence({
        pattern: { type: 'weekly', interval: 1, daysOfWeek: ['monday', 'wednesday'] },
        range: { type: 'endDate', endDate: '2026-12-31' }
      })
    ).toEqual({
      frequency: 'weekly',
      rangeEnd: 'until',
      weekdays: ['monday', 'wednesday'],
      untilDate: '2026-12-31'
    })
  })

  it('parst biweekly + count', () => {
    expect(
      parseMicrosoftGraphRecurrence({
        pattern: { type: 'weekly', interval: 2, daysOfWeek: ['friday'] },
        range: { type: 'numbered', numberOfOccurrences: 8 }
      })
    ).toEqual({
      frequency: 'biweekly',
      rangeEnd: 'count',
      weekdays: ['friday'],
      count: 8
    })
  })

  it('lehnt relativeMonthly ab', () => {
    expect(
      parseMicrosoftGraphRecurrence({
        pattern: { type: 'relativeMonthly', interval: 1 },
        range: { type: 'noEnd' }
      })
    ).toBeNull()
  })
})

describe('parseGoogleEventRecurrence', () => {
  it('parst RRULE weekly UNTIL', () => {
    expect(parseGoogleEventRecurrence(['RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;UNTIL=20261231'])).toEqual({
      frequency: 'weekly',
      rangeEnd: 'until',
      weekdays: ['monday', 'wednesday'],
      untilDate: '2026-12-31'
    })
  })

  it('parst biweekly COUNT', () => {
    expect(parseGoogleEventRecurrence(['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;COUNT=10'])).toEqual({
      frequency: 'biweekly',
      rangeEnd: 'count',
      weekdays: ['friday'],
      count: 10
    })
  })
})
