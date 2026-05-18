import type { MailListItem } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { groupMessagesIntoThreads } from './thread-group'
import { pickThreadLatestMessage, pickThreadRootMessage } from './thread-display-pick'

function msg(p: Partial<MailListItem> & Pick<MailListItem, 'id' | 'accountId' | 'remoteId'>): MailListItem {
  return {
    folderId: 1,
    threadId: null,
    remoteThreadId: 'thread-1',
    subject: 'Betreff',
    fromAddr: 'a@example.com',
    fromName: 'Alice',
    snippet: 'Hallo',
    sentAt: null,
    receivedAt: '2026-05-18T10:00:00.000Z',
    isRead: true,
    isFlagged: false,
    hasAttachments: false,
    importance: 'normal',
    snoozedUntil: null,
    ...p
  }
}

describe('pickThreadRootMessage', () => {
  it('bevorzugt aelteste Mail mit Absender und Betreff', () => {
    const inbox = msg({
      id: 2,
      accountId: 'ms:a',
      remoteId: 'r2',
      receivedAt: '2026-05-18T12:00:00.000Z',
      fromName: 'Alice',
      subject: 'AW: Thema'
    })
    const stub = msg({
      id: 1,
      accountId: 'ms:a',
      remoteId: 'r1',
      receivedAt: '2026-05-17T08:00:00.000Z',
      fromName: null,
      fromAddr: null,
      subject: null,
      snippet: null
    })
    expect(pickThreadRootMessage([inbox, stub])).toEqual(inbox)
  })
})

describe('pickThreadLatestMessage', () => {
  it('bevorzugt neueste Mail mit Datum und Metadaten', () => {
    const inbox = msg({
      id: 2,
      accountId: 'ms:a',
      remoteId: 'r2',
      receivedAt: '2026-05-18T12:00:00.000Z'
    })
    const stub = msg({
      id: 3,
      accountId: 'ms:a',
      remoteId: 'r3',
      receivedAt: '2026-05-19T08:00:00.000Z',
      fromName: null,
      fromAddr: null,
      subject: null,
      snippet: null
    })
    expect(pickThreadLatestMessage([inbox, stub])).toEqual(inbox)
  })
})

describe('groupMessagesIntoThreads mit Cross-Folder-Stubs', () => {
  it('zeigt Absender/Betreff der Inbox-Mail trotz aelterer Stub aus Gesendet', () => {
    const inbox = msg({
      id: 10,
      accountId: 'ms:a',
      remoteId: 'r-inbox',
      remoteThreadId: 'conv-1',
      receivedAt: '2026-05-18T11:00:00.000Z',
      fromName: 'Monika',
      subject: 'SCHILF MS Teams'
    })
    const sentStub = msg({
      id: 11,
      accountId: 'ms:a',
      remoteId: 'r-sent',
      remoteThreadId: 'conv-1',
      receivedAt: '2026-05-17T09:00:00.000Z',
      fromName: null,
      fromAddr: null,
      subject: null,
      snippet: null
    })
    const groups = groupMessagesIntoThreads([inbox], { 'conv-1': [sentStub] }, false)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.rootMessage.id).toBe(10)
    expect(groups[0]!.latestMessage.id).toBe(10)
    expect(groups[0]!.rootMessage.fromName).toBe('Monika')
    expect(groups[0]!.rootMessage.subject).toBe('SCHILF MS Teams')
  })
})
