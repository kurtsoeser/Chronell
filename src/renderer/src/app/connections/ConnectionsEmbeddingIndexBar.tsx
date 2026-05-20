import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  EntityEmbeddingIndexStatus,
  EntityEmbeddingProgress
} from '@shared/entity-embeddings'
import {
  fetchEntityEmbeddingIndexStatus,
  subscribeEntityEmbeddingProgress
} from '@/lib/entity-embeddings-client'

export function ConnectionsEmbeddingIndexBar(): JSX.Element | null {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<EntityEmbeddingProgress | null>(null)
  const [status, setStatus] = useState<EntityEmbeddingIndexStatus | null>(null)

  useEffect(() => {
    void fetchEntityEmbeddingIndexStatus().then(setStatus)
    return subscribeEntityEmbeddingProgress((next) => {
      setProgress(next)
      if (next == null) {
        void fetchEntityEmbeddingIndexStatus().then(setStatus)
      }
    })
  }, [])

  const active: EntityEmbeddingProgress | null =
    progress ??
    (status?.rebuildRunning && status.rebuildProgress
      ? { ...status.rebuildProgress, phase: 'rebuild' }
      : null)

  if (!status?.enabled || !active || active.total <= 0) return null

  const pct = Math.min(100, Math.round((active.done / active.total) * 100))
  const labelKey =
    active.phase === 'rebuild'
      ? 'connections.shell.embeddingIndexRebuild'
      : 'connections.shell.embeddingIndexAuto'

  return (
    <div className="border-t border-border/60 px-2 py-1.5 sm:px-3">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {t(labelKey, { done: active.done, total: active.total })}
        </span>
        <span className="shrink-0 tabular-nums">{pct}%</span>
      </div>
      <div
        className="mt-1 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={active.done}
        aria-valuemin={0}
        aria-valuemax={active.total}
        aria-label={t(labelKey, { done: active.done, total: active.total })}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
