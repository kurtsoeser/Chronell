import { Minus, Minimize2, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useFramelessTitlebar } from '@/lib/use-frameless-titlebar'

function titlebarControlClass(close?: boolean): string {
  return cn(
    'flex h-12 w-11 items-center justify-center text-muted-foreground transition-colors',
    close
      ? 'hover:bg-destructive hover:text-destructive-foreground'
      : 'hover:bg-secondary/80 hover:text-foreground'
  )
}

export function WindowTitlebarControls(): JSX.Element | null {
  const { t } = useTranslation()
  const frameless = useFramelessTitlebar()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!frameless) return
    void window.mailClient.app.windowIsMaximized().then(setMaximized)
    return window.mailClient.events.onWindowMaximizedChanged(setMaximized)
  }, [frameless])

  if (!frameless) return null

  return (
    <div
      className="ml-0.5 flex shrink-0 items-stretch"
      role="group"
      aria-label={t('topbar.windowControlsAria')}
    >
      <button
        type="button"
        className={titlebarControlClass()}
        onClick={(): void => {
          void window.mailClient.app.windowMinimize()
        }}
        aria-label={t('topbar.windowMinimizeAria')}
        title={t('topbar.windowMinimizeTitle')}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        className={titlebarControlClass()}
        onClick={(): void => {
          void window.mailClient.app.windowToggleMaximize()
        }}
        aria-label={
          maximized ? t('topbar.windowRestoreAria') : t('topbar.windowMaximizeAria')
        }
        title={maximized ? t('topbar.windowRestoreTitle') : t('topbar.windowMaximizeTitle')}
      >
        {maximized ? (
          <Minimize2 className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        ) : (
          <Square className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        )}
      </button>
      <button
        type="button"
        className={titlebarControlClass(true)}
        onClick={(): void => {
          void window.mailClient.app.windowClose()
        }}
        aria-label={t('topbar.windowCloseAria')}
        title={t('topbar.windowCloseTitle')}
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  )
}
