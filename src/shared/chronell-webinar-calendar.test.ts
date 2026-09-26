import { describe, expect, it } from 'vitest'
import {
  formatChronellWebinarDraftAttendees,
  formatChronellWebinarInvitationFlag,
  parseChronellWebinarDraftAttendees,
  parseChronellWebinarInvitationFlag
} from './chronell-webinar-calendar'

describe('chronell-webinar-calendar', () => {
  it('parses Graph extended property flag', () => {
    expect(parseChronellWebinarInvitationFlag('true')).toBe(true)
    expect(parseChronellWebinarInvitationFlag('TRUE')).toBe(true)
    expect(parseChronellWebinarInvitationFlag('false')).toBe(false)
    expect(parseChronellWebinarInvitationFlag(null)).toBe(false)
    expect(parseChronellWebinarInvitationFlag(undefined)).toBe(false)
  })

  it('formats Graph extended property flag', () => {
    expect(formatChronellWebinarInvitationFlag(true)).toBe('true')
    expect(formatChronellWebinarInvitationFlag(false)).toBe('false')
  })

  it('roundtrips draft attendee JSON', () => {
    const json = formatChronellWebinarDraftAttendees({
      required: ['A@Example.com', 'b@test.org'],
      optional: ['opt@x.org']
    })
    expect(parseChronellWebinarDraftAttendees(json)).toEqual({
      required: ['a@example.com', 'b@test.org'],
      optional: ['opt@x.org']
    })
    expect(formatChronellWebinarDraftAttendees(null)).toBe('')
    expect(parseChronellWebinarDraftAttendees('')).toBeNull()
  })
})
