import { describe, expect, it } from 'vitest'
import { formatNoteSaveTime } from './note-editor-save-status'

describe('formatNoteSaveTime', () => {
  it('formatiert SQLite-UTC in Kalender-Zeitzone', () => {
    expect(formatNoteSaveTime('2026-07-04 11:26:00', 'Europe/Vienna', 'de')).toBe('04.07.2026 13:26')
  })
})
