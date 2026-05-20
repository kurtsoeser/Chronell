import { describe, expect, it } from 'vitest'
import { deduplicateCalendarEventsByGraphEventId } from '@/app/calendar/calendar-graph-events'
import type { CalendarEventView } from '@shared/types'

function ev(partial: Partial<CalendarEventView> & Pick<CalendarEventView, 'id'>): CalendarEventView {
  return {
    source: 'microsoft',
    accountId: 'acc',
    accountEmail: 'a@b.c',
    accountColorClass: 'blue',
    graphEventId: partial.graphEventId ?? partial.id.split(':')[1] ?? partial.id,
    title: 'T',
    startIso: '2026-05-20T11:00:00.000Z',
    endIso: '2026-05-20T12:00:00.000Z',
    isAllDay: false,
    ...partial
  }
}

describe('deduplicateCalendarEventsByGraphEventId', () => {
  it('behält nur einen Eintrag pro graphEventId', () => {
    const oldRow = ev({
      id: 'acc:ev1',
      startIso: '2026-05-20T11:00:00.000Z',
      endIso: '2026-05-20T12:00:00.000Z'
    })
    const newRow = ev({
      id: 'acc:ev1',
      startIso: '2026-05-20T12:00:00.000Z',
      endIso: '2026-05-20T13:00:00.000Z'
    })
    const result = deduplicateCalendarEventsByGraphEventId([oldRow, newRow])
    expect(result).toHaveLength(1)
    expect(result[0]?.startIso).toBe('2026-05-20T12:00:00.000Z')
  })
})
