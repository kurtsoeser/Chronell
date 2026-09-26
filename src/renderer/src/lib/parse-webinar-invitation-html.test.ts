import { describe, expect, it } from 'vitest'
import { buildWebinarInvitationHtml } from './build-webinar-invitation-html'
import { isWebinarInvitationHtml, parseWebinarInvitationHtml } from './parse-webinar-invitation-html'

describe('isWebinarInvitationHtml', () => {
  it('erkennt #kurtrocks-Einladungen', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: 'https://forms.office.com/r/abc',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://www.kurtrocks.com',
      websiteLabel: 'Seite',
      scheduleLabel: 'Mo | 10:00'
    })
    expect(isWebinarInvitationHtml(html)).toBe(true)
    expect(isWebinarInvitationHtml('<p>Normaler Text</p>')).toBe(false)
  })
})

describe('parseWebinarInvitationHtml', () => {
  it('liest Titel, Links und Hero aus gespeichertem HTML', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Copilot Webinar',
      heroImageSrc: 'cid:hero@test.local',
      surveyUrl: 'https://forms.office.com/r/abc',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://www.kurtrocks.com/event',
      websiteLabel: 'Veranstaltungsseite',
      scheduleLabel: 'Mo | 10:00'
    })
    const parsed = parseWebinarInvitationHtml(html)
    expect(parsed.parsed).toBe(true)
    expect(parsed.title).toBe('Copilot Webinar')
    expect(parsed.heroImageSrc).toBe('cid:hero@test.local')
    expect(parsed.surveyUrl).toBe('https://forms.office.com/r/abc')
    expect(parsed.surveyLabel).toBe('Umfrage')
    expect(parsed.websiteUrl).toBe('https://www.kurtrocks.com/event')
    expect(parsed.websiteLabel).toBe('Veranstaltungsseite')
  })

  it('stellt Links aus data-mail-external wieder her (Mail-Sanitize)', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Copilot Webinar',
      heroImageSrc: null,
      surveyUrl: 'https://forms.office.com/r/abc',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://www.kurtrocks.com/event',
      websiteLabel: 'Veranstaltungsseite',
      scheduleLabel: null
    })
      .replace(
        /href="https:\/\/forms\.office\.com\/r\/abc"/i,
        'href="#" data-mail-external="https://forms.office.com/r/abc"'
      )
      .replace(
        /href="https:\/\/www\.kurtrocks\.com\/event"/i,
        'href="#" data-mail-external="https://www.kurtrocks.com/event"'
      )
    const parsed = parseWebinarInvitationHtml(html)
    expect(parsed.surveyUrl).toBe('https://forms.office.com/r/abc')
    expect(parsed.websiteUrl).toBe('https://www.kurtrocks.com/event')
  })
})
