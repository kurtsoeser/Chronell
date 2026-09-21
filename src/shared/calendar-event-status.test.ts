import { describe, expect, it } from 'vitest'
import {
  calendarEventSensitivityFromPrivate,
  calendarEventSensitivityIsPrivate,
  googleTransparencyFromShowAs,
  googleVisibilityFromSensitivity,
  normalizeCalendarEventSensitivity,
  normalizeCalendarEventShowAs,
  sensitivityFromGoogleVisibility,
  showAsFromGoogleTransparency
} from './calendar-event-status'

describe('calendar-event-status', () => {
  it('normalizes Graph showAs / sensitivity', () => {
    expect(normalizeCalendarEventShowAs('workingElsewhere')).toBe('workingElsewhere')
    expect(normalizeCalendarEventShowAs('WorkingElsewhere')).toBe('workingElsewhere')
    expect(normalizeCalendarEventShowAs('nope')).toBeNull()
    expect(normalizeCalendarEventSensitivity('private')).toBe('private')
    expect(normalizeCalendarEventSensitivity('x')).toBeNull()
  })

  it('maps private checkbox', () => {
    expect(calendarEventSensitivityIsPrivate('private')).toBe(true)
    expect(calendarEventSensitivityIsPrivate('personal')).toBe(true)
    expect(calendarEventSensitivityIsPrivate('normal')).toBe(false)
    expect(calendarEventSensitivityFromPrivate(true)).toBe('private')
    expect(calendarEventSensitivityFromPrivate(false)).toBe('normal')
  })

  it('maps Google transparency / visibility', () => {
    expect(googleTransparencyFromShowAs('free')).toBe('transparent')
    expect(googleTransparencyFromShowAs('busy')).toBe('opaque')
    expect(googleTransparencyFromShowAs('oof')).toBe('opaque')
    expect(showAsFromGoogleTransparency('transparent')).toBe('free')
    expect(showAsFromGoogleTransparency('opaque')).toBe('busy')
    expect(googleVisibilityFromSensitivity('private')).toBe('private')
    expect(googleVisibilityFromSensitivity('normal')).toBe('default')
    expect(sensitivityFromGoogleVisibility('private')).toBe('private')
    expect(sensitivityFromGoogleVisibility('default')).toBe('normal')
  })
})
