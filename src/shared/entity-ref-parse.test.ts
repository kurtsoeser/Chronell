import { describe, expect, it } from 'vitest'
import { entityRefKey, parseEntityRefKey } from './entity-ref'

describe('parseEntityRefKey', () => {
  it('round-trips mail and calendar', () => {
    const mail = { kind: 'mail' as const, messageId: 42 }
    expect(parseEntityRefKey(entityRefKey(mail))).toEqual(mail)
    const cal = {
      kind: 'calendar_event' as const,
      accountId: 'acc-1',
      graphEventId: 'evt/x'
    }
    expect(parseEntityRefKey(entityRefKey(cal))).toEqual(cal)
  })
})
