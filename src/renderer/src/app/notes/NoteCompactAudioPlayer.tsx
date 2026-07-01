import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Pause, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { noteAttachmentMediaUrl } from '@shared/note-attachment-media-url'
import { cn } from '@/lib/utils'

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function NoteCompactAudioPlayer({
  noteId,
  attachmentId,
  className,
  onError
}: {
  noteId: number
  attachmentId: number
  className?: string
  onError?: (message: string) => void
}): JSX.Element {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mediaUrl = noteAttachmentMediaUrl(noteId, attachmentId)

  const reportError = useCallback(
    (message: string): void => {
      setError(message)
      onError?.(message)
    },
    [onError]
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    setLoading(true)
    setError(null)
    setPlaying(false)
    setCurrentSec(0)
    setDurationSec(0)

    const onLoadedMetadata = (): void => {
      setDurationSec(Number.isFinite(audio.duration) ? audio.duration : 0)
      setLoading(false)
    }
    const onTimeUpdate = (): void => setCurrentSec(audio.currentTime)
    const onPlay = (): void => setPlaying(true)
    const onPause = (): void => setPlaying(false)
    const onEnded = (): void => setPlaying(false)
    const onAudioError = (): void => {
      setLoading(false)
      reportError(t('notes.attachments.playbackError'))
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onAudioError)

    audio.load()

    return (): void => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onAudioError)
    }
  }, [mediaUrl, reportError, t])

  const togglePlay = useCallback((): void => {
    const audio = audioRef.current
    if (!audio || error) return
    if (audio.paused) {
      void audio.play().catch(() => {
        reportError(t('notes.attachments.playbackError'))
      })
      return
    }
    audio.pause()
  }, [error, reportError, t])

  const handleSeek = useCallback((value: number): void => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(value)) return
    audio.currentTime = value
    setCurrentSec(value)
  }, [])

  if (error) {
    return (
      <div className={cn('flex items-center gap-1 text-2xs text-destructive', className)}>
        <AlertCircle className="h-3 w-3 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <audio ref={audioRef} src={mediaUrl} preload="metadata" className="hidden" />
      <button
        type="button"
        disabled={loading}
        onClick={togglePlay}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-300"
        aria-label={playing ? t('notes.audio.stop') : t('notes.attachments.playInline')}
        title={playing ? t('notes.audio.stop') : t('notes.attachments.playInline')}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="ml-0.5 h-3 w-3" />}
      </button>
      <input
        type="range"
        min={0}
        max={durationSec > 0 ? durationSec : 0}
        step={0.05}
        value={Math.min(currentSec, durationSec || 0)}
        disabled={loading || durationSec <= 0}
        onChange={(e): void => handleSeek(Number(e.target.value))}
        className="note-audio-scrubber h-1 min-w-0 flex-1 cursor-pointer accent-violet-600"
        aria-label={t('notes.attachments.playbackPosition')}
      />
      <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {loading ? '…' : formatAudioTime(currentSec)}
      </span>
    </div>
  )
}
