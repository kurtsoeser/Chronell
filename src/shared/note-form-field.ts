export const NOTE_FORM_FIELD_ATTR = 'data-chronell-field'
export const NOTE_FORM_FIELD_VALUE_ATTR = 'data-value'
export const NOTE_FORM_FIELD_CLASS = 'chronell-note-field'
export const NOTE_FORM_FIELD_DATE_CLASS = 'chronell-note-field-date'
export const NOTE_FORM_FIELD_TIME_CLASS = 'chronell-note-field-time'

export type NoteFormFieldKind = 'date' | 'time'

/** DOMPurify-Whitelist für gespeicherte Feld-Spans. */
export const NOTE_FORM_FIELD_SANITIZE_ATTRS = [
  NOTE_FORM_FIELD_ATTR,
  NOTE_FORM_FIELD_VALUE_ATTR
] as const

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtmlAttr(text: string): string {
  return escapeHtmlText(text).replace(/"/g, '&quot;')
}

/** ISO-Datum `YYYY-MM-DD` → `dd.MM.yyyy` (Speicher-Fallback / FTS). */
export function formatNoteDateFieldStorageText(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd.trim()
  return `${m[3]}.${m[2]}.${m[1]}`
}

/** `HH:mm` für Speicher-Fallback / FTS. */
export function formatNoteTimeFieldStorageText(hm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return hm.trim()
  return `${m[1]!.padStart(2, '0')}:${m[2]}`
}

export function buildNoteDateFieldHtml(value = ''): string {
  const v = value.trim()
  const display = v ? formatNoteDateFieldStorageText(v) : ''
  return `<span class="${NOTE_FORM_FIELD_CLASS} ${NOTE_FORM_FIELD_DATE_CLASS}" ${NOTE_FORM_FIELD_ATTR}="date" ${NOTE_FORM_FIELD_VALUE_ATTR}="${escapeHtmlAttr(v)}" contenteditable="false">${escapeHtmlText(display)}</span>`
}

export function buildNoteTimeFieldHtml(value = ''): string {
  const v = value.trim()
  const display = v ? formatNoteTimeFieldStorageText(v) : ''
  return `<span class="${NOTE_FORM_FIELD_CLASS} ${NOTE_FORM_FIELD_TIME_CLASS}" ${NOTE_FORM_FIELD_ATTR}="time" ${NOTE_FORM_FIELD_VALUE_ATTR}="${escapeHtmlAttr(v)}" contenteditable="false">${escapeHtmlText(display)}</span>`
}
