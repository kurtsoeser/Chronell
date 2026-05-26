import {
  readNotesSettingsPrefs,
  type NotesLinkedPreviewPlacement
} from '@/lib/notes-settings-prefs'

export type { NotesLinkedPreviewPlacement }

export const NOTES_LINKED_PREVIEW_OPEN_KEY = 'mailclient.notesShell.linkedPreviewOpen'
export const NOTES_LINKED_PREVIEW_PLACEMENT_KEY = 'mailclient.notesShell.linkedPreviewPlacement'
export const NOTES_FLOAT_PREVIEW_SIZE_KEY = 'mailclient.notesShell.floatPreviewSize'

export function readNotesLinkedPreviewOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(NOTES_LINKED_PREVIEW_OPEN_KEY)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {
    // ignore
  }
  return readNotesSettingsPrefs().defaultLinkedPreviewOpen
}

export function persistNotesLinkedPreviewOpen(open: boolean): void {
  try {
    window.localStorage.setItem(NOTES_LINKED_PREVIEW_OPEN_KEY, open ? '1' : '0')
  } catch {
    // ignore
  }
}

export function readNotesLinkedPreviewPlacement(): NotesLinkedPreviewPlacement {
  try {
    const v = window.localStorage.getItem(NOTES_LINKED_PREVIEW_PLACEMENT_KEY)
    if (v === 'float' || v === 'dock') return v
  } catch {
    // ignore
  }
  return readNotesSettingsPrefs().defaultLinkedPreviewPlacement
}

export function persistNotesLinkedPreviewPlacement(placement: NotesLinkedPreviewPlacement): void {
  try {
    window.localStorage.setItem(NOTES_LINKED_PREVIEW_PLACEMENT_KEY, placement)
  } catch {
    // ignore
  }
}
