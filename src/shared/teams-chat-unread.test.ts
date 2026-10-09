import { describe, expect, it } from 'vitest'
import { teamsChatHasUnreadMessages } from './teams-chat-unread'

describe('teamsChatHasUnreadMessages', () => {
  it('returns false without preview', () => {
    expect(teamsChatHasUnreadMessages(null, '2026-01-01T00:00:00Z')).toBe(false)
  })

  it('returns true when never read', () => {
    expect(teamsChatHasUnreadMessages('2026-01-02T00:00:00Z', null)).toBe(true)
  })

  it('compares preview and read timestamps', () => {
    expect(
      teamsChatHasUnreadMessages('2026-01-02T12:00:00Z', '2026-01-02T11:00:00Z')
    ).toBe(true)
    expect(
      teamsChatHasUnreadMessages('2026-01-02T11:00:00Z', '2026-01-02T12:00:00Z')
    ).toBe(false)
  })
})
