import { describe, expect, it } from 'vitest'
import type { AppConfig } from './types'
import {
  isAccountProfileAvatarEnabled,
  isContactPhotoAvatarEnabled,
  isGravatarEnabled,
  isSenderDomainAvatarEnabled,
  normalizeAvatarPreferencesPatch
} from './avatar-preferences'

const base = {} as AppConfig

describe('avatar preferences', () => {
  it('gravatar ist opt-in', () => {
    expect(isGravatarEnabled(null)).toBe(false)
    expect(isGravatarEnabled({ ...base, gravatarEnabled: true })).toBe(true)
  })

  it('lokale Quellen sind standardmaessig an', () => {
    expect(isContactPhotoAvatarEnabled(null)).toBe(true)
    expect(isSenderDomainAvatarEnabled(null)).toBe(true)
    expect(isAccountProfileAvatarEnabled(null)).toBe(true)
  })

  it('lokale Quellen lassen sich abschalten', () => {
    expect(isContactPhotoAvatarEnabled({ ...base, contactPhotoAvatarEnabled: false })).toBe(false)
    expect(isSenderDomainAvatarEnabled({ ...base, senderDomainAvatarEnabled: false })).toBe(false)
    expect(isAccountProfileAvatarEnabled({ ...base, accountProfileAvatarEnabled: false })).toBe(false)
  })

  it('normalisiert Patch-Objekte', () => {
    expect(
      normalizeAvatarPreferencesPatch({
        gravatarEnabled: 1,
        contactPhotoAvatarEnabled: 0,
        unknown: true
      })
    ).toEqual({
      gravatarEnabled: true,
      contactPhotoAvatarEnabled: false
    })
  })
})
