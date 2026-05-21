import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MailBodyIndexProgress } from '@shared/mail-body-index'
import {
  fetchMailBodyIndexStatus,
  subscribeMailBodyIndexProgress
} from '@/lib/mail-body-index-client'

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

export function MailBodyIndexProgressBar(): JSX.Element | null {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<MailBodyIndexProgress | null>(null)
  const [enabled, setEnabled] = useState(true)

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

  if (!enabled || !progress || progress.pending <= 0) return null

  const { done, total, pct } = progressTotals(progress)

  return (
    <div
      className="border-b border-border/60 bg-muted/20 px-3 py-1.5 sm:px-4"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[48rem] items-center gap-2 text-[10px] text-muted-foreground">
        {progress.active ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Search className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">
          {t('mailBodyIndex.progressLabel', {
            done,
            total,
            pending: progress.pending
          })}
        </span>
        <span className="shrink-0 tabular-nums">{pct}%</span>
      </div>
      <div className="mx-auto mt-1 h-1 max-w-[48rem] overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={t('mailBodyIndex.progressLabel', {
            done,
            total,
            pending: progress.pending
          })}
        />
      </div>
    </div>
  )
}
