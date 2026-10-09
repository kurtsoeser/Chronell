import {
  mailSearchQueryUsesFieldSyntax,
  parseMailSearchQuery,
  parsedMailSearchToAdvancedCriteria
} from '@shared/mail-search-query-parse'
import type { SearchHit } from '@shared/types'
import { getActivePollFolder } from '../mail-poll-runner'
import {
  advancedMailSearchCriteriaHasFilter,
  searchMessages,
  searchMessagesAdvanced
} from './messages-repo-ops'
import { resolveMailSearchScopeFolderIdsInDb } from './mail-search-scope-db'

/**
 * Einheitliche Mail-Suche: Freitext oder Feld-Syntax (`von:`, `an:`, `ordner:gesendet`, …).
 */
export function searchMessagesUnified(rawQuery: string, limit = 30): SearchHit[] {
  const trimmed = rawQuery.trim()
  if (trimmed.length < 2) return []

  if (!mailSearchQueryUsesFieldSyntax(trimmed)) {
    return searchMessages(trimmed, limit)
  }

  const parsed = parseMailSearchQuery(trimmed)
  const criteria = parsedMailSearchToAdvancedCriteria(parsed)

  if (parsed.folderScope && parsed.folderScope !== 'all') {
    criteria.scopeFolderIds =
      resolveMailSearchScopeFolderIdsInDb(parsed.folderScope, getActivePollFolder()) ?? []
  }

  if (!advancedMailSearchCriteriaHasFilter(criteria)) {
    if (criteria.keywords) {
      return searchMessages(criteria.keywords, limit)
    }
    return []
  }

  return searchMessagesAdvanced(criteria, limit)
}
