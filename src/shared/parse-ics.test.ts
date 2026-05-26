import { describe, expect, it } from 'vitest'
import { parseIcsCalendarText, parseIcsDateValue } from './parse-ics'

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-uid-1
SUMMARY:Get Started with Microsoft 365 Copilot
DTSTART:20260624T090000Z
DTEND:20260624T100000Z
DESCRIPTION:Join on Microsoft Teams
END:VEVENT
END:VCALENDAR`

describe('parseIcsDateValue', () => {
  it('parses UTC date-time', () => {
    const r = parseIcsDateValue('20260624T090000Z', {})
    expect(r.isAllDay).toBe(false)
    expect(r.iso).toBe('2026-06-24T09:00:00.000Z')
  })

  it('parses all-day DATE', () => {
    const r = parseIcsDateValue('20260624', { VALUE: 'DATE' })
    expect(r.isAllDay).toBe(true)
    expect(r.iso).toBe('2026-06-24')
  })
})

describe('parseIcsCalendarText', () => {
  it('parses a single timed event', () => {
    const { events, warnings } = parseIcsCalendarText(SAMPLE_ICS)
    expect(warnings).toHaveLength(0)
    expect(events).toHaveLength(1)
    expect(events[0]!.summary).toBe('Get Started with Microsoft 365 Copilot')
    expect(events[0]!.startIso).toBe('2026-06-24T09:00:00.000Z')
    expect(events[0]!.endIso).toBe('2026-06-24T10:00:00.000Z')
    expect(events[0]!.isAllDay).toBe(false)
    expect(events[0]!.descriptionPlain).toContain('Teams')
  })

  it('parses all-day with exclusive end', () => {
    const text = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Urlaub
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260705
END:VEVENT
END:VCALENDAR`
    const { events } = parseIcsCalendarText(text)
    expect(events[0]!.isAllDay).toBe(true)
    expect(events[0]!.startIso).toBe('2026-07-01')
    expect(events[0]!.endIso).toBe('2026-07-05')
  })
})
