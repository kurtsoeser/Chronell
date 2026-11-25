import { describe, expect, it, vi } from 'vitest'

vi.mock('./message-participants-repo', () => ({
  hasMessageParticipantsIndex: () => false
}))

import { buildMailKeywordMatchSql } from './mail-search-keyword-match'

function sqlPlaceholderCount(sql: string): number {
  return (sql.match(/\?/g) ?? []).length
}

describe('buildMailKeywordMatchSql', () => {
  it('bindet so viele Parameter wie ?-Platzhalter im SQL', () => {
    const queries = [
      'EinzigartigesSuchwort',
      'Monika',
      'Vertrag Monika',
      'monika.schmidt',
      'kurt sept',
      'Gruss'
    ]
    for (const q of queries) {
      const match = buildMailKeywordMatchSql(q)
      expect(match, q).not.toBeNull()
      expect(match!.params.length, q).toBe(sqlPlaceholderCount(match!.sql))
    }
  })

  it('bindet Adress-LIKE-Parameter pro Spalte und Variante', () => {
    const match = buildMailKeywordMatchSql('kurt')
    expect(match).not.toBeNull()
    // 1 FTS + (Anhang-Varianten) + (4 Adressspalten × Varianten)
    expect(match!.params.length).toBe(sqlPlaceholderCount(match!.sql))
    expect(match!.params.length).toBeGreaterThan(1)
  })
})
