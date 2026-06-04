// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { applyLayoutStudioPreset } from './layout-studio-presets'

describe('layout-studio-presets', () => {
  it('focusMail liefert Mail-Liste, Vorschau und Kontext-Leiste', () => {
    const cols = applyLayoutStudioPreset('focusMail')
    expect(cols.map((c) => c.panel)).toEqual(['mailList', 'reading', 'contextSidebar'])
  })

  it('startAgenda liefert zwei Spalten', () => {
    const cols = applyLayoutStudioPreset('startAgenda')
    expect(cols).toHaveLength(2)
    expect(cols.map((c) => c.panel)).toEqual(['startDashboard', 'agenda'])
  })
})
