import { describe, expect, it, vi } from 'vitest'

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string): string => html
  }
}))

import { buildWebinarInvitationHtml } from '@/lib/build-webinar-invitation-html'
import { resolveWebinarDescriptionForSave } from '@/lib/prepare-webinar-invitation-save'

describe('resolveWebinarDescriptionForSave', () => {
  it('prefers restored state html over gutted iframe flush', () => {
    const restored = buildWebinarInvitationHtml({
      title: 'Volles Layout',
      heroImageSrc: 'data:image/png;base64,abc',
      surveyUrl: 'https://forms.office.com/example',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://example.com',
      websiteLabel: 'Website',
      scheduleLabel: 'Mo 1.1.2026',
      teamsJoinUrl: 'https://teams.microsoft.com/l/meetup-join/example'
    })
    const guttedFlush = [
      '<p>Microsoft Teams-Besprechung beitreten</p>',
      '<p><a href="https://teams.microsoft.com/l/meetup-join/example">Join</a></p>'
    ].join('')

    expect(
      resolveWebinarDescriptionForSave(guttedFlush, restored, {
        chronellWebinarInvitation: true
      })
    ).toBe(restored)
  })
})
