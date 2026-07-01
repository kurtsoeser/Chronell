import { describe, expect, it } from 'vitest'
import {
  pickSuccessorMessageId,
  type MailNavigableLayoutState
} from './mail-store-helpers'
import { makeMailListItem } from '../../../test-fixtures/mail'

function baseState(messages: ReturnType<typeof makeMailListItem>[]): MailNavigableLayoutState {
  return {
    mailFilter: 'all',
    listKind: 'folder',
    messages,
    threadMessages: {},
    selectedFolderAccountId: 'acc-1',
    selectedFolderId: 1,
    foldersByAccount: {
      'acc-1': [
        {
          id: 1,
          accountId: 'acc-1',
          remoteId: 'inbox',
          name: 'Posteingang',
          wellKnown: 'inbox',
          parentRemoteId: null,
          path: null,
          unreadCount: 0,
          totalCount: messages.length,
          isFavorite: false
        }
      ]
    },
    expandedThreads: new Set<string>(),
    mailListArrangeBy: 'date_conversations',
    mailListChronoOrder: 'oldest_on_top',
    collapsedMailListGroupKeys: new Set<string>(),
    accountListMeta: {},
    flaggedFilterExcludeDeletedJunk: true
  }
}

describe('pickSuccessorMessageId', () => {
  it('waehlt die naechste Mail an derselben Listenposition', () => {
    const state = baseState([makeMailListItem(1), makeMailListItem(2), makeMailListItem(3)])
    expect(pickSuccessorMessageId(state, 1)).toBe(2)
    expect(pickSuccessorMessageId(state, 2)).toBe(3)
  })

  it('waehlt die vorherige Mail, wenn die letzte entfernt wird', () => {
    const state = baseState([makeMailListItem(1), makeMailListItem(2), makeMailListItem(3)])
    expect(pickSuccessorMessageId(state, 3)).toBe(2)
  })

  it('gibt null zurueck, wenn die einzige Mail entfernt wird', () => {
    const state = baseState([makeMailListItem(1)])
    expect(pickSuccessorMessageId(state, 1)).toBeNull()
  })
})
