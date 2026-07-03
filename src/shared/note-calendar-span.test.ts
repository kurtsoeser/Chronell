import { describe, expect, it } from 'vitest'
import { resolveNoteCalendarSpan, resolveNoteCalendarSpanForMode } from './note-calendar-span'

describe('resolveNoteCalendarSpanForMode', () => {
  const base = {
    createdAt: '2026-07-02T14:30:00.000Z',
    scheduledStartIso: '2026-08-15T09:00:00.000Z',
    scheduledEndIso: '2026-08-15T10:00:00.000Z',
    scheduledAllDay: false
  }

  it('created: Ganztag am Erstellungsdatum', () => {
    const span = resolveNoteCalendarSpanForMode(base, 'created')
    expect(span).toEqual({
      allDay: true,
      startIso: '2026-07-02',
      endIso: '2026-07-03'
    })
  })

  it('scheduled: zeitgebundene Planung', () => {
    const span = resolveNoteCalendarSpanForMode(base, 'scheduled')
    expect(span).toEqual({
      allDay: false,
      startIso: '2026-08-15T09:00:00.000Z',
      endIso: '2026-08-15T10:00:00.000Z'
    })
  })

  it('scheduled: null ohne Planung', () => {
    expect(
      resolveNoteCalendarSpanForMode(
        { ...base, scheduledStartIso: null, scheduledEndIso: null },
        'scheduled'
      )
    ).toBeNull()
  })

  it('created: auch ohne Planung', () => {
    expect(
      resolveNoteCalendarSpanForMode(
        { ...base, scheduledStartIso: null, scheduledEndIso: null },
        'created'
      )
    ).not.toBeNull()
  })
})

describe('resolveNoteCalendarSpan', () => {
  it('bleibt Planungs-only', () => {
    expect(
      resolveNoteCalendarSpan({
        scheduledStartIso: null,
        scheduledEndIso: null,
        scheduledAllDay: false
      })
    ).toBeNull()
  })
})
