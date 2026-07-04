import { normalizeNoteBodyForStorage, noteBodiesEqual } from '@/lib/note-body-html'
import type { UserNote } from '@shared/types'

export const NOTES_AUTOSAVE_DEBOUNCE_MS = 800

/** Debounce für Verknüpfungs-Panel: HTML-Parsing nur nach Pause im Tippen. */
export const NOTES_LINKS_BODY_DEBOUNCE_MS = 1000

export type NoteScheduleDraft = {
  scheduledStartIso: string | null
  scheduledEndIso: string | null
  scheduledAllDay: boolean
  clearSchedule?: boolean
}

export function noteScheduleDraftHasChanges(
  draft: NoteScheduleDraft | null,
  note: Pick<UserNote, 'scheduledStartIso' | 'scheduledEndIso' | 'scheduledAllDay'>
): boolean {
  if (!draft) return false
  if (draft.clearSchedule) return Boolean(note.scheduledStartIso)
  return (
    draft.scheduledStartIso !== note.scheduledStartIso ||
    draft.scheduledEndIso !== note.scheduledEndIso ||
    draft.scheduledAllDay !== note.scheduledAllDay
  )
}

export function noteEditingHasUnsavedChanges(input: {
  editTitle: string
  editBodyHtml: string
  lastSavedTitle: string
  lastSavedBody: string
  scheduleDraft: NoteScheduleDraft | null
  note: Pick<UserNote, 'scheduledStartIso' | 'scheduledEndIso' | 'scheduledAllDay'>
}): boolean {
  if (input.editTitle !== input.lastSavedTitle) return true
  const stored = normalizeNoteBodyForStorage(input.editBodyHtml)
  if (!noteBodiesEqual(stored, input.lastSavedBody)) return true
  return noteScheduleDraftHasChanges(input.scheduleDraft, input.note)
}
