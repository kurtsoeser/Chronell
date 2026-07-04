import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical, ExternalLink, Download, RotateCcw } from 'lucide-react'
import type { DemoStatus } from '@shared/types'

export function SettingsDemoSection(): JSX.Element {
  const { t } = useTranslation()
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const s = await window.mailClient.demo.getStatus()
    setStatus(s)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (key: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(key)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e))
      setBusy(null)
    }
  }

  const active = status?.active ?? false
  const btnPrimary =
    'rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'
  const btnOutline =
    'rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50'
  const btnGhost =
    'rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50'

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-semibold">{t('demo.settingsHeading')}</h3>
          <p className="text-sm text-muted-foreground">{t('demo.settingsIntro')}</p>
        </div>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t('demo.statusLabel')}</dt>
          <dd className="font-medium">{active ? t('demo.statusActive') : t('demo.statusInactive')}</dd>
        </div>
        {status?.scenario ? (
          <div>
            <dt className="text-muted-foreground">{t('demo.scenarioLabel')}</dt>
            <dd className="font-medium">{status.scenario}</dd>
          </div>
        ) : null}
        {status?.packVersion != null ? (
          <div>
            <dt className="text-muted-foreground">{t('demo.packVersionLabel')}</dt>
            <dd className="font-medium">{status.packVersion}</dd>
          </div>
        ) : null}
      </dl>

      {notice ? <p className="text-sm text-destructive">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        {!active ? (
          <button
            type="button"
            className={btnPrimary}
            disabled={busy != null}
            onClick={(): void => void run('enter', () => window.mailClient.demo.enter())}
          >
            {busy === 'enter' ? t('demo.entering') : t('demo.enter')}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`inline-flex items-center ${btnOutline}`}
              disabled={busy != null}
              onClick={(): void => void run('reset', () => window.mailClient.demo.reset())}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
              {busy === 'reset' ? t('demo.resetting') : t('demo.reset')}
            </button>
            <button
              type="button"
              className={btnOutline}
              disabled={busy != null}
              onClick={(): void => void run('exit', () => window.mailClient.demo.exit())}
            >
              {busy === 'exit' ? t('demo.exiting') : t('demo.exitToProduction')}
            </button>
            <button
              type="button"
              className={`inline-flex items-center ${btnOutline}`}
              disabled={busy != null}
              onClick={(): void =>
                void run('export', async () => {
                  const r = await window.mailClient.demo.exportPack()
                  if (r.cancelled) return
                  if (r.path) setNotice(t('demo.exportSaved', { path: r.path }))
                })
              }
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              {t('demo.exportPack')}
            </button>
          </>
        )}
        <button
          type="button"
          className={`inline-flex items-center ${btnGhost}`}
          onClick={(): void => void window.mailClient.app.openExternal('https://kurtsoeser.github.io/Chronell/DEMO.html')}
        >
          <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
          {t('demo.docsLink')}
        </button>
      </div>
    </section>
  )
}
