import { describe, expect, it } from 'vitest'
import type { AppConfig } from '@shared/types'
import { isGravatarEnabled } from './gravatar'

const base = { gravatarEnabled: undefined } as AppConfig

describe('isGravatarEnabled', () => {
  it('ist standardmaessig aus', () => {
    expect(isGravatarEnabled(null)).toBe(false)
    expect(isGravatarEnabled({ ...base, gravatarEnabled: undefined })).toBe(false)
    expect(isGravatarEnabled({ ...base, gravatarEnabled: false })).toBe(false)
  })

  it('ist nur bei explizitem true an', () => {
    expect(isGravatarEnabled({ ...base, gravatarEnabled: true })).toBe(true)
  })
})
