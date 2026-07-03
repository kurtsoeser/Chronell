import {
  NOTE_INK_CONTENT_TYPE,
  parseNoteInkDocument,
  type NoteInkDocument
} from '@shared/note-ink-document'
import type { UserNoteAttachment } from '@shared/types'

function base64ToUtf8(dataBase64: string): string {
  const binary = atob(dataBase64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function pngAttachmentNameForInkJson(inkJsonName: string): string {
  return inkJsonName.replace(/\.ink\.json$/i, '.png')
}

export function findPngAttachmentForInkJson(
  inkJsonAttachment: UserNoteAttachment,
  attachments: UserNoteAttachment[]
): UserNoteAttachment | null {
  const expectedName = pngAttachmentNameForInkJson(inkJsonAttachment.name)
  return (
    attachments.find(
      (att) =>
        att.kind === 'local' &&
        att.id !== inkJsonAttachment.id &&
        att.name === expectedName
    ) ?? null
  )
}

export async function loadInkDocumentFromAttachment(
  noteId: number,
  inkJsonAttachmentId: number
): Promise<NoteInkDocument> {
  const res = await window.mailClient.notes.attachments.readLocal({
    noteId,
    attachmentId: inkJsonAttachmentId
  })
  if (!res.ok) {
    throw new Error(res.error)
  }
  if (res.contentType !== NOTE_INK_CONTENT_TYPE) {
    throw new Error('Anhang ist keine Freihand-Quelldatei.')
  }
  return parseNoteInkDocument(base64ToUtf8(res.dataBase64))
}
