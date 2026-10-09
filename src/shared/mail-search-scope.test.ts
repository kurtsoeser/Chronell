import { describe, expect, it } from 'vitest'
import { resolveMailSearchScopeFolderIds } from './mail-search-scope'
import type { MailFolder } from './types'

const folder = (id: number, wellKnown: string | null): MailFolder => ({
  id,
  accountId: 'acc',
  remoteId: `r-${id}`,
  name: `Folder ${id}`,
  wellKnown,
  parentRemoteId: null,
  path: null,
  isFavorite: false,
  unreadCount: 0,
  totalCount: 0
})

describe('resolveMailSearchScopeFolderIds', () => {
  it('liefert alle Inbox-Ordner', () => {
    const byAccount = {
      a: [folder(1, 'inbox'), folder(2, 'sentitems')],
      b: [folder(3, 'inbox')]
    }
    expect(resolveMailSearchScopeFolderIds('inbox', byAccount, null, null)).toEqual([1, 3])
  })

  it('current nutzt ausgewaehlten Ordner', () => {
    const byAccount = { a: [folder(5, 'inbox')] }
    expect(resolveMailSearchScopeFolderIds('current', byAccount, 'a', 5)).toEqual([5])
  })
})
