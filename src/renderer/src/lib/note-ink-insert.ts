import { format } from 'date-fns'
import i18n from 'i18next'
import { NOTE_INK_CONTENT_TYPE, type NoteInkDocument } from '@shared/note-ink-document'
import { noteAttachmentMediaUrl } from '@shared/note-attachment-media-url'
import { arrayBufferToBase64 } from '@/lib/attachment-files'
import { findPngAttachmentForInkJson } from '@/lib/note-ink-load'
import { buildNoteInkInsertHtml, strokesToPngBlob } from '@/lib/note-ink-export'

function utf8StringToBase64(text: string): string {
  return arrayBufferToBase64(new TextEncoder().encode(text).buffer as ArrayBuffer)
}

async function blobToBase64(blob: Blob): Promise<string> {
  return arrayBufferToBase64(await blob.arrayBuffer())
}

export function buildInkAttachmentBaseName(at = new Date()): string {
  const stamp = format(at, 'yyyy-MM-dd HH-mm')
  return `${i18n.t('notes.ink.defaultName')} ${stamp}`
}

async function saveInkDrawingAttachments(
  noteId: number,
  document: NoteInkDocument,
  baseName = buildInkAttachmentBaseName()
): Promise<{ inkAttachmentId: number; imageSrc: string }> {
  const pngBlob = await strokesToPngBlob(document.strokes, document.canvasWidth, document.canvasHeight)
  const inkJson = JSON.stringify(document)
  const inkJsonBytes = new TextEncoder().encode(inkJson)

  const pngAttachment = await window.mailClient.notes.attachments.addLocal({
    noteId,
    name: `${baseName}.png`,
    contentType: 'image/png',
    dataBase64: await blobToBase64(pngBlob),
    size: pngBlob.size
  })

  const inkAttachment = await window.mailClient.notes.attachments.addLocal({
    noteId,
    name: `${baseName}.ink.json`,
    contentType: NOTE_INK_CONTENT_TYPE,
    dataBase64: utf8StringToBase64(inkJson),
    size: inkJsonBytes.length
  })

  return {
    inkAttachmentId: inkAttachment.id,
    imageSrc: noteAttachmentMediaUrl(noteId, pngAttachment.id)
  }
}

export async function appendInkDrawingToNote(
  noteId: number,
  document: NoteInkDocument,
  insertHtml: (html: string) => void
): Promise<void> {
  if (document.strokes.length === 0) {
    throw new Error(i18n.t('notes.ink.emptyInsert'))
  }

  const { inkAttachmentId, imageSrc } = await saveInkDrawingAttachments(noteId, document)
  insertHtml(buildNoteInkInsertHtml(imageSrc, inkAttachmentId))
}

export async function replaceInkDrawingInNote(
  noteId: number,
  inkJsonAttachmentId: number,
  document: NoteInkDocument,
  replaceInkSnapshot: (inkJsonAttachmentId: number, html: string) => void
): Promise<void> {
  if (document.strokes.length === 0) {
    throw new Error(i18n.t('notes.ink.emptyInsert'))
  }

  const attachments = await window.mailClient.notes.attachments.list(noteId)
  const inkAttachment = attachments.find((att) => att.id === inkJsonAttachmentId)
  if (!inkAttachment) {
    throw new Error(i18n.t('notes.ink.missingSource'))
  }

  const pngAttachment = findPngAttachmentForInkJson(inkAttachment, attachments)
  await window.mailClient.notes.attachments.remove({ noteId, attachmentId: inkJsonAttachmentId })
  if (pngAttachment) {
    await window.mailClient.notes.attachments.remove({ noteId, attachmentId: pngAttachment.id })
  }

  const baseName = inkAttachment.name.replace(/\.ink\.json$/i, '')
  const { inkAttachmentId, imageSrc } = await saveInkDrawingAttachments(noteId, document, baseName)
  replaceInkSnapshot(inkJsonAttachmentId, buildNoteInkInsertHtml(imageSrc, inkAttachmentId))
}
