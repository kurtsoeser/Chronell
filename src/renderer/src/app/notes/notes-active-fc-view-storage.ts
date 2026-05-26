import {
  isValidNotesCalendarFcView,
  readNotesSettingsPrefs
} from '@/lib/notes-settings-prefs'

const KEY = 'mailclient.notes.activeFcView.v1'

export function readNotesActiveFcView(): string {
  const settings = readNotesSettingsPrefs()
  if (settings.rememberLastCalendarFcView) {
    try {
      const raw = window.localStorage.getItem(KEY)?.trim()
      if (raw && isValidNotesCalendarFcView(raw)) return raw
    } catch {
      // ignore
    }
  }
  return settings.defaultCalendarFcView
}

export function persistNotesActiveFcView(viewId: string): void {
  if (!isValidNotesCalendarFcView(viewId)) return
  try {
    window.localStorage.setItem(KEY, viewId)
  } catch {
    // ignore
  }
}
