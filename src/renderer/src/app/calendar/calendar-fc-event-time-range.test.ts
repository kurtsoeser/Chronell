/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { formatFcEventTimeRangeText } from './calendar-fc-event-time-range'

describe('formatFcEventTimeRangeText', () => {
  it('formatiert Start und Ende als HH:mm - HH:mm', () => {
    const text = formatFcEventTimeRangeText({
      event: {
        allDay: false,
        start: new Date(2026, 5, 20, 9, 30),
        end: new Date(2026, 5, 20, 10, 15)
      },
      timeText: '09 Uhr'
    } as never)
    expect(text).toBe('09:30 - 10:15')
  })

  it('liefert null bei Ganztag', () => {
    expect(
      formatFcEventTimeRangeText({
        event: { allDay: true, start: new Date(2026, 5, 20) },
        timeText: ''
      } as never)
    ).toBeNull()
  })
})
