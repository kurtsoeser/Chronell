import { describe, expect, it } from 'vitest'
import { isRealMailAttachment } from './mail-attachment-filter'

describe('isRealMailAttachment', () => {
  it('excludes inline', () => {
    expect(isRealMailAttachment({ isInline: true, size: 10_000 })).toBe(false)
  })

  it('excludes tiny non-inline', () => {
    expect(isRealMailAttachment({ isInline: false, size: 100 })).toBe(false)
  })

  it('includes normal attachment', () => {
    expect(isRealMailAttachment({ isInline: false, size: 1024 })).toBe(true)
  })
})
