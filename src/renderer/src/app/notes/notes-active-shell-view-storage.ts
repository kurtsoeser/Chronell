import { readNotesSettingsPrefs } from '@/lib/notes-settings-prefs'
import type { NotesShellView } from '@/app/notes/NotesShellViewToggle'

const KEY = 'mailclient.notes.activeShellView.v1'

export function readNotesActiveShellView(): NotesShellView {
  const settings = readNotesSettingsPrefs()
  if (settings.rememberLastShellView) {
    try {
      const raw = window.localStorage.getItem(KEY)?.trim()
      if (raw === 'list' || raw === 'calendar') return raw
    } catch {
      // ignore
    }
  }
  return settings.defaultShellView
}

export function persistNotesActiveShellView(view: NotesShellView): void {
  try {
    window.localStorage.setItem(KEY, view)
  } catch {
    // ignore
  }
}
