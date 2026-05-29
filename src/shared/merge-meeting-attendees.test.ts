import { describe, expect, it } from 'vitest'
import { mergeMeetingAttendees } from './merge-meeting-attendees'

describe('mergeMeetingAttendees', () => {
  it('prefers live Graph status over stale ICS status', () => {
    const merged = mergeMeetingAttendees(
      [
        { email: 'kurt@example.com', name: 'Kurt', partStat: 'needs-action' },
        { email: 'other@example.com', name: 'Other', partStat: 'needs-action' }
      ],
      [
        { email: 'kurt@example.com', name: null, partStat: 'accepted' },
        { email: 'other@example.com', name: null, partStat: 'declined' }
      ],
      'kurt@example.com',
      'accepted'
    )
    expect(merged.find((a) => a.email === 'kurt@example.com')?.partStat).toBe('accepted')
    expect(merged.find((a) => a.email === 'other@example.com')?.partStat).toBe('declined')
  })

  it('applies selfPartStat when Graph has no attendee row yet', () => {
    const merged = mergeMeetingAttendees(
      [{ email: 'kurt@example.com', name: 'Kurt', partStat: 'unknown' }],
      [],
      'kurt@example.com',
      'accepted'
    )
    expect(merged[0]?.partStat).toBe('accepted')
  })
})
