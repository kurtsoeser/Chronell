import type { UserNoteListItem } from '@shared/types'
import { markdownPreviewText, notePreviewText } from '@/lib/note-body-html'

/** Vorschautext für Listen/Kalender — nutzt bodyPreview wenn der Body nicht geladen wurde. */
export function noteListPreviewText(note: UserNoteListItem): string {
  const preview = note.bodyPreview?.trim()
  if (preview) return preview
  return notePreviewText(note.body) || markdownPreviewText(note.body)
}
