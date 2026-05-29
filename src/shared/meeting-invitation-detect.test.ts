import { describe, expect, it } from 'vitest'
import { looksLikeMeetingInvitationMail } from './meeting-invitation-detect'

describe('looksLikeMeetingInvitationMail', () => {
  it('detects Microsoft Teams meeting footer', () => {
    expect(
      looksLikeMeetingInvitationMail({
        subject: 'Team Sync',
        bodyHtml:
          '<p>Microsoft Teams-Besprechung</p><a href="https://teams.microsoft.com/meet/abc">Join</a>'
      })
    ).toBe(true)
  })

  it('ignores regular mail without meeting markers', () => {
    expect(
      looksLikeMeetingInvitationMail({
        subject: 'Quarterly report',
        bodyText: 'Please review the attached PDF.'
      })
    ).toBe(false)
  })
})
