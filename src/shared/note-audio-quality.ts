export type NoteAudioRecordingQuality = 'compact' | 'standard' | 'high' | 'maximum'

export const NOTE_AUDIO_RECORDING_QUALITIES: NoteAudioRecordingQuality[] = [
  'compact',
  'standard',
  'high',
  'maximum'
]

export interface NoteAudioQualityPreset {
  id: NoteAudioRecordingQuality
  audioBitsPerSecond: number
  channelCount: 1 | 2
  sampleRate: number
}

export const NOTE_AUDIO_QUALITY_PRESETS: Record<NoteAudioRecordingQuality, NoteAudioQualityPreset> = {
  compact: {
    id: 'compact',
    audioBitsPerSecond: 32_000,
    channelCount: 1,
    sampleRate: 16_000
  },
  standard: {
    id: 'standard',
    audioBitsPerSecond: 64_000,
    channelCount: 1,
    sampleRate: 24_000
  },
  high: {
    id: 'high',
    audioBitsPerSecond: 128_000,
    channelCount: 2,
    sampleRate: 44_100
  },
  maximum: {
    id: 'maximum',
    audioBitsPerSecond: 192_000,
    channelCount: 2,
    sampleRate: 48_000
  }
}

export const DEFAULT_NOTE_AUDIO_RECORDING_QUALITY: NoteAudioRecordingQuality = 'standard'

export function isNoteAudioRecordingQuality(raw: unknown): raw is NoteAudioRecordingQuality {
  return typeof raw === 'string' && NOTE_AUDIO_RECORDING_QUALITIES.includes(raw as NoteAudioRecordingQuality)
}

export function normalizeNoteAudioRecordingQuality(
  raw: unknown,
  fallback: NoteAudioRecordingQuality = DEFAULT_NOTE_AUDIO_RECORDING_QUALITY
): NoteAudioRecordingQuality {
  return isNoteAudioRecordingQuality(raw) ? raw : fallback
}

export function getNoteAudioQualityPreset(
  quality: NoteAudioRecordingQuality
): NoteAudioQualityPreset {
  return NOTE_AUDIO_QUALITY_PRESETS[quality]
}

export function extensionForAudioMime(mime: string): string {
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp4')) return 'm4a'
  return 'webm'
}
