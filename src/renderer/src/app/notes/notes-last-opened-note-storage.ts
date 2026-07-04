import { readNotesSettingsPrefs } from '@/lib/notes-settings-prefs'

const KEY = 'mailclient.notes.lastOpenedNoteId.v1'

export function readLastOpenedNoteId(): number | null {
  if (!readNotesSettingsPrefs().rememberLastOpenNote) return null
  try {
    const raw = window.localStorage.getItem(KEY)?.trim()
    if (!raw) return null
    const id = Number(raw)
    if (!Number.isFinite(id) || id <= 0) return null
    return Math.trunc(id)
  } catch {
    return null
  }
}

export function persistLastOpenedNoteId(noteId: number | null): void {
  try {
    if (noteId == null) {
      window.localStorage.removeItem(KEY)
      return
    }
    window.localStorage.setItem(KEY, String(noteId))
  } catch {
    // ignore
  }
}

export function clearLastOpenedNoteIdIfMatches(noteId: number): void {
  if (readLastOpenedNoteId() === noteId) {
    persistLastOpenedNoteId(null)
  }
}
