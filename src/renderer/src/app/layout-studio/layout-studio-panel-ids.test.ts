// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import {
  isLayoutStudioPanelId,
  parseDashboardTileIdFromPanel,
  tilePanelId
} from './layout-studio-panel-ids'

describe('layout-studio-panel-ids', () => {
  it('erkennt Kachel-Panels', () => {
    const id = tilePanelId('inbox')
    expect(isLayoutStudioPanelId(id)).toBe(true)
    expect(parseDashboardTileIdFromPanel(id)).toBe('inbox')
  })

  it('erkennt Kalender-Wochen-Panel', () => {
    expect(isLayoutStudioPanelId('calendarWeek')).toBe(true)
    expect(isLayoutStudioPanelId('calendarWeekFull')).toBe(true)
    expect(isLayoutStudioPanelId('calendarMonthFull')).toBe(true)
  })

  it('erkennt Kontext-Vorschau-Panel', () => {
    expect(isLayoutStudioPanelId('contextPreview')).toBe(true)
    expect(isLayoutStudioPanelId('eventPreview')).toBe(true)
  })

  it('lehnt unbekannte Panels ab', () => {
    expect(isLayoutStudioPanelId('tile:unknown')).toBe(false)
    expect(isLayoutStudioPanelId('nope')).toBe(false)
  })
})
