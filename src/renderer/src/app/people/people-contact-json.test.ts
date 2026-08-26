import { describe, expect, it } from 'vitest'
import {
  phonesEntriesEqual,
  sanitizePhoneEntries,
  normalizePhoneKind
} from '@/app/people/people-contact-json'

describe('people phone helpers', () => {
  it('normalizes provider-specific phone types', () => {
    expect(normalizePhoneKind('mobile')).toBe('mobile')
    expect(normalizePhoneKind('Mobiltelefon')).toBe('mobile')
    expect(normalizePhoneKind('home')).toBe('home')
    expect(normalizePhoneKind('work')).toBe('business')
    expect(normalizePhoneKind('geschäftlich')).toBe('business')
  })

  it('compares phone lists independent of order', () => {
    const a = sanitizePhoneEntries([
      { type: 'mobile', value: '+43 660 5112467' },
      { type: 'business', value: '+43 1 234567' }
    ])
    const b = sanitizePhoneEntries([
      { type: 'work', value: '+43 1 234567' },
      { type: 'cell', value: '+43 660 5112467' }
    ])
    expect(phonesEntriesEqual(a, b)).toBe(true)
  })

  it('detects changed phone numbers', () => {
    const before = [{ type: 'mobile', value: '+43 660 5112467' }]
    const after = [{ type: 'mobile', value: '+43 660 9999999' }]
    expect(phonesEntriesEqual(before, after)).toBe(false)
  })
})
