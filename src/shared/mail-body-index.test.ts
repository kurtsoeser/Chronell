import { describe, expect, it } from 'vitest'
import {
  MAIL_BODY_INDEX_SPEED_PRESETS,
  normalizeMailBodyIndexSpeed,
  resolveMailBodyIndexPreset
} from './mail-body-index'

describe('mail-body-index', () => {
  it('normalizes speed', () => {
    expect(normalizeMailBodyIndexSpeed('fast')).toBe('fast')
    expect(normalizeMailBodyIndexSpeed('invalid')).toBe('normal')
  })

  it('resolves presets', () => {
    expect(resolveMailBodyIndexPreset('normal')).toEqual(MAIL_BODY_INDEX_SPEED_PRESETS.normal)
  })
})
