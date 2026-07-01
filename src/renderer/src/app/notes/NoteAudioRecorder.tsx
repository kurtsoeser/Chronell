import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Loader2, Mic, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  extensionForAudioMime
} from '@shared/note-audio-quality'
import { resolveNoteAudioRecordingOptions } from '@/lib/note-audio-recording'
import { readNotesSettingsPrefs } from '@/lib/notes-settings-prefs'
import { cn } from '@/lib/utils'

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = (): void => reject(reader.error ?? new Error('Aufnahme konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

export function NoteAudioRecorder({
  noteId,
  disabled,
  onError
}: {
  noteId: number
  disabled?: boolean
  onError?: (message: string) => void
}): JSX.Element {
  const { t } = useTranslation()
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

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
            const blob = new Blob(chunksRef.current, { type })
            if (!blob.size) return
            const dataBase64 = await blobToBase64(blob)
            const ext = extensionForAudioMime(type)
            const name = `${t('notes.audio.defaultName')} ${format(new Date(), 'yyyy-MM-dd HH-mm')}.${ext}`
            await window.mailClient.notes.attachments.addLocal({
              noteId,
              name,
              contentType: type,
              size: blob.size,
              dataBase64
            })
          } catch (e) {
            onError?.(e instanceof Error ? e.message : String(e))
          } finally {
            stopStream()
            recorderRef.current = null
            chunksRef.current = []
            setBusy(false)
            setElapsedSec(0)
          }
        })()
      }

      recorder.start(250)
      setRecording(true)
      setElapsedSec(0)
      timerRef.current = window.setInterval(() => setElapsedSec((s) => s + 1), 1000)
      setBusy(false)
    } catch (e) {
      stopStream()
      onError?.(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }, [noteId, onError, stopStream, t])

  const formatElapsed = (sec: number): string => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  if (recording) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={stopRecording}
          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-2xs font-medium text-destructive hover:bg-destructive/15"
        >
          <Square className="h-3 w-3 fill-current" />
          {t('notes.audio.stop')}
        </button>
        <span className="text-2xs tabular-nums text-muted-foreground">{formatElapsed(elapsedSec)}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={(): void => void startRecording()}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary disabled:opacity-50'
      )}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
      {t('notes.audio.record')}
    </button>
  )
}
