import { describe, expect, it } from 'vitest'
import { toKurtrocksPublicSiteUrl } from './notion-kurtrocks-public-url'

describe('toKurtrocksPublicSiteUrl', () => {
  it('keeps kurtrocks.com and normalizes www', () => {
    expect(toKurtrocksPublicSiteUrl('https://kurtrocks.com/event-abc')).toBe(
      'https://www.kurtrocks.com/event-abc'
    )
    expect(toKurtrocksPublicSiteUrl('https://www.kurtrocks.com/foo')).toBe(
      'https://www.kurtrocks.com/foo'
    )
  })

  it('rewrites notion.site public_url to kurtrocks custom domain', () => {
    expect(
      toKurtrocksPublicSiteUrl('https://kurtrocks.notion.site/Webinar-PH-OOE-abc123')
    ).toBe('https://www.kurtrocks.com/Webinar-PH-OOE-abc123')
  })

  it('does not use unrelated URLs (e.g. Veranstaltungslink)', () => {
    expect(
      toKurtrocksPublicSiteUrl('https://www.ph-online.ac.at/ph-ooe/wbLv.wbShowLVDetail?p=1')
    ).toBeNull()
    expect(toKurtrocksPublicSiteUrl(null)).toBeNull()
  })
})
