/**
 * Lokalisierten Anzeigenamen für bekannte Mail-Ordner (Graph/Gmail wellKnown).
 * `tr` ist typischerweise `t` aus react-i18next.
 */

export type WellKnownFolderTitleStyle = 'topbar' | 'conversationPreview'

const WELL_KNOWN_FOLDER_I18N: Record<
  WellKnownFolderTitleStyle,
  Partial<Record<string, string>>
> = {
  topbar: {
    inbox: 'topbar.folderInbox',
    sentitems: 'topbar.folderSent',
    drafts: 'topbar.folderDrafts',
    deleteditems: 'topbar.folderDeleted',
    junkemail: 'mail.list.folderJunk',
    archive: 'topbar.folderArchive'
  },
  conversationPreview: {
    sentitems: 'mail.conversationPreview.folderSent',
    drafts: 'mail.conversationPreview.folderDrafts',
    archive: 'mail.conversationPreview.folderArchive',
    deleteditems: 'mail.conversationPreview.folderTrash'
  }
}

export function wellKnownFolderTitle(
  wellKnown: string | null | undefined,
  fallbackName: string,
  tr: (key: string) => string,
  style: WellKnownFolderTitleStyle = 'topbar'
): string {
  const w = (wellKnown ?? '').toLowerCase()
  const key = WELL_KNOWN_FOLDER_I18N[style][w]
  if (key) return tr(key)
  return fallbackName
}
