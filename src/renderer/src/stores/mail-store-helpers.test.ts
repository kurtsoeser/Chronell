import { describe, expect, it } from 'vitest'
import type { MailListItem } from '@shared/types'
import {
  pickSuccessorMessageId,
  type MailNavigableLayoutState
} from './mail-store-helpers'

function item(id: number, overrides: Partial<MailListItem> = {}): MailListItem {
  return {
    id,
    accountId: 'acc-1',
    folderId: 1,
    remoteId: `r-${id}`,
    subject: `Mail ${id}`,
    fromAddr: 'a@example.com',
    fromName: null,
    toAddrs: [],
    ccAddrs: [],
    receivedAt: `2026-06-${String(id).padStart(2, '0')}T10:00:00.000Z`,
    sentAt: null,
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
    preview: '',
    categories: [],
    openTodoId: null,
    openTodoDueKind: null,
    openTodoDueAt: null,
    openTodoStartAt: null,
    openTodoEndAt: null,
    remoteThreadId: null,
    ...overrides
  }
}

function baseState(messages: MailListItem[]): MailNavigableLayoutState {
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
          parentFolderId: null,
          unreadCount: 0,
          totalCount: messages.length,
          isFavorite: false,
          sortOrder: 0
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
    const state = baseState([item(1), item(2), item(3)])
    expect(pickSuccessorMessageId(state, 1)).toBe(2)
    expect(pickSuccessorMessageId(state, 2)).toBe(3)
  })

  it('waehlt die vorherige Mail, wenn die letzte entfernt wird', () => {
    const state = baseState([item(1), item(2), item(3)])
    expect(pickSuccessorMessageId(state, 3)).toBe(2)
  })

  it('gibt null zurueck, wenn die einzige Mail entfernt wird', () => {
    const state = baseState([item(1)])
    expect(pickSuccessorMessageId(state, 1)).toBeNull()
  })
})
