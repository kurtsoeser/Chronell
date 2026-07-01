import { describe, expect, it } from 'vitest'
import { noteEditingHasUnsavedChanges } from './notes-autosave'

describe('noteEditingHasUnsavedChanges', () => {
  const base = {
    editTitle: 'Titel',
    editBodyHtml: '<p>Text</p>',
    lastSavedTitle: 'Titel',
    lastSavedBody: '<p>Text</p>',
    scheduleDraft: null,
    note: {
      scheduledStartIso: null,
      scheduledEndIso: null,
      scheduledAllDay: false
    }
  }

  it('erkennt Titeländerung', () => {
    expect(
      noteEditingHasUnsavedChanges({ ...base, editTitle: 'Neu' })
    ).toBe(true)
  })

  it('erkennt Planungsänderung', () => {
    expect(
      noteEditingHasUnsavedChanges({
        ...base,
        scheduleDraft: {
          scheduledStartIso: '2026-07-01T10:00:00.000Z',
          scheduledEndIso: '2026-07-01T11:00:00.000Z',
          scheduledAllDay: false
        }
      })
    ).toBe(true)
  })
})
