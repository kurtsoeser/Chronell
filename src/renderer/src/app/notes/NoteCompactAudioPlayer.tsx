import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Pause, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { noteAttachmentMediaUrl } from '@shared/note-attachment-media-url'
import {
  mergeAudioDurationKnown,
  probeAudioUrlDuration,
  readAudioElementDuration
} from '@shared/note-audio-playback'
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
  onError,
  compact = false
}: {
  noteId: number
  attachmentId: number
  className?: string
  onError?: (message: string) => void
  compact?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrubbingRef = useRef(false)
  const probedDurationRef = useRef(0)
  const durationSecRef = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const [scrubSec, setScrubSec] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mediaUrl = noteAttachmentMediaUrl(noteId, attachmentId)

  useEffect(() => {
    durationSecRef.current = durationSec
  }, [durationSec])

  const reportError = useCallback(
    (message: string): void => {
      setError(message)
      onError?.(message)
    },
    [onError]
  )

  const updateDuration = useCallback((...candidates: number[]): void => {
    setDurationSec((prev) => {
      const next = mergeAudioDurationKnown(prev, probedDurationRef.current, ...candidates)
      durationSecRef.current = next
      return next
    })
  }, [])

  const syncDuration = useCallback(
    (audio: HTMLAudioElement): void => {
      updateDuration(readAudioElementDuration(audio), audio.currentTime)
    },
    [updateDuration]
  )

  const syncCurrentTime = useCallback((audio: HTMLAudioElement): void => {
    if (scrubbingRef.current) return
    setCurrentSec(audio.currentTime)
  }, [])

  useEffect(() => {
    probedDurationRef.current = 0
    const controller = new AbortController()

    void (async (): Promise<void> => {
      try {
        const duration = await probeAudioUrlDuration(mediaUrl, controller.signal)
        if (controller.signal.aborted || duration <= 0) return
        probedDurationRef.current = duration
        updateDuration(duration)
      } catch {
        // Fallback auf HTMLAudioElement-Metadaten während der Wiedergabe.
      }
    })()

    return (): void => {
      controller.abort()
    }
  }, [mediaUrl, updateDuration])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    scrubbingRef.current = false
    setScrubbing(false)
    setLoading(true)
    setError(null)
    setPlaying(false)
    setCurrentSec(0)
    setScrubSec(0)
    setDurationSec(0)
    durationSecRef.current = 0

    const onLoadedMetadata = (): void => {
      syncDuration(audio)
      setLoading(false)
    }
    const onDurationChange = (): void => syncDuration(audio)
    const onLoadedData = (): void => syncDuration(audio)
    const onCanPlay = (): void => syncDuration(audio)
    const onProgress = (): void => syncDuration(audio)
    const onTimeUpdate = (): void => {
      syncCurrentTime(audio)
      syncDuration(audio)
    }
    const onPlay = (): void => setPlaying(true)
    const onPause = (): void => setPlaying(false)
    const onEnded = (): void => {
      setPlaying(false)
      updateDuration(audio.currentTime)
      setCurrentSec(audio.currentTime)
    }
    const onSeeked = (): void => {
      if (!scrubbingRef.current) setCurrentSec(audio.currentTime)
      syncDuration(audio)
    }
    const onAudioError = (): void => {
      setLoading(false)
      reportError(t('notes.attachments.playbackError'))
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('loadeddata', onLoadedData)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('progress', onProgress)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('error', onAudioError)

    audio.load()

    return (): void => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('loadeddata', onLoadedData)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('progress', onProgress)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('error', onAudioError)
    }
  }, [mediaUrl, reportError, syncCurrentTime, syncDuration, t, updateDuration])

  useEffect(() => {
    if (!playing || scrubbingRef.current) return
    let raf = 0
    const tick = (): void => {
      const audio = audioRef.current
      if (audio) {
        syncCurrentTime(audio)
        syncDuration(audio)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return (): void => cancelAnimationFrame(raf)
  }, [playing, syncCurrentTime, syncDuration])

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

  const commitSeek = useCallback((value: number): void => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(value)) return
    const max =
      durationSecRef.current > 0
        ? durationSecRef.current
        : readAudioElementDuration(audio)
    const next = max > 0 ? Math.min(Math.max(0, value), max) : Math.max(0, value)
    audio.currentTime = next
    setCurrentSec(next)
    setScrubSec(next)
    scrubbingRef.current = false
    setScrubbing(false)
  }, [])

  const beginScrub = useCallback((): void => {
    scrubbingRef.current = true
    setScrubbing(true)
    setScrubSec(currentSec)
  }, [currentSec])

  const updateScrub = useCallback((value: number): void => {
    if (!Number.isFinite(value)) return
    setScrubSec(value)
  }, [])

  if (error) {
    return (
      <div className={cn('flex items-center gap-1 text-2xs text-destructive', className)}>
        <AlertCircle className="h-3 w-3 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  const sliderMax = durationSec > 0 ? durationSec : 1
  const sliderValue = scrubbing ? scrubSec : currentSec
  const displaySec = scrubbing ? scrubSec : currentSec
  const canScrub = !loading && durationSec > 0

  return (
    <div
      className={cn(
        'grid min-w-0 items-center',
        compact ? 'grid-cols-[auto_minmax(0,1fr)_auto] gap-1' : 'grid-cols-[auto_minmax(0,1fr)_auto] gap-1.5',
        className
      )}
    >
      <audio ref={audioRef} src={mediaUrl} preload="auto" className="hidden" />
      <button
        type="button"
        disabled={loading}
        onClick={togglePlay}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-300',
          compact ? 'h-5 w-5' : 'h-6 w-6'
        )}
        aria-label={playing ? t('notes.audio.stop') : t('notes.attachments.playInline')}
        title={playing ? t('notes.audio.stop') : t('notes.attachments.playInline')}
      >
        {playing ? (
          <Pause className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
        ) : (
          <Play className={compact ? 'ml-0.5 h-2.5 w-2.5' : 'ml-0.5 h-3 w-3'} />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={sliderMax}
        step={0.05}
        value={Math.min(sliderValue, sliderMax)}
        disabled={!canScrub}
        onPointerDown={beginScrub}
        onInput={(e): void => updateScrub(Number(e.currentTarget.value))}
        onPointerUp={(e): void => commitSeek(Number(e.currentTarget.value))}
        onKeyUp={(e): void => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
            commitSeek(Number(e.currentTarget.value))
          }
        }}
        onBlur={(e): void => {
          if (scrubbingRef.current) commitSeek(Number(e.currentTarget.value))
        }}
        className="note-audio-scrubber h-1 w-full min-w-0 cursor-pointer accent-violet-600 disabled:cursor-default"
        aria-label={t('notes.attachments.playbackPosition')}
        aria-valuemin={0}
        aria-valuemax={durationSec > 0 ? durationSec : undefined}
        aria-valuenow={displaySec}
        aria-valuetext={
          durationSec > 0
            ? `${formatAudioTime(displaySec)} / ${formatAudioTime(durationSec)}`
            : formatAudioTime(displaySec)
        }
      />
      <span
        className={cn(
          'shrink-0 whitespace-nowrap text-right tabular-nums leading-none text-muted-foreground',
          compact ? 'text-[8px]' : 'text-[9px]'
        )}
      >
        {loading ? (
          '…'
        ) : durationSec > 0 ? (
          <>
            {formatAudioTime(displaySec)}
            <span className="text-muted-foreground/70">/{formatAudioTime(durationSec)}</span>
          </>
        ) : (
          formatAudioTime(displaySec)
        )}
      </span>
    </div>
  )
}
