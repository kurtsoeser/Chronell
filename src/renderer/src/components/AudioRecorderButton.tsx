import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import fixWebmDuration from 'fix-webm-duration'
import { Loader2, Mic, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { extensionForAudioMime } from '@shared/note-audio-quality'
import { resolveNoteAudioRecordingOptions } from '@/lib/note-audio-recording'
import { readNotesSettingsPrefs } from '@/lib/notes-settings-prefs'
import { cn } from '@/lib/utils'

export interface AudioRecorderPayload {
  name: string
  contentType: string
  size: number
  blob: Blob
}

export function AudioRecorderButton({
  disabled,
  onError,
  onRecorded,
  compact,
  inEditorSurface
}: {
  disabled?: boolean
  onError?: (message: string) => void
  onRecorded: (payload: AudioRecorderPayload) => void | Promise<void>
  compact?: boolean
  inEditorSurface?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef<number | null>(null)

  const stopStream = useCallback((): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopRecording = useCallback((): void => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else stopStream()
    setRecording(false)
  }, [stopStream])

  useEffect(() => {
    return (): void => {
      stopRecording()
    }
  }, [stopRecording])

  const startRecording = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      const { audioRecordingQuality } = readNotesSettingsPrefs()
      const recordingOptions = resolveNoteAudioRecordingOptions(audioRecordingQuality)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: recordingOptions.mediaConstraints
      })
      streamRef.current = stream

      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, recordingOptions.recorderOptions)
      } catch {
        recorder = recordingOptions.mimeType
          ? new MediaRecorder(stream, { mimeType: recordingOptions.mimeType })
          : new MediaRecorder(stream)
      }
      recorderRef.current = recorder
      chunksRef.current = []

      const mimeType = recordingOptions.mimeType

      recorder.ondataavailable = (event): void => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = (): void => {
        void (async (): Promise<void> => {
          try {
            const type = recorder.mimeType || mimeType || 'audio/webm'
            let blob = new Blob(chunksRef.current, { type })
            if (!blob.size) return
            if (type.includes('webm') && startedAtRef.current != null) {
              const durationMs = Math.max(0, Date.now() - startedAtRef.current)
              blob = await fixWebmDuration(blob, durationMs, { logger: false })
            }
            const ext = extensionForAudioMime(type)
            const name = `${t('notes.audio.defaultName')} ${format(new Date(), 'yyyy-MM-dd HH-mm')}.${ext}`
            await onRecorded({
              name,
              contentType: type,
              size: blob.size,
              blob
            })
          } catch (e) {
            onError?.(e instanceof Error ? e.message : String(e))
          } finally {
            stopStream()
            recorderRef.current = null
            chunksRef.current = []
            setBusy(false)
            setElapsedSec(0)
            startedAtRef.current = null
          }
        })()
      }

      recorder.start(250)
      startedAtRef.current = Date.now()
      setRecording(true)
      setElapsedSec(0)
      timerRef.current = window.setInterval(() => setElapsedSec((s) => s + 1), 1000)
      setBusy(false)
    } catch (e) {
      stopStream()
      onError?.(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }, [onError, onRecorded, stopStream, t])

  const formatElapsed = (sec: number): string => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const buttonClass = cn(
    'inline-flex items-center gap-1 rounded-md border font-medium disabled:opacity-50',
    compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-2xs',
    inEditorSurface
      ? 'border-[hsl(var(--compose-surface-border)/0.55)] text-foreground hover:bg-[hsl(var(--compose-surface-border)/0.18)]'
      : 'border-border text-foreground hover:bg-secondary'
  )

  if (recording) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={stopRecording}
          className={cn(
            buttonClass,
            'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
          )}
        >
          <Square className="h-3 w-3 fill-current" />
          {t('notes.audio.stop')}
        </button>
        <span className={cn('tabular-nums text-muted-foreground', compact ? 'text-[10px]' : 'text-2xs')}>
          {formatElapsed(elapsedSec)}
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={(): void => void startRecording()}
      className={buttonClass}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
      {t('notes.audio.record')}
    </button>
  )
}
