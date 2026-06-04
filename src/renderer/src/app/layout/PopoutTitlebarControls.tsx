import { LayoutPanelLeft, Minus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useFramelessTitlebar } from '@/lib/use-frameless-titlebar'

function controlClass(close?: boolean): string {
  return cn(
    'flex h-12 w-11 items-center justify-center text-muted-foreground transition-colors',
    close
      ? 'hover:bg-destructive hover:text-destructive-foreground'
      : 'hover:bg-secondary/80 hover:text-foreground'
  )
}

export function PopoutTitlebarControls({
  onPopIn,
  onClose
}: {
  onPopIn?: () => void
  onClose: () => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const frameless = useFramelessTitlebar()

  if (!frameless) {
    return (
      <button
        type="button"
        className={controlClass(true)}
        onClick={onClose}
        aria-label={t('topbar.windowCloseAria')}
        title={t('topbar.windowCloseTitle')}
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
    )
  }

  return (
    <div
      className="ml-0.5 flex shrink-0 items-stretch"
      role="group"
      aria-label={t('topbar.windowControlsAria')}
    >
      <button
        type="button"
        className={controlClass()}
        onClick={(): void => {
          void window.mailClient.app.windowMinimize()
        }}
        aria-label={t('topbar.windowMinimizeAria')}
        title={t('topbar.windowMinimizeTitle')}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      {onPopIn ? (
        <button
          type="button"
          className={controlClass()}
          onClick={onPopIn}
          aria-label={t('popout.popInAria')}
          title={t('popout.popInTitle')}
        >
          <LayoutPanelLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className={controlClass(true)}
        onClick={onClose}
        aria-label={t('topbar.windowCloseAria')}
        title={t('topbar.windowCloseTitle')}
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  )
}
