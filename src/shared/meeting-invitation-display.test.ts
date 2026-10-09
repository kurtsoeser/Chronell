import { describe, expect, it } from 'vitest'
import {
  displayMeetingSummary,
  meetingInvitationIntroKey,
  meetingInvitationNeedsRsvp,
  shouldHideMeetingInvitationPanel
} from './meeting-invitation-display'
import type { MeetingInvitationView } from './types'

function baseInvitation(overrides: Partial<MeetingInvitationView> = {}): MeetingInvitationView {
  return {
    uid: 'u1',
    method: 'REQUEST',
    sequence: 0,
    status: null,
    summary: 'Team Sync',
    startIso: '2026-11-03T13:00:00.000Z',
    endIso: '2026-11-03T15:00:00.000Z',
    isAllDay: false,
    location: null,
    descriptionPlain: null,
    bodyHtml: null,
    organizer: { email: 'org@example.com', name: 'Org' },
    attendees: [],
    joinUrl: null,
    selfPartStat: null,
    isCancelled: false,
    canRespond: true,
    respondUnsupportedReason: null,
    allowNewTimeProposals: true,
    selfProposedStartIso: null,
    selfProposedEndIso: null,
    isOrganizer: false,
    canReschedule: false,
    rescheduleUnsupportedReason: null,
    ...overrides
  }
}

describe('displayMeetingSummary', () => {
  it('strips German accepted prefix', () => {
    expect(displayMeetingSummary('Zugesagt: Webinar Copilot')).toBe('Webinar Copilot')
  })

  it('strips English declined prefix', () => {
    expect(displayMeetingSummary('Declined: Standup')).toBe('Standup')
  })

  it('keeps title without prefix', () => {
    expect(displayMeetingSummary('Webinar Copilot')).toBe('Webinar Copilot')
  })
})

describe('meetingInvitationIntroKey', () => {
  it('uses organizer intro for organizer', () => {
    expect(meetingInvitationIntroKey(baseInvitation({ isOrganizer: true }))).toBe('introOrganizer')
  })

  it('uses update intro when RSVP closed', () => {
    expect(
      meetingInvitationIntroKey(baseInvitation({ canRespond: false, selfPartStat: 'accepted' }))
    ).toBe('introUpdate')
  })
})

describe('meetingInvitationNeedsRsvp', () => {
  it('is true for open invite', () => {
    expect(meetingInvitationNeedsRsvp(baseInvitation())).toBe(true)
  })

  it('is false when already accepted', () => {
    expect(meetingInvitationNeedsRsvp(baseInvitation({ selfPartStat: 'accepted' }))).toBe(false)
  })

  it('is false for organizer', () => {
    expect(meetingInvitationNeedsRsvp(baseInvitation({ isOrganizer: true }))).toBe(false)
  })

  it('is false when summary has response prefix', () => {
    expect(
      meetingInvitationNeedsRsvp(
        baseInvitation({ summary: 'Zugesagt: Webinar', canRespond: true, selfPartStat: null })
      )
    ).toBe(false)
  })
})

describe('shouldHideMeetingInvitationPanel', () => {
  it('hides compact status on short body without join', () => {
    expect(
      shouldHideMeetingInvitationPanel(
        baseInvitation({
          summary: 'Zugesagt: Sync',
          canRespond: false,
          selfPartStat: 'accepted'
        }),
        120
      )
    ).toBe(true)
  })

  it('keeps panel when RSVP needed', () => {
    expect(shouldHideMeetingInvitationPanel(baseInvitation(), 50)).toBe(false)
  })
})
