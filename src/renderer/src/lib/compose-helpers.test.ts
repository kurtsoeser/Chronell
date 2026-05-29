import type { MailFull } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  buildForwardBody,
  buildReplyBody,
  formatRecipientsForInput,
  formatRecipientsWithTail,
  parseRecipients,
  parseRecipientsBulk,
  parseRecipientsWithTail,
  plainToHtml,
  withForwardPrefix,
  withReplyPrefix
} from './compose-helpers'

describe('parseRecipients', () => {
  it('parst Namen mit Klammer-Adresse und filtert Ungueltiges', () => {
    expect(parseRecipients('')).toEqual([])
    expect(parseRecipients('  ')).toEqual([])
    const r = parseRecipients('Max <max@test.de>, nur-text')
    expect(r).toEqual([{ address: 'max@test.de', name: 'Max' }])
  })
})

describe('formatRecipientsForInput', () => {
  it('formatiert zurueck', () => {
    const s = formatRecipientsForInput([{ address: 'a@b.c', name: 'A' }, { address: 'x@y.z' }])
    expect(s).toContain('A <a@b.c>')
    expect(s).toContain('x@y.z')
  })
})

describe('formatRecipientsWithTail / parseRecipientsWithTail', () => {
  it('erhaelt Leerzeichen im Tail beim Tippen von Namen', () => {
    expect(formatRecipientsWithTail([], 'Brigit Karre')).toBe('Brigit Karre')
    const { complete, tail } = parseRecipientsWithTail('Brigit Karre')
    expect(complete).toEqual([])
    expect(tail).toBe('Brigit Karre')
  })

  it('trennt bei Komma, Semikolon und Zeilenumbruch', () => {
    expect(parseRecipients('a@b.c; b@b.c')).toEqual([
      { address: 'a@b.c' },
      { address: 'b@b.c' }
    ])
    expect(parseRecipients('a@b.c\nb@b.c')).toEqual([
      { address: 'a@b.c' },
      { address: 'b@b.c' }
    ])
  })

  it('formatiert fertige Empfaenger mit Komma fuer Token-Chips', () => {
    const stored = formatRecipientsWithTail([{ address: 'r.gaul@bhak-eisenstadt.at' }], '')
    expect(stored).toBe('r.gaul@bhak-eisenstadt.at,')
    const { complete, tail } = parseRecipientsWithTail(stored)
    expect(complete).toEqual([{ address: 'r.gaul@bhak-eisenstadt.at' }])
    expect(tail).toBe('')
  })
})

describe('parseRecipientsBulk', () => {
  it('parst Tabellenzeilen Name[TAB]E-Mail', () => {
    expect(parseRecipientsBulk('Brigit Karre\tkarre@haup.ac.at')).toEqual([
      { address: 'karre@haup.ac.at', name: 'Brigit Karre' }
    ])
  })

  it('parst mehrzeilige Listen', () => {
    expect(
      parseRecipientsBulk('a@b.c\nMax <max@test.de>\tb@b.c, c@b.c')
    ).toEqual([
      { address: 'a@b.c' },
      { address: 'max@test.de', name: 'Max' },
      { address: 'b@b.c' },
      { address: 'c@b.c' }
    ])
  })
})

describe('Betreff-Prefixe', () => {
  it('Re: und Fwd: idempotent', () => {
    expect(withReplyPrefix('Hallo')).toBe('Re: Hallo')
    expect(withReplyPrefix('Re: Hallo')).toBe('Re: Hallo')
    expect(withForwardPrefix('X')).toBe('Fwd: X')
    expect(withForwardPrefix('Fwd: X')).toBe('Fwd: X')
  })
})

describe('plainToHtml', () => {
  it('escaped und br', () => {
    expect(plainToHtml('a<b>\n')).toBe('<p>a&lt;b&gt;<br></p>')
  })
})

function fullMsg(p: Partial<MailFull> & Pick<MailFull, 'id' | 'accountId' | 'remoteId'>): MailFull {
  return {
    folderId: 1,
    threadId: null,
    remoteThreadId: null,
    subject: 'S',
    fromAddr: 'f@x.de',
    fromName: 'F',
    snippet: null,
    sentAt: '2026-01-01T12:00:00.000Z',
    receivedAt: null,
    isRead: true,
    isFlagged: false,
    hasAttachments: false,
    importance: null,
    snoozedUntil: null,
    bodyHtml: '<p>Hi</p>',
    bodyText: null,
    ccAddrs: null,
    toAddrs: 't@t.de',
    openTodoId: null,
    openTodoDueKind: null,
    openTodoDueAt: null,
    openTodoStartAt: null,
    openTodoEndAt: null,
    ...p
  }
}

describe('buildReplyBody / buildForwardBody', () => {
  it('enthalten Zitat-Struktur', () => {
    const m = fullMsg({ id: 1, accountId: 'a', remoteId: 'r' })
    const reply = buildReplyBody(m)
    expect(reply).toContain('schrieb')
    expect(reply).toContain('Hi')
    const fwd = buildForwardBody(m)
    expect(fwd).toContain('Von:')
    expect(fwd).toContain('Betreff:')
  })
})
