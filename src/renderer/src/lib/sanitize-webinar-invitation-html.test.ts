/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { buildWebinarInvitationHtml } from './build-webinar-invitation-html'
import { parseWebinarInvitationHtml } from './parse-webinar-invitation-html'
import { sanitizeMailHtml } from './sanitize'
import {
  restoreWebinarExternalHrefs,
  sanitizeWebinarInvitationHtml
} from './sanitize-webinar-invitation-html'

describe('sanitizeWebinarInvitationHtml links', () => {
  it('behaelt echte https-hrefs auch nach vorherigem Mail-Sanitize', () => {
    // Installiert frueher den globalen Hook dauerhaft — darf Webinar nicht mehr treffen.
    void sanitizeMailHtml('<a href="https://example.com">x</a>', { loadImages: true })

    const html = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: 'https://forms.office.com/r/abc',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://www.kurtrocks.com/event',
      websiteLabel: 'Seite',
      scheduleLabel: null
    })
    const out = sanitizeWebinarInvitationHtml(html)
    expect(out).toContain('href="https://forms.office.com/r/abc"')
    expect(out).toContain('href="https://www.kurtrocks.com/event"')
    expect(out).not.toMatch(/bgcolor="#234832"[\s\S]*?href="#"/i)

    const parsed = parseWebinarInvitationHtml(out)
    expect(parsed.surveyUrl).toBe('https://forms.office.com/r/abc')
    expect(parsed.websiteUrl).toBe('https://www.kurtrocks.com/event')
  })

  it('stellt data-mail-external wieder zu href her', () => {
    const broken =
      '<a href="#" data-mail-external="https://forms.office.com/r/abc"><span>Umfrage</span></a>'
    expect(restoreWebinarExternalHrefs(broken)).toContain(
      'href="https://forms.office.com/r/abc"'
    )
    expect(restoreWebinarExternalHrefs(broken)).not.toContain('data-mail-external')
  })
})
