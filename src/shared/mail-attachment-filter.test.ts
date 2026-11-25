import { describe, expect, it } from 'vitest'
import { isRealMailAttachment } from './mail-attachment-filter'

describe('isRealMailAttachment', () => {
  it('excludes inline images', () => {
    expect(
      isRealMailAttachment({
        isInline: true,
        size: 10_000,
        contentType: 'image/png',
        name: 'logo.png'
      })
    ).toBe(false)
  })

  it('includes inline non-image documents (Graph/Outlook quirk)', () => {
    expect(
      isRealMailAttachment({
        isInline: true,
        size: 50_000,
        contentType: 'application/pdf',
        name: 'Honorarnote.pdf'
      })
    ).toBe(true)
  })

  it('excludes tiny non-inline', () => {
    expect(
      isRealMailAttachment({ isInline: false, size: 100, contentType: 'application/octet-stream', name: 'x.bin' })
    ).toBe(false)
  })

  it('includes normal attachment', () => {
    expect(
      isRealMailAttachment({
        isInline: false,
        size: 1024,
        contentType: 'application/pdf',
        name: 'a.pdf'
      })
    ).toBe(true)
  })
})
