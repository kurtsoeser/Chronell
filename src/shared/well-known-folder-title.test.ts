import { describe, expect, it } from 'vitest'
import { wellKnownFolderTitle } from './well-known-folder-title'

describe('wellKnownFolderTitle', () => {
  const tr = (key: string): string => key

  it('mappt bekannte Ordner auf i18n-Keys', () => {
    expect(wellKnownFolderTitle('inbox', 'Inbox', tr)).toBe('topbar.folderInbox')
    expect(wellKnownFolderTitle('SENTITEMS', 'Sent', tr)).toBe('topbar.folderSent')
    expect(wellKnownFolderTitle('junkemail', 'Junk', tr)).toBe('mail.list.folderJunk')
  })

  it('nutzt Fallback fuer unbekannte Ordner', () => {
    expect(wellKnownFolderTitle('custom', 'Mein Ordner', tr)).toBe('Mein Ordner')
  })

  it('unterstuetzt conversationPreview-Keys', () => {
    expect(wellKnownFolderTitle('deleteditems', 'Trash', tr, 'conversationPreview')).toBe(
      'mail.conversationPreview.folderTrash'
    )
  })
})
