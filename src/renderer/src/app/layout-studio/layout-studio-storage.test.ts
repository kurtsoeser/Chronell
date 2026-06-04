// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest'
import {
  LAYOUT_STUDIO_DEFAULT_COLUMNS,
  LAYOUT_STUDIO_STORAGE_KEY,
  readLayoutStudioColumns,
  writeLayoutStudioColumns
} from './layout-studio-storage'

describe('layout-studio-storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('liefert Standard-Spalten ohne gespeicherten Zustand', () => {
    const cols = readLayoutStudioColumns()
    expect(cols.length).toBe(LAYOUT_STUDIO_DEFAULT_COLUMNS.length)
    expect(cols.map((c) => c.panel)).toEqual(LAYOUT_STUDIO_DEFAULT_COLUMNS.map((c) => c.panel))
  })

  it('persistiert und liest Spaltenkonfiguration', () => {
    writeLayoutStudioColumns([
      { id: 'a', panel: 'agenda', widthPx: 280 },
      { id: 'b', panel: 'reading', widthPx: 400 }
    ])
    const raw = window.localStorage.getItem(LAYOUT_STUDIO_STORAGE_KEY)
    expect(raw).toBeTruthy()
    const read = readLayoutStudioColumns()
    expect(read).toHaveLength(2)
    expect(read[0]?.panel).toBe('agenda')
    expect(read[1]?.widthPx).toBe(400)
  })
})
