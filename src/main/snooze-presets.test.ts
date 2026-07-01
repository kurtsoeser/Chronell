import { describe, expect, it } from 'vitest'
import { computeRuleSnoozeWakeAt } from './snooze-presets'

describe('computeRuleSnoozeWakeAt', () => {
  const fixedNow = new Date('2026-06-15T14:00:00.000Z')

  it('in-1-hour addiert eine Stunde', () => {
    const iso = computeRuleSnoozeWakeAt('in-1-hour', fixedNow)
    expect(iso).toBe(new Date(fixedNow.getTime() + 60 * 60 * 1000).toISOString())
  })

  it('tomorrow-morning liegt nach fixedNow', () => {
    const iso = computeRuleSnoozeWakeAt('tomorrow-morning', fixedNow)
    expect(iso).toBeTruthy()
    expect(new Date(iso!).getTime()).toBeGreaterThan(fixedNow.getTime())
  })

  it('this-evening liefert null wenn bereits nach 18:00', () => {
    const late = new Date('2026-06-15T19:00:00.000Z')
    expect(computeRuleSnoozeWakeAt('this-evening', late)).toBeNull()
  })
})
