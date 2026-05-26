import { describe, expect, it } from 'vitest'

import type { CalendarEventView } from '@shared/types'
import type { WorkItem } from '@shared/work-item'

import { calendarEventToWorkItem } from '@/app/work-items/work-item-mapper'

import { megaItemTimeDisplay, megaItemTimeLabel } from '@/app/mega/mega-timeline-label'

function timedEvent(startIso: string, endIso: string): WorkItem {
  const ev: CalendarEventView = {
    id: 'ev-1',
    source: 'microsoft',
    accountId: 'acc-1',
    accountEmail: 'u@test.de',
    accountColorClass: 'blue',
    graphCalendarId: 'cal-1',
    graphEventId: 'ev-1',
    title: 'Meeting',
    startIso,
    endIso,
    isAllDay: false,
    location: null,
    webLink: null,
    joinUrl: null,
    organizer: null
  }
  return calendarEventToWorkItem(ev)
}

describe('megaItemTimeDisplay', () => {
  it('stacks start and end for timed calendar events', () => {
    const item = timedEvent('2026-05-26T16:00:00', '2026-05-26T17:00:00')
    expect(megaItemTimeDisplay(item, 'de')).toEqual({
      variant: 'range',
      start: '16:00',
      end: '17:00'
    })
  })

  it('uses single label when start equals end', () => {
    const item = timedEvent('2026-05-26T16:00:00', '2026-05-26T16:00:00')
    expect(megaItemTimeDisplay(item, 'de')).toEqual({ variant: 'label', text: '16:00' })
  })

  it('megaItemTimeLabel keeps flat range string', () => {
    const item = timedEvent('2026-05-26T16:00:00', '2026-05-26T17:00:00')
    expect(megaItemTimeLabel(item, 'de')).toBe('16:00 – 17:00')
  })
})
