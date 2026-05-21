import { describe, expect, it } from 'vitest'
import {
  buildPhraseLikeNeedle,
  buildSqlLikeTokenAndClause,
  buildSqlPhraseRankCase,
  normalizeFtsMatchQuery,
  normalizeFtsPhraseMatchQuery,
  normalizeFtsTokenOrPhraseMatchQuery,
  splitSearchTokens,
  textMatchesAllSearchTokens
} from './search-token-query'

describe('splitSearchTokens', () => {
  it('filters short tokens and normalizes', () => {
    expect(splitSearchTokens('a HAK Steyr')).toEqual(['HAK', 'Steyr'])
    expect(splitSearchTokens('foo-bar')).toEqual(['foobar'])
  })
})

describe('normalizeFtsMatchQuery', () => {
  it('builds prefix AND query', () => {
    expect(normalizeFtsMatchQuery('a')).toBeNull()
    expect(normalizeFtsMatchQuery('ab')).toBe('ab*')
    expect(normalizeFtsMatchQuery('foo bar')).toBe('foo* bar*')
    expect(normalizeFtsMatchQuery('HAK Steyr')).toBe('HAK* Steyr*')
  })
})

describe('textMatchesAllSearchTokens', () => {
  it('matches all tokens in any order across fields', () => {
    expect(textMatchesAllSearchTokens('HAK Steyr', 'Steyr Workshop in der Schule HAK')).toBe(true)
    expect(textMatchesAllSearchTokens('HAK Steyr', 'nur HAK')).toBe(false)
    expect(textMatchesAllSearchTokens('HAK Steyr', 'Steyr', 'HAK')).toBe(true)
  })
})

describe('buildSqlLikeTokenAndClause', () => {
  it('emits AND of per-token OR columns', () => {
    const params: unknown[] = []
    const sql = buildSqlLikeTokenAndClause(['title', "IFNULL(location,'')"], 'HAK Steyr', params)
    expect(sql).toContain(' AND ')
    expect(params).toHaveLength(4)
  })
})

describe('phrase search', () => {
  it('builds FTS phrase and combined match', () => {
    expect(normalizeFtsPhraseMatchQuery('HAK Steyr')).toBe('"HAK Steyr"')
    expect(normalizeFtsPhraseMatchQuery('ab')).toBeNull()
    expect(normalizeFtsTokenOrPhraseMatchQuery('HAK Steyr')).toBe('HAK* Steyr* OR "HAK Steyr"')
  })

  it('builds phrase LIKE needle', () => {
    expect(buildPhraseLikeNeedle('  HAK   Steyr ')).toBe('%HAK Steyr%')
  })

  it('builds phrase rank CASE', () => {
    const rank = buildSqlPhraseRankCase('m.subject', "IFNULL(m.snippet,'')", 'HAK Steyr')
    expect(rank?.sql).toContain('THEN 0')
    expect(rank?.sql).toContain('THEN 1')
    expect(rank?.params).toHaveLength(2)
  })
})
