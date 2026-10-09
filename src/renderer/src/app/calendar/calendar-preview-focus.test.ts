import { describe, expect, it } from 'vitest'
import type { CalendarEventView } from '@shared/types'
import { calendarEventStableKey } from '@shared/work-item-keys'
import { previewStableKeyFromCalendarEvent } from '@/app/calendar/calendar-preview-focus'

describe('previewStableKeyFromCalendarEvent', () => {
  it('stimmt mit work-item-mapper-Schlüssel überein', () => {
    const ev = {
      accountId: 'acc-1',
      graphCalendarId: 'cal-1',
      graphEventId: 'evt-9',
      id: 'evt-9'
    } as CalendarEventView
    expect(previewStableKeyFromCalendarEvent(ev)).toBe(
      calendarEventStableKey('acc-1', 'cal-1', 'evt-9')
    )
  })
})
