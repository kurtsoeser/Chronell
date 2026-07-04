import { describe, expect, it } from 'vitest'
import { noteSaveConflictDetected } from './note-save-conflict'

describe('noteSaveConflictDetected', () => {
  it('erkennt keine Konflikte bei gleichem Zeitstempel', () => {
    expect(noteSaveConflictDetected('2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z')).toBe(
      false
    )
  })

  it('erkennt Konflikte bei neuerem Remote-Zeitstempel', () => {
    expect(
      noteSaveConflictDetected('2026-01-01T10:00:00.000Z', '2026-01-01T10:05:00.000Z')
    ).toBe(true)
  })

  it('ignoriert ältere Remote-Änderungen', () => {
    expect(
      noteSaveConflictDetected('2026-01-01T10:05:00.000Z', '2026-01-01T10:00:00.000Z')
    ).toBe(false)
  })
})
