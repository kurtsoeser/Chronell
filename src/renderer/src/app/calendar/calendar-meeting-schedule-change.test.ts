import { describe, expect, it } from 'vitest'
import {
  calendarEventDialogLooksLikeMeeting,
  calendarEventLooksLikeMeeting,
  calendarEventScheduleChanged,
  patchScheduleInputWithMeetingNotify
} from '@/app/calendar/calendar-meeting-schedule-change'
import type { CalendarEventView } from '@shared/types'

function sampleEvent(over: Partial<CalendarEventView> = {}): CalendarEventView {
  return {
    id: 'acc:ev1',
    source: 'microsoft',
    accountId: 'acc',
    accountEmail: 'a@example.com',
    accountColorClass: 'bg-blue-500',
    graphEventId: 'ev1',
    title: 'Meeting',
    startIso: '2026-05-20T10:00:00.000Z',
    endIso: '2026-05-20T11:00:00.000Z',
    isAllDay: false,
    location: null,
    webLink: null,
    joinUrl: null,
    organizer: null,
    ...over
  }
}

describe('calendarEventLooksLikeMeeting', () => {
  it('erkennt Teilnehmer aus Event-Details', () => {
    expect(
      calendarEventLooksLikeMeeting(sampleEvent(), {
        subject: 'Meeting',
        attendeeEmails: ['guest@example.com'],
        joinUrl: null,
        isOnlineMeeting: false,
        bodyHtml: null
      })
    ).toBe(true)
  })

  it('erkennt Teams-Besprechungen ohne geladene Teilnehmerliste', () => {
    expect(
      calendarEventLooksLikeMeeting(
        sampleEvent({ joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' }),
        null
      )
    ).toBe(true)
  })

  it('ignoriert private Termine ohne Teilnehmer', () => {
    expect(
      calendarEventLooksLikeMeeting(sampleEvent(), {
        subject: 'Block',
        attendeeEmails: [],
        joinUrl: null,
        isOnlineMeeting: false,
        bodyHtml: null
      })
    ).toBe(false)
  })
})

describe('calendarEventScheduleChanged', () => {
  it('erkennt geaenderte Startzeit', () => {
    expect(
      calendarEventScheduleChanged(
        {
          startIso: '2026-05-20T10:00:00.000Z',
          endIso: '2026-05-20T11:00:00.000Z',
          isAllDay: false
        },
        {
          startIso: '2026-05-20T11:00:00.000Z',
          endIso: '2026-05-20T12:00:00.000Z',
          isAllDay: false
        }
      )
    ).toBe(true)
  })

  it('ignoriert identische Zeit trotz anderer ISO-Darstellung', () => {
    expect(
      calendarEventScheduleChanged(
        {
          startIso: '2026-05-20T10:00:00.000Z',
          endIso: '2026-05-20T11:00:00.000Z',
          isAllDay: false
        },
        {
          startIso: '2026-05-20T10:00:00+00:00',
          endIso: '2026-05-20T11:00:00+00:00',
          isAllDay: false
        }
      )
    ).toBe(false)
  })

  it('vergleicht Ganztagstermine nur nach Datum', () => {
    expect(
      calendarEventScheduleChanged(
        { startIso: '2026-05-20', endIso: '2026-05-21', isAllDay: true },
        { startIso: '2026-05-20T00:00:00.000Z', endIso: '2026-05-21T00:00:00.000Z', isAllDay: true }
      )
    ).toBe(false)
    expect(
      calendarEventScheduleChanged(
        { startIso: '2026-05-20', endIso: '2026-05-21', isAllDay: true },
        { startIso: '2026-05-21', endIso: '2026-05-22', isAllDay: true }
      )
    ).toBe(true)
  })
})

describe('calendarEventDialogLooksLikeMeeting', () => {
  it('erkennt Teilnehmer, Teams und Join-URL', () => {
    expect(
      calendarEventDialogLooksLikeMeeting({
        attendeeEmails: ['a@b.c'],
        teamsMeeting: false
      })
    ).toBe(true)
    expect(
      calendarEventDialogLooksLikeMeeting({
        attendeeEmails: [],
        teamsMeeting: true
      })
    ).toBe(true)
    expect(
      calendarEventDialogLooksLikeMeeting({
        attendeeEmails: [],
        teamsMeeting: false,
        joinUrl: 'https://teams.microsoft.com/x'
      })
    ).toBe(true)
    expect(
      calendarEventDialogLooksLikeMeeting({
        attendeeEmails: [],
        teamsMeeting: false
      })
    ).toBe(false)
  })
})

describe('patchScheduleInputWithMeetingNotify', () => {
  it('setzt notifyAttendees nur bei expliziter Bestaetigung', () => {
    const base = {
      accountId: 'acc',
      graphEventId: 'ev1',
      startIso: '2026-05-20T10:00:00.000Z',
      endIso: '2026-05-20T11:00:00.000Z',
      isAllDay: false
    }
    expect(patchScheduleInputWithMeetingNotify(base, false)).toEqual(base)
    expect(patchScheduleInputWithMeetingNotify(base, true)).toEqual({
      ...base,
      notifyAttendees: true
    })
  })
})
