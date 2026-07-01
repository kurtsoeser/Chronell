import { describe, expect, it } from 'vitest'
import type { MetaFolderCriteria, MetaFolderExceptionClause } from '@shared/types'
import {
  metaFolderCriteriaHasActiveFilter,
  metaFolderExceptionClauseHasFilter,
  normalizeMessagesFtsMatchQuery
} from './messages-repo-list'

describe('messages-repo-list filters', () => {
  describe('normalizeMessagesFtsMatchQuery', () => {
    it('liefert null fuer leere Eingabe', () => {
      expect(normalizeMessagesFtsMatchQuery('')).toBeNull()
      expect(normalizeMessagesFtsMatchQuery('   ')).toBeNull()
    })

    it('normalisiert Suchbegriffe zu FTS-Prefix-Tokens', () => {
      const q = normalizeMessagesFtsMatchQuery('hello world')
      expect(q).toBeTruthy()
      expect(q).toContain('hello')
      expect(q).toContain('world')
    })
  })

  describe('metaFolderCriteriaHasActiveFilter', () => {
    const empty: MetaFolderCriteria = {}

    it('leere Criteria ohne aktiven Filter', () => {
      expect(metaFolderCriteriaHasActiveFilter(empty)).toBe(false)
    })

    it('erkennt unreadOnly', () => {
      expect(metaFolderCriteriaHasActiveFilter({ unreadOnly: true })).toBe(true)
    })

    it('erkennt flaggedOnly und hasAttachmentsOnly', () => {
      expect(metaFolderCriteriaHasActiveFilter({ flaggedOnly: true })).toBe(true)
      expect(metaFolderCriteriaHasActiveFilter({ hasAttachmentsOnly: true })).toBe(true)
    })

    it('fromContains braucht mindestens 2 Zeichen', () => {
      expect(metaFolderCriteriaHasActiveFilter({ fromContains: 'a' })).toBe(false)
      expect(metaFolderCriteriaHasActiveFilter({ fromContains: 'ab' })).toBe(true)
    })

    it('erkennt scopeFolderIds und categoriesAny', () => {
      expect(metaFolderCriteriaHasActiveFilter({ scopeFolderIds: [1, 2] })).toBe(true)
      expect(metaFolderCriteriaHasActiveFilter({ categoriesAny: ['Important'] })).toBe(true)
    })

    it('erkennt matchExpression mit aktivem Leaf', () => {
      expect(
        metaFolderCriteriaHasActiveFilter({
          matchExpression: {
            kind: 'group',
            id: 'g1',
            op: 'and',
            children: [{ kind: 'leaf', id: 'l1', type: 'unread' }]
          }
        })
      ).toBe(true)
    })

    it('ignoriert leere textQuery', () => {
      expect(metaFolderCriteriaHasActiveFilter({ textQuery: '  ' })).toBe(false)
    })
  })

  describe('metaFolderExceptionClauseHasFilter', () => {
    const empty: MetaFolderExceptionClause = {}

    it('leere Ausnahme ist inaktiv', () => {
      expect(metaFolderExceptionClauseHasFilter(empty)).toBe(false)
    })

    it('erkennt Teilfilter in Ausnahme-Zeilen', () => {
      expect(metaFolderExceptionClauseHasFilter({ unreadOnly: true })).toBe(true)
      expect(metaFolderExceptionClauseHasFilter({ fromContains: 'team' })).toBe(true)
      expect(metaFolderExceptionClauseHasFilter({ fromContains: 'x' })).toBe(false)
    })
  })
})
