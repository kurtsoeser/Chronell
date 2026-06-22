import { describe, expect, it } from 'vitest'
import {
  calendarSlotHasConflict,
  findLocalFreeSlots,
  findNextLocalFreeSlot
} from './calendar-free-slots'
import type { CalendarEventView } from './types'

function ev(startIso: string, endIso: string, id = '1'): CalendarEventView {
  return {
    id: `row-${id}`,
    accountId: 'acc',
    source: 'microsoft',
    graphEventId: id,
    graphCalendarId: null,
    accountEmail: 'me@test.com',
    accountColorClass: 'bg-violet-500',
    title: 'Busy',
    startIso,
    endIso,
    isAllDay: false,
    location: null,
    webLink: null,
    joinUrl: null,
    organizer: null,
    categories: [],
    displayColorHex: null,
    calendarCanEdit: true,
    icon: null
  }
}

describe('findLocalFreeSlots', () => {
  it('finds gap between two events on the same day', () => {
    const day = '2026-06-21'
    const events = [
      ev(`${day}T09:00:00.000Z`, `${day}T10:00:00.000Z`, 'a'),
      ev(`${day}T11:00:00.000Z`, `${day}T12:00:00.000Z`, 'b')
    ]
    const slots = findLocalFreeSlots(events, {
      durationMinutes: 60,
      rangeStartIso: `${day}T08:00:00.000Z`,
      rangeEndIso: `${day}T18:00:00.000Z`,
      workingHoursStart: 8,
      workingHoursEnd: 18,
      notBeforeIso: `${day}T10:00:00.000Z`,
      maxResults: 5
    })
    expect(slots.length).toBeGreaterThan(0)
    expect(Date.parse(slots[0]!.startIso)).toBeGreaterThanOrEqual(Date.parse(`${day}T10:00:00.000Z`))
  })

  it('detects overlap conflicts', () => {
    const day = '2026-06-21'
    const events = [ev(`${day}T10:00:00.000Z`, `${day}T11:00:00.000Z`)]
    expect(
      calendarSlotHasConflict(events, `${day}T10:30:00.000Z`, `${day}T11:30:00.000Z`)
    ).toBe(true)
    expect(
      calendarSlotHasConflict(events, `${day}T11:00:00.000Z`, `${day}T12:00:00.000Z`)
    ).toBe(false)
  })

  it('returns next free slot after busy block', () => {
    const day = '2026-06-21'
    const events = [ev(`${day}T08:00:00.000Z`, `${day}T09:30:00.000Z`)]
    const slot = findNextLocalFreeSlot(events, {
      durationMinutes: 30,
      rangeStartIso: `${day}T08:00:00.000Z`,
      rangeEndIso: `${day}T18:00:00.000Z`,
      notBeforeIso: `${day}T08:00:00.000Z`
    })
    expect(slot).not.toBeNull()
    expect(Date.parse(slot!.startIso)).toBeGreaterThanOrEqual(Date.parse(`${day}T09:30:00.000Z`))
  })
})
