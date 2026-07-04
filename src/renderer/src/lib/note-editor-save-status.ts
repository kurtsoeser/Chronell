import { formatCalendarEventWhenLabel, storedTimestampToUtcIso } from '@shared/calendar-datetime'

export type NoteEditorSaveStatus =
  | 'idle'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'error'
  | 'conflict'

export type NoteEditorSaveStatusDisplay = {
  timeZone: string
  localeCode: 'de' | 'en'
}

export function formatNoteSaveTime(
  storedAt: string,
  timeZone: string,
  localeCode: 'de' | 'en'
): string {
  const utcIso = storedTimestampToUtcIso(storedAt)
  if (!utcIso) return storedAt
  return formatCalendarEventWhenLabel(utcIso, timeZone, localeCode, false) ?? storedAt
}

export function noteEditorSaveStatusLabel(
  status: NoteEditorSaveStatus,
  t: (key: string, options?: Record<string, unknown>) => string,
  lastSavedAt?: string | null,
  display?: NoteEditorSaveStatusDisplay
): string | null {
  switch (status) {
    case 'saving':
      return t('notes.editor.saving')
    case 'saved':
      return lastSavedAt && display
        ? t('notes.editor.updatedAt', {
            date: formatNoteSaveTime(lastSavedAt, display.timeZone, display.localeCode)
          })
        : lastSavedAt
          ? t('notes.editor.saved')
          : t('notes.editor.saved')
    case 'unsaved':
      return t('notes.editor.notSaved')
    case 'error':
      return t('notes.editor.saveFailed')
    case 'conflict':
      return t('notes.editor.conflict')
    default:
      return null
  }
}
