import { describe, expect, it } from 'vitest'
import { dismissedPairKey } from './entity-link-ai-dismissed'

describe('dismissedPairKey', () => {
  it('is order-independent', () => {
    const mailA = { kind: 'mail' as const, messageId: 1 }
    const mailB = { kind: 'mail' as const, messageId: 2 }
    expect(dismissedPairKey(mailA, mailB)).toBe(dismissedPairKey(mailB, mailA))
  })
})
