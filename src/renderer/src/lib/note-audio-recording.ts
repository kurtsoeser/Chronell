import {
  getNoteAudioQualityPreset,
  type NoteAudioQualityPreset,
  type NoteAudioRecordingQuality
} from '@shared/note-audio-quality'

function pickAudioMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

export interface NoteAudioRecordingOptions {
  preset: NoteAudioQualityPreset
  mimeType?: string
  mediaConstraints: MediaTrackConstraints
  recorderOptions: MediaRecorderOptions
}

export function resolveNoteAudioRecordingOptions(
  quality: NoteAudioRecordingQuality
): NoteAudioRecordingOptions {
  const preset = getNoteAudioQualityPreset(quality)
  const mimeType = pickAudioMimeType()
  const recorderOptions: MediaRecorderOptions = {
    audioBitsPerSecond: preset.audioBitsPerSecond
  }
  if (mimeType) recorderOptions.mimeType = mimeType

  return {
    preset,
    mimeType,
    mediaConstraints: {
      channelCount: preset.channelCount,
      sampleRate: preset.sampleRate,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    recorderOptions
  }
}
