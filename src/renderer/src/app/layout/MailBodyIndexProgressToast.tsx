import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { MailBodyIndexProgress } from '@shared/mail-body-index'
import { AnimatedToast } from '@/components/motion/AnimatedToast'
import {
  fetchMailBodyIndexStatus,
  subscribeMailBodyIndexProgress
} from '@/lib/mail-body-index-client'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

const TOAST_ID = -1

function progressTotals(progress: MailBodyIndexProgress): {
  done: number
  total: number
  pct: number
} {
  const total = progress.indexedThisSession + progress.pending
  const done =
    progress.indexedThisSession +
    (progress.active && progress.batchTotal > 0
      ? progress.batchCurrent / progress.batchTotal
      : 0)
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  return { done: Math.floor(done), total, pct }
}

/** Fortschritt der Hintergrund-Suchindexierung als Toast unten rechts. */
export function MailBodyIndexProgressToast(): JSX.Element | null {
  const { t } = useTranslation()
  const reducedMotion = usePrefersReducedMotion()
  const [progress, setProgress] = useState<MailBodyIndexProgress | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [dismissing, setDismissing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [userDismissed, setUserDismissed] = useState(false)
  const wasActiveRef = useRef(false)

  const active = enabled && progress != null && progress.pending > 0

  function requestDismiss(): void {
    setUserDismissed(true)
    if (reducedMotion) {
      setMounted(false)
      return
    }
    setDismissing(true)
  }

  useEffect(() => {
    void fetchMailBodyIndexStatus().then((s) => {
      setEnabled(s.enabled)
      setProgress(s.progress)
    })
    return subscribeMailBodyIndexProgress((next) => {
      setProgress(next)
      if (next == null) {
        void fetchMailBodyIndexStatus().then((s) => setEnabled(s.enabled))
      }
    })
  }, [])

  useEffect(() => {
    if (active) {
      wasActiveRef.current = true
      if (!userDismissed) {
        setMounted(true)
        setDismissing(false)
      }
      return
    }
    if (userDismissed) {
      wasActiveRef.current = false
      setUserDismissed(false)
      return
    }
    if (wasActiveRef.current && mounted) {
      if (reducedMotion) {
        setMounted(false)
        wasActiveRef.current = false
      } else {
        setDismissing(true)
      }
    }
  }, [active, mounted, reducedMotion, userDismissed])

  if (!mounted || !progress) return null

  const { done, total, pct } = progressTotals(progress)
  const label = t('mailBodyIndex.progressLabel', {
    done,
    total,
    pending: progress.pending
  })

  return (
    <AnimatedToast
      toastId={TOAST_ID}
      dismissing={dismissing}
      onExitComplete={(): void => {
        setMounted(false)
        setDismissing(false)
        if (!active) {
          wasActiveRef.current = false
          setUserDismissed(false)
        }
      }}
      className="chronell-acrylic-popover pointer-events-auto flex w-full flex-col gap-1.5 border-border px-3 py-2.5 text-xs"
    >
      <div className="flex items-start gap-2" role="status" aria-live="polite">
        {progress.active ? (
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-80" aria-hidden />
        )}
        <span className="min-w-0 flex-1 leading-snug text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
        <button
          type="button"
          onClick={requestDismiss}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('common.close')}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full bg-primary transition-[width] duration-300')}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={label}
        />
      </div>
    </AnimatedToast>
  )
}
