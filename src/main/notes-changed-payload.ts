import type { NotesChangedPayload, NotesChangedScope } from '@shared/types'
import { getNoteListItemById } from './db/user-notes-repo'

/** Listeneintrag ohne Body für IPC-Delta-Broadcasts. */
export function noteListItemToChangedPatch(
  item: NonNullable<ReturnType<typeof getNoteListItemById>>
): NonNullable<NotesChangedPayload['patch']> {
  const { body: _body, ...rest } = item
  return { ...rest, body: '' }
}

export function buildNotesChangedPayload(
  noteId: number,
  scope: NotesChangedScope,
  options?: { deleted?: boolean }
): NotesChangedPayload {
  if (options?.deleted) {
    return { noteId, scope, deleted: true }
  }
  const item = getNoteListItemById(noteId, { omitBody: true })
  if (!item) {
    return { noteId, scope }
  }
  return {
    noteId,
    scope,
    kind: item.kind,
    patch: noteListItemToChangedPatch(item)
  }
}

export function emitNoteChanged(
  noteId: number,
  scope: NotesChangedScope,
  options?: { deleted?: boolean }
): NotesChangedPayload {
  return buildNotesChangedPayload(noteId, scope, options)
}
