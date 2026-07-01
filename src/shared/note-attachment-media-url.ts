/** Media-URL für lokale Notiz-Anhänge (Electron `note-media://` Protokoll). */
export function noteAttachmentMediaUrl(noteId: number, attachmentId: number): string {
  return `note-media://attachment/${noteId}/${attachmentId}`
}

export function normalizeAudioMimeForPlayback(mime: string): string {
  const trimmed = mime.trim()
  if (trimmed.toLowerCase().startsWith('audio/')) return trimmed
  return 'audio/webm'
}
