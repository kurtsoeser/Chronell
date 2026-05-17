import { describe, expect, it } from 'vitest'
import {
  LEGACY_USER_DATA_DIR_NAME,
  shouldSkipTopLevelEntry,
  hasMeaningfulUserData
} from './user-data-migration'
import { join } from 'node:path'

describe('user-data-migration', () => {
  it('legacy dir name is mailclient', () => {
    expect(LEGACY_USER_DATA_DIR_NAME).toBe('mailclient')
  })

  it('skips chromium cache folders', () => {
    expect(shouldSkipTopLevelEntry('Cache')).toBe(true)
    expect(shouldSkipTopLevelEntry('config.json')).toBe(false)
    expect(shouldSkipTopLevelEntry('data')).toBe(false)
    expect(shouldSkipTopLevelEntry('Local Storage')).toBe(false)
  })

  it('detects meaningful user data', () => {
    const root = 'C:\\AppData\\mailclient'
    expect(
      hasMeaningfulUserData(root, (p) => p === join(root, 'config.json'))
    ).toBe(true)
    expect(hasMeaningfulUserData(root, () => false)).toBe(false)
  })
})
