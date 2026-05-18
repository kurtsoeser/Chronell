import { describe, expect, it } from 'vitest'
import {
  inferBusinessBookingPageUrlFromServiceWebUrl,
  resolveBookingsPublicUrl
} from './bookings-public-url'

describe('bookings-public-url', () => {
  it('infers business page from service webUrl', () => {
    const url =
      'https://outlook.office365.com/owa/calendar/team@contoso.com/bookings/s/abc123'
    expect(inferBusinessBookingPageUrlFromServiceWebUrl(url)).toBe(
      'https://outlook.office365.com/owa/calendar/team@contoso.com/bookings'
    )
  })

  it('prefers graph publicUrl', () => {
    const r = resolveBookingsPublicUrl({
      publicUrl: 'https://book.example/page',
      serviceWebUrls: ['https://outlook.office365.com/owa/calendar/a@b.com/bookings/s/x']
    })
    expect(r.source).toBe('graph')
    expect(r.url).toBe('https://book.example/page')
  })
})
