import { useTranslation } from 'react-i18next'
import { LoadingIndicator } from '@/components/motion/LoadingIndicator'

export interface CalendarShellLoadingOverlayProps {
  visible: boolean
  /** Standard aus i18n (`calendar.loadingOverlay`), falls nicht gesetzt. */
  label?: string
}

export function CalendarShellLoadingOverlay({
  visible,
  label
}: CalendarShellLoadingOverlayProps): JSX.Element | null {
  const { t } = useTranslation()
  const resolved = label ?? t('calendar.loadingOverlay')
  if (!visible) return null
  return (
    <LoadingIndicator
      className="absolute right-5 top-4 z-10 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-md backdrop-blur"
      size="h-3.5 w-3.5"
      label={resolved}
    />
  )
}
