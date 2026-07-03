import { describe, expect, it } from 'vitest'
import { mergeInkColorPalette, normalizeInkHexColor } from './note-ink-colors'

describe('normalizeInkHexColor', () => {
  it('normalisiert 6-stellige Hex-Farben', () => {
    expect(normalizeInkHexColor('#AABBCC')).toBe('#aabbcc')
  })

  it('erweitert 3-stellige Hex-Farben', () => {
    expect(normalizeInkHexColor('#abc')).toBe('#aabbcc')
  })

  it('lehnt ungültige Werte ab', () => {
    expect(normalizeInkHexColor('red')).toBeNull()
    expect(normalizeInkHexColor('#gggggg')).toBeNull()
  })
})

describe('mergeInkColorPalette', () => {
  it('dedupliziert und hängt aktive Farbe an', () => {
    expect(
      mergeInkColorPalette(['#111827', '#2563eb'], ['#2563eb', '#dc2626'], '#facc15')
    ).toEqual(['#111827', '#2563eb', '#dc2626', '#facc15'])
  })
})
