import { describe, expect, it } from 'vitest'
import {
  messageIdFromMailListRow,
  orderedMessageIdsFromRows,
  rangeMessageIdsInListOrder,
  resolveBulkDragMessageIds
} from '@/lib/mail-list-bulk-selection'
import type { MailListVirtualRow } from '@/lib/mail-list-arrange'
import type { MailListItem } from '@shared/types'

function msg(id: number): MailListItem {
  return {
    id,
    accountId: 'a1',
    subject: `Mail ${id}`,
    fromAddr: 'a@b.c',
    isRead: false,
    isFlagged: false,
    hasAttachments: false
  } as MailListItem
}

describe('messageIdFromMailListRow', () => {
  it('returns latest message id for thread head', () => {
    const row: MailListVirtualRow = {
      kind: 'thread-head',
      key: 't1',
      thread: {
        threadKey: 't1',
        accountId: 'a1',
        messageCount: 2,
        unreadCount: 1,
        isFlagged: false,
        hasAttachments: false,
        participantNames: [],
        rootMessage: msg(1),
        latestMessage: msg(2)
      },
      threadMessages: [msg(1), msg(2)]
    }
    expect(messageIdFromMailListRow(row)).toBe(2)
  })

  it('returns message id for thread sub row', () => {
    const row: MailListVirtualRow = {
      kind: 'thread-sub',
      key: 's1',
      threadKey: 't1',
      message: msg(3)
    }
    expect(messageIdFromMailListRow(row)).toBe(3)
  })
})

describe('orderedMessageIdsFromRows', () => {
  it('dedupes ids in list order', () => {
    const rows: MailListVirtualRow[] = [
      {
        kind: 'thread-head',
        key: 't1',
        thread: {
          threadKey: 't1',
          accountId: 'a1',
          messageCount: 1,
          unreadCount: 0,
          isFlagged: false,
          hasAttachments: false,
          participantNames: [],
          rootMessage: msg(1),
          latestMessage: msg(1)
        },
        threadMessages: [msg(1)]
      },
      {
        kind: 'thread-sub',
        key: 's2',
        threadKey: 't1',
        message: msg(2)
      }
    ]
    expect(orderedMessageIdsFromRows(rows)).toEqual([1, 2])
  })
})

describe('resolveBulkDragMessageIds', () => {
  it('returns all selected ids when dragged row is part of bulk selection', () => {
    const selected = new Set([10, 20, 30])
    expect(resolveBulkDragMessageIds(20, [20], selected)).toEqual([10, 20, 30])
  })

  it('returns fallback when row is not bulk-selected', () => {
    const selected = new Set([10, 30])
    expect(resolveBulkDragMessageIds(20, [20, 21], selected)).toEqual([20, 21])
  })

  it('returns fallback when nothing is selected', () => {
    expect(resolveBulkDragMessageIds(20, [20, 21], new Set())).toEqual([20, 21])
  })
})

describe('rangeMessageIdsInListOrder', () => {
  it('returns contiguous slice between anchor and target', () => {
    expect(rangeMessageIdsInListOrder([10, 20, 30, 40], 10, 40)).toEqual([10, 20, 30, 40])
    expect(rangeMessageIdsInListOrder([10, 20, 30, 40], 40, 20)).toEqual([20, 30, 40])
  })

  it('falls back to target when anchor is not visible', () => {
    expect(rangeMessageIdsInListOrder([10, 20], 99, 20)).toEqual([20])
  })
})
