import { describe, expect, it } from 'vitest'
import {
  calendarEventLooksLikeMeeting,
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
