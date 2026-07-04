import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical, RotateCcw, LogOut } from 'lucide-react'
import type { DemoStatus } from '@shared/types'

export function DemoModeBanner(): JSX.Element | null {
  const { t } = useTranslation()
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [busy, setBusy] = useState<'reset' | 'exit' | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.mailClient.demo.getStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    return (): void => {
      cancelled = true
    }
  }, [])

  const onReset = useCallback(async (): Promise<void> => {
    setBusy('reset')
    try {
      await window.mailClient.demo.reset()
    } catch (e) {
      console.error('[demo] reset failed:', e)
      setBusy(null)
    }
  }, [])

  const onExit = useCallback(async (): Promise<void> => {
    setBusy('exit')
    try {
      await window.mailClient.demo.exit()
    } catch (e) {
      console.error('[demo] exit failed:', e)
      setBusy(null)
    }
  }, [])

  if (!status?.active) return null

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-950 dark:text-amber-100"
    >
      <div className="flex min-w-0 items-center gap-2">
        <FlaskConical className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <span className="font-medium">{t('demo.bannerTitle')}</span>
        <span className="hidden text-amber-900/80 dark:text-amber-200/80 sm:inline">
          {t('demo.bannerSubtitle')}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status.canReset ? (
          <button
            type="button"
            disabled={busy != null}
            onClick={(): void => void onReset()}
            className="inline-flex items-center rounded-md border border-amber-500/40 bg-background/60 px-2.5 py-1 text-xs font-medium hover:bg-background/80 disabled:opacity-50"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
            {busy === 'reset' ? t('demo.resetting') : t('demo.reset')}
          </button>
        ) : null}
        {status.canExit ? (
          <button
            type="button"
            disabled={busy != null}
            onClick={(): void => void onExit()}
            className="inline-flex items-center rounded-md border border-amber-500/40 bg-background/60 px-2.5 py-1 text-xs font-medium hover:bg-background/80 disabled:opacity-50"
          >
            <LogOut className="mr-1 h-3.5 w-3.5" aria-hidden />
            {busy === 'exit' ? t('demo.exiting') : t('demo.exitToProduction')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
