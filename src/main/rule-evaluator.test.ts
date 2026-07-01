import { describe, expect, it } from 'vitest'
import type { MailRuleDefinition } from '@shared/mail-rules'
import { ruleMatchesMessage } from './rule-evaluator'
import { makeMessageRuleContext } from '../test-fixtures/mail'

function ruleWith(
  children: MailRuleDefinition['root']['children'],
  combinator: 'and' | 'or' = 'and'
): MailRuleDefinition {
  return {
    version: 1,
    root: { type: 'group', combinator, children },
    actions: [{ type: 'mark_read' }]
  }
}

describe('ruleMatchesMessage', () => {
  it('matcht from contains case-insensitive', () => {
    const def = ruleWith([
      { type: 'condition', field: 'from', op: 'contains', value: 'BILLING@' }
    ])
    const ctx = makeMessageRuleContext({ fromAddr: 'billing@corp.com' })
    expect(ruleMatchesMessage(def, ctx)).toBe(true)
  })

  it('matcht subject not_contains', () => {
    const def = ruleWith([
      { type: 'condition', field: 'subject', op: 'not_contains', value: 'spam' }
    ])
    expect(ruleMatchesMessage(def, makeMessageRuleContext({ subject: 'Invoice' }))).toBe(true)
    expect(ruleMatchesMessage(def, makeMessageRuleContext({ subject: 'spam offer' }))).toBe(false)
  })

  it('matcht booleans is_read / has_attachment', () => {
    const unread = ruleWith([
      { type: 'condition', field: 'is_read', op: 'is_false', value: '' }
    ])
    expect(ruleMatchesMessage(unread, makeMessageRuleContext({ isRead: false }))).toBe(true)
    expect(ruleMatchesMessage(unread, makeMessageRuleContext({ isRead: true }))).toBe(false)

    const withAtt = ruleWith([
      { type: 'condition', field: 'has_attachment', op: 'is_true', value: '' }
    ])
    expect(ruleMatchesMessage(withAtt, makeMessageRuleContext({ hasAttachments: true }))).toBe(true)
  })

  it('respektiert AND/OR-Kombinatoren', () => {
    const andRule = ruleWith(
      [
        { type: 'condition', field: 'from', op: 'contains', value: 'a@' },
        { type: 'condition', field: 'subject', op: 'contains', value: 'Invoice' }
      ],
      'and'
    )
    expect(
      ruleMatchesMessage(
        andRule,
        makeMessageRuleContext({ fromAddr: 'a@x.com', subject: 'Invoice 1' })
      )
    ).toBe(true)
    expect(
      ruleMatchesMessage(andRule, makeMessageRuleContext({ fromAddr: 'a@x.com', subject: 'Other' }))
    ).toBe(false)

    const orRule = ruleWith(
      [
        { type: 'condition', field: 'from', op: 'contains', value: 'a@' },
        { type: 'condition', field: 'from', op: 'contains', value: 'b@' }
      ],
      'or'
    )
    expect(ruleMatchesMessage(orRule, makeMessageRuleContext({ fromAddr: 'b@y.com' }))).toBe(true)
  })

  it('matcht folder per ID', () => {
    const def = ruleWith([{ type: 'condition', field: 'folder', op: 'equals', value: '42' }])
    expect(ruleMatchesMessage(def, makeMessageRuleContext({ folderId: 42 }))).toBe(true)
    expect(ruleMatchesMessage(def, makeMessageRuleContext({ folderId: 7 }))).toBe(false)
  })

  it('leere contains-Regel matcht nicht', () => {
    const def = ruleWith([{ type: 'condition', field: 'subject', op: 'contains', value: '' }])
    expect(ruleMatchesMessage(def, makeMessageRuleContext())).toBe(false)
  })
})
