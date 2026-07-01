export const NOTE_AUDIO_FILE_EXTENSIONS = [
  '.webm',
  '.ogg',
  '.oga',
  '.opus',
  '.mp3',
  '.m4a',
  '.wav',
  '.aac',
  '.flac'
] as const

export interface NoteAttachmentAudioProbe {
  kind: 'local' | 'cloud'
  name: string
  contentType: string | null
}

export function isPlayableAudioAttachment(att: NoteAttachmentAudioProbe): boolean {
  if (att.kind !== 'local') return false
  if (att.contentType?.startsWith('audio/')) return true
  const lower = att.name.trim().toLowerCase()
  return NOTE_AUDIO_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function resolveAudioContentType(att: NoteAttachmentAudioProbe): string {
  if (att.contentType?.startsWith('audio/')) return att.contentType
  const lower = att.name.trim().toLowerCase()
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.aac')) return 'audio/aac'
  if (lower.endsWith('.flac')) return 'audio/flac'
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg'
  if (lower.endsWith('.opus')) return 'audio/ogg; codecs=opus'
  return 'audio/webm'
}
