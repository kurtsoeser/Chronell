import type { AdvancedMailSearchCriteria, MailFolder } from './types'
import {
  mailSearchFolderScopeLabelKey,
  resolveMailSearchScopeFolderIds,
  type MailSearchFolderScope
} from './mail-search-scope'

export type AdvancedSearchDateKind = 'received' | 'sent'

export type AdvancedSearchDraft = {
  folderScope: MailSearchFolderScope
  fromContains: string
  toContains: string
  ccContains: string
  subjectContains: string
  keywords: string
  categoryContains: string
  dateFrom: string
  dateTo: string
  dateKind: AdvancedSearchDateKind
  readStatus: 'all' | 'unread' | 'read'
  hasAttachmentsOnly: boolean
}

export function emptyAdvancedSearchDraft(): AdvancedSearchDraft {
  return {
    folderScope: 'all',
    fromContains: '',
    toContains: '',
    ccContains: '',
    subjectContains: '',
    keywords: '',
    categoryContains: '',
    dateFrom: '',
    dateTo: '',
    dateKind: 'received',
    readStatus: 'all',
    hasAttachmentsOnly: false
  }
}

export interface AdvancedSearchDraftContext {
  foldersByAccount: Record<string, MailFolder[]>
  selectedFolderAccountId: string | null
  selectedFolderId: number | null
}

function likeMinLen(s: string): boolean {
  return s.trim().length >= 2
}

export function advancedSearchDraftHasFilter(d: AdvancedSearchDraft): boolean {
  if (likeMinLen(d.fromContains)) return true
  if (likeMinLen(d.toContains)) return true
  if (likeMinLen(d.ccContains)) return true
  if (likeMinLen(d.subjectContains)) return true
  if (likeMinLen(d.keywords)) return true
  if (likeMinLen(d.categoryContains)) return true
  if (d.dateFrom.trim()) return true
  if (d.dateTo.trim()) return true
  if (d.readStatus !== 'all') return true
  if (d.hasAttachmentsOnly) return true
  if (d.folderScope !== 'all') return true
  return false
}

export function draftToAdvancedCriteria(
  d: AdvancedSearchDraft,
  ctx?: AdvancedSearchDraftContext
): AdvancedMailSearchCriteria {
  const c: AdvancedMailSearchCriteria = {}
  if (likeMinLen(d.fromContains)) c.fromContains = d.fromContains.trim()
  if (likeMinLen(d.toContains)) c.toContains = d.toContains.trim()
  if (likeMinLen(d.ccContains)) c.ccContains = d.ccContains.trim()
  if (likeMinLen(d.subjectContains)) c.subjectContains = d.subjectContains.trim()
  if (likeMinLen(d.keywords)) c.keywords = d.keywords.trim()
  if (likeMinLen(d.categoryContains)) c.categoryContains = d.categoryContains.trim()
  if (d.dateFrom.trim()) c.dateFrom = d.dateFrom.trim()
  if (d.dateTo.trim()) c.dateTo = d.dateTo.trim()
  if (d.dateKind === 'sent') c.dateKind = 'sent'
  if (d.readStatus !== 'all') c.readStatus = d.readStatus
  if (d.hasAttachmentsOnly) c.hasAttachmentsOnly = true

  if (d.folderScope !== 'all') {
    const ids = ctx
      ? resolveMailSearchScopeFolderIds(
          d.folderScope,
          ctx.foldersByAccount,
          ctx.selectedFolderAccountId,
          ctx.selectedFolderId
        )
      : undefined
    c.scopeFolderIds = ids ?? []
  }

  return c
}

export { mailSearchFolderScopeLabelKey }
