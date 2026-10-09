import type { MailFolder } from './types'

/** Ordner-Presets für die erweiterte Mail-Suche (UI). */
export type MailSearchFolderScope = 'all' | 'inbox' | 'sent' | 'archive' | 'current'

const SCOPE_WELL_KNOWN: Record<Exclude<MailSearchFolderScope, 'all' | 'current'>, string> = {
  inbox: 'inbox',
  sent: 'sentitems',
  archive: 'archive'
}

export function resolveMailSearchScopeFolderIds(
  scope: MailSearchFolderScope,
  foldersByAccount: Record<string, MailFolder[]>,
  selectedFolderAccountId: string | null,
  selectedFolderId: number | null
): number[] | undefined {
  if (scope === 'all') return undefined
  if (scope === 'current') {
    if (selectedFolderId != null && selectedFolderId > 0) return [selectedFolderId]
    return undefined
  }
  const wellKnown = SCOPE_WELL_KNOWN[scope]
  const ids: number[] = []
  for (const folders of Object.values(foldersByAccount)) {
    for (const f of folders) {
      if (f.wellKnown === wellKnown) ids.push(f.id)
    }
  }
  return ids.length > 0 ? ids : []
}

export function mailSearchFolderScopeLabelKey(scope: MailSearchFolderScope): string {
  switch (scope) {
    case 'all':
      return 'topbar.advancedScopeAll'
    case 'inbox':
      return 'topbar.folderInbox'
    case 'sent':
      return 'topbar.folderSent'
    case 'archive':
      return 'topbar.folderArchive'
    case 'current':
      return 'topbar.advancedScopeCurrentFolder'
    default:
      return 'topbar.advancedScopeAll'
  }
}
