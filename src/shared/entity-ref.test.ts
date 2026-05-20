import { describe, expect, it } from 'vitest'
import {
  canonicalEntityRefPair,
  entityRefKey,
  entityRefsEqual,
  isSelfEntityLink
} from './entity-ref'

describe('entityRefKey', () => {
  it('builds stable keys', () => {
    expect(entityRefKey({ kind: 'mail', messageId: 42 })).toBe('mail:42')
    expect(entityRefKey({ kind: 'mail_todo', todoId: 7 })).toBe('mail-todo:7')
    expect(
      entityRefKey({
        kind: 'cloud_task',
        accountId: 'a',
        listId: 'l',
        taskId: 't'
      })
    ).toBe('task:a:l:t')
    expect(entityRefKey({ kind: 'people_contact', contactId: 7 })).toBe('contact:7')
  })
})

describe('canonicalEntityRefPair', () => {
  it('orders by key lexicographically', () => {
    const mail = { kind: 'mail' as const, messageId: 1 }
    const note = { kind: 'note' as const, noteId: 99 }
    const [a, b] = canonicalEntityRefPair(mail, note)
    expect(entityRefKey(a)).toBe('mail:1')
    expect(entityRefKey(b)).toBe('note:99')
  })

  it('is stable regardless of input order', () => {
    const x = { kind: 'note' as const, noteId: 5 }
    const y = { kind: 'note' as const, noteId: 10 }
    expect(canonicalEntityRefPair(x, y)).toEqual(canonicalEntityRefPair(y, x))
  })
})

describe('entityRefsEqual', () => {
  it('compares refs', () => {
    expect(entityRefsEqual({ kind: 'note', noteId: 1 }, { kind: 'note', noteId: 1 })).toBe(true)
    expect(entityRefsEqual({ kind: 'note', noteId: 1 }, { kind: 'note', noteId: 2 })).toBe(false)
  })
})

describe('isSelfEntityLink', () => {
  it('detects self links', () => {
    const ref = { kind: 'mail' as const, messageId: 3 }
    expect(isSelfEntityLink(ref, ref)).toBe(true)
    expect(isSelfEntityLink(ref, { kind: 'mail', messageId: 4 })).toBe(false)
  })
})
