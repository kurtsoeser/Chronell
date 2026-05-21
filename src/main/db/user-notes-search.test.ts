import { describe, expect, it } from 'vitest'
import { normalizeFtsMatchQuery as normalizeMessagesFtsMatchQuery } from '@shared/search-token-query'

describe('notes FTS query', () => {
  it('requires at least two characters per token', () => {
    expect(normalizeMessagesFtsMatchQuery('a')).toBeNull()
    expect(normalizeMessagesFtsMatchQuery('ab')).toBe('ab*')
    expect(normalizeMessagesFtsMatchQuery('foo bar')).toBe('foo* bar*')
  })
})
