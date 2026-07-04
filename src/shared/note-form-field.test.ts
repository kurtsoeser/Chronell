import { describe, expect, it } from 'vitest'
import {
  NOTE_FORM_FIELD_ATTR,
  NOTE_FORM_FIELD_VALUE_ATTR,
  buildNoteDateFieldHtml,
  buildNoteTimeFieldHtml,
  formatNoteDateFieldStorageText,
  formatNoteTimeFieldStorageText
} from './note-form-field'

describe('note-form-field', () => {
  it('formatNoteDateFieldStorageText formats ISO dates', () => {
    expect(formatNoteDateFieldStorageText('2026-07-04')).toBe('04.07.2026')
    expect(formatNoteDateFieldStorageText('')).toBe('')
  })

  it('formatNoteTimeFieldStorageText normalizes time', () => {
    expect(formatNoteTimeFieldStorageText('9:05')).toBe('09:05')
    expect(formatNoteTimeFieldStorageText('14:30')).toBe('14:30')
  })

  it('buildNoteDateFieldHtml emits parseable attributes', () => {
    const html = buildNoteDateFieldHtml('2026-07-04')
    expect(html).toContain(`${NOTE_FORM_FIELD_ATTR}="date"`)
    expect(html).toContain(`${NOTE_FORM_FIELD_VALUE_ATTR}="2026-07-04"`)
    expect(html).toContain('04.07.2026')
  })

  it('buildNoteTimeFieldHtml emits parseable attributes', () => {
    const html = buildNoteTimeFieldHtml('14:30')
    expect(html).toContain(`${NOTE_FORM_FIELD_ATTR}="time"`)
    expect(html).toContain(`${NOTE_FORM_FIELD_VALUE_ATTR}="14:30"`)
    expect(html).toContain('14:30')
  })

  it('buildNoteDateFieldHtml supports empty value', () => {
    const html = buildNoteDateFieldHtml('')
    expect(html).toContain(`${NOTE_FORM_FIELD_VALUE_ATTR}=""`)
    expect(html).not.toContain('04.07.2026')
  })
})
