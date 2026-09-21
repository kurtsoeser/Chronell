import { describe, expect, it } from 'vitest'
import { parseMailMessageIdFromContextKey } from './parse-mail-context-key'

describe('parseMailMessageIdFromContextKey', () => {
  it('parses mail ids', () => {
    expect(parseMailMessageIdFromContextKey('mail:42')).toBe(42)
    expect(parseMailMessageIdFromContextKey(' mail:7 ')).toBe(7)
  })

  it('rejects non-mail keys', () => {
    expect(parseMailMessageIdFromContextKey('cal:ms:x:1')).toBeNull()
    expect(parseMailMessageIdFromContextKey('mail:abc')).toBeNull()
    expect(parseMailMessageIdFromContextKey('')).toBeNull()
  })
})
