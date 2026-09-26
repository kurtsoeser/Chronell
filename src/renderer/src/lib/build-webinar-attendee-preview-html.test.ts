import { describe, expect, it, vi } from 'vitest'

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string): string => html
  }
}))

import { buildWebinarAttendeePreviewHtml, isWebinarInvitationHtmlLikelyGutted } from '@/lib/build-webinar-attendee-preview-html'
import { buildWebinarInvitationHtml } from '@/lib/build-webinar-invitation-html'
import { injectTeamsMeetingBlobIntoWebinarInvitation } from '@shared/calendar-event-body-html'

describe('buildWebinarAttendeePreviewHtml', () => {
  it('merges editor slot with saved Graph teams blob', () => {
    const editor = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: 'Mo 1.1.2026',
      teamsJoinUrl: 'https://teams.microsoft.com/l/meetup-join/example'
    })
    const blob =
      '<div><p>Microsoft Teams-Besprechung</p><p><a href="https://teams.microsoft.com/l/meetup-join/example">Join</a></p></div>'
    const graph = injectTeamsMeetingBlobIntoWebinarInvitation(editor, blob)

    expect(graph).not.toContain('chronell-webinar-teams-slot')

    const preview = buildWebinarAttendeePreviewHtml(editor, graph)

    expect(preview).toContain('Microsoft Teams-Besprechung')
    expect(preview).not.toContain('chronell-webinar-teams-slot')
  })

  it('prefers editor over stale Graph when both are intact', () => {
    const editor = buildWebinarInvitationHtml({
      title: 'Editor-Titel',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: 'Mo 1.1.2026',
      teamsJoinUrl: 'https://teams.microsoft.com/l/meetup-join/example'
    })
    const graph = injectTeamsMeetingBlobIntoWebinarInvitation(
      buildWebinarInvitationHtml({
        title: 'Alter Graph-Titel',
        heroImageSrc: null,
        surveyUrl: '',
        surveyLabel: '',
        websiteUrl: '',
        websiteLabel: '',
        scheduleLabel: 'So 31.12.2025',
        teamsJoinUrl: 'https://teams.microsoft.com/l/meetup-join/example'
      }),
      '<p>Microsoft Teams-Besprechung</p>'
    )
    const preview = buildWebinarAttendeePreviewHtml(editor, graph)
    expect(preview).toContain('Editor-Titel')
    expect(preview).not.toContain('Alter Graph-Titel')
  })

  it('flags chronell webinar with gutted body', () => {
    expect(
      isWebinarInvitationHtmlLikelyGutted('<p>nur text</p>', {
        chronellWebinarInvitation: true
      })
    ).toBe(true)
  })

  it('does not flag empty html as gutted (new webinars)', () => {
    expect(
      isWebinarInvitationHtmlLikelyGutted('', {
        chronellWebinarInvitation: true
      })
    ).toBe(false)
    expect(isWebinarInvitationHtmlLikelyGutted(null, { chronellWebinarInvitation: true })).toBe(
      false
    )
  })
})
