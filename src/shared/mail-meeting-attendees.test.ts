import { describe, expect, it } from 'vitest'
import {
  formatMeetingAttendeesForComposeInput,
  meetingAttendeesFromMailParticipants
} from './mail-meeting-attendees'

describe('meetingAttendeesFromMailParticipants', () => {
  it('sammelt Absender und Empfaenger ohne eigenes Konto', () => {
    const attendees = meetingAttendeesFromMailParticipants(
      {
        fromName: 'Judith',
        fromAddr: 'judith@firma.de',
        toAddrs: 'kurt@firma.de, Team <team@firma.de>',
        ccAddrs: 'cc@extern.com'
      },
      ['kurt@firma.de']
    )
    expect(attendees.map((a) => a.address)).toEqual([
      'judith@firma.de',
      'team@firma.de',
      'cc@extern.com'
    ])
    expect(formatMeetingAttendeesForComposeInput(attendees)).toContain('Judith <judith@firma.de>')
  })
})
