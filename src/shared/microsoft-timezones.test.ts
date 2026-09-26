import { describe, expect, it } from 'vitest'
import { graphWindowsZoneToIana, ianaToWindowsTimeZone } from './microsoft-timezones'

describe('microsoft-timezones', () => {
  it('maps Europe/Berlin to Graph Windows id and back', () => {
    expect(ianaToWindowsTimeZone('Europe/Berlin')).toBe('W. Europe Standard Time')
    expect(graphWindowsZoneToIana('W. Europe Standard Time')).toBe('Europe/Berlin')
  })

  it('passes through Windows ids instead of collapsing them to UTC', () => {
    expect(ianaToWindowsTimeZone('W. Europe Standard Time')).toBe('W. Europe Standard Time')
    expect(ianaToWindowsTimeZone('Romance Standard Time')).toBe('Romance Standard Time')
  })

  it('keeps UTC stable', () => {
    expect(ianaToWindowsTimeZone('UTC')).toBe('UTC')
    expect(graphWindowsZoneToIana('UTC')).toBe('UTC')
  })
})
