import type { MailSearchFolderScope } from '@shared/mail-search-scope'
import { getDb } from './index'

export function resolveMailSearchScopeFolderIdsInDb(
  scope: MailSearchFolderScope,
  activeFolderId: number | null
): number[] | undefined {
  if (scope === 'all') return undefined
  if (scope === 'current') {
    if (activeFolderId != null && activeFolderId > 0) return [activeFolderId]
    return []
  }
  const wellKnown =
    scope === 'inbox' ? 'inbox' : scope === 'sent' ? 'sentitems' : scope === 'archive' ? 'archive' : null
  if (!wellKnown) return []
  const rows = getDb()
    .prepare<[string], { id: number }>('SELECT id FROM folders WHERE well_known = ?')
    .all(wellKnown)
  return rows.map((r) => r.id)
}
