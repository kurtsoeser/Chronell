import type { NotesCalendarDateMode } from '@/app/calendar/notes-calendar'
import { readNotesSettingsPrefs } from '@/lib/notes-settings-prefs'

const KEY = 'mailclient.notes.calendarDateMode.v1'

export function readNotesCalendarDateMode(): NotesCalendarDateMode {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === 'scheduled') return 'scheduled'
    if (raw === 'created') return 'created'
  } catch {
    // ignore
  }
  return readNotesSettingsPrefs().defaultCalendarDateMode
}

export function persistNotesCalendarDateMode(mode: NotesCalendarDateMode): void {
  try {
    window.localStorage.setItem(KEY, mode)
  } catch {
    // ignore
  }
}
