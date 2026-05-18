import { describe, expect, it } from 'vitest'
import {
  buildSchedulingInvitationHtml,
  schedulingPlainTextToHtml
} from './scheduling-invitation'

describe('schedulingPlainTextToHtml', () => {
  it('renders standalone booking URLs as clickable links', () => {
    const url = 'https://outlook.office.com/bookwithme/user/abc123'
    const html = schedulingPlainTextToHtml(`Meeting\n\n${url}\n\nTermindauer: 30 Min.`)
    expect(html).toContain(`<a href="${url}">${url}</a>`)
  })

  it('linkifies URLs embedded in a paragraph line', () => {
    const url = 'https://example.com/book'
    const html = schedulingPlainTextToHtml(`Buchen: ${url}`)
    expect(html).toContain(`<a href="${url}">${url}</a>`)
  })
})

describe('buildSchedulingInvitationHtml', () => {
  it('renders book-with-me URL as anchor', () => {
    const url = 'https://outlook.office.com/bookwithme/user/test'
    const html = buildSchedulingInvitationHtml({
      slots: [
        {
          id: '1',
          startIso: '2026-05-22T07:00:00.000Z',
          endIso: '2026-05-22T10:00:00.000Z',
          isAllDay: false
        }
      ],
      bookWithMeUrl: url,
      durationMinutes: 30,
      locale: 'de',
      timeZone: 'Europe/Vienna',
      meetingTitle: 'Test'
    })
    expect(html).toContain(`<a href="${url}">${url}</a>`)
  })
})
