import { describe, expect, it } from 'vitest'
import {
  calendarMenuPresetDisplayHex,
  calendarMenuPresetOutlookSyncColor,
  findExtendedPresetByHex,
  graphCalendarColorToDisplayHex,
  isCalendarColorMenuPreset,
  resolveCalendarDisplayHex,
  resolveCalendarMenuPresetId
} from './graph-calendar-colors'

describe('resolveCalendarDisplayHex', () => {
  it('prefers local override over provider hex', () => {
    expect(
      resolveCalendarDisplayHex({
        hexColor: '#4A86E8',
        color: 'lightBlue',
        displayColorOverrideHex: '#AB47BC'
      })
    ).toBe('#AB47BC')
  })

  it('falls back to hex then enum', () => {
    expect(resolveCalendarDisplayHex({ hexColor: '#ff00aa', color: 'lightBlue' })).toBe('#ff00aa')
    expect(resolveCalendarDisplayHex({ hexColor: null, color: 'lightPink' })).toBe(
      graphCalendarColorToDisplayHex(null, 'lightPink')
    )
  })
})

describe('calendar extended colors', () => {
  it('kennt erweiterte Presets im Menue', () => {
    expect(isCalendarColorMenuPreset('extIndigo')).toBe(true)
    expect(calendarMenuPresetDisplayHex('extIndigo')).toBe('#5C6BC0')
    expect(calendarMenuPresetOutlookSyncColor('extIndigo')).toBe('lightBlue')
  })

  it('loest Override auf erweitertes Preset auf', () => {
    expect(findExtendedPresetByHex('#8E24AA')).toBe('extPurple')
    expect(
      resolveCalendarMenuPresetId({
        color: 'lightBlue',
        displayColorOverrideHex: '#8E24AA'
      })
    ).toBe('extPurple')
  })
})
