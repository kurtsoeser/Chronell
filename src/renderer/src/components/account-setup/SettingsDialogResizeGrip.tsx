import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function SettingsDialogResizeGrip({
  onPointerDown
}: {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      role="separator"
      aria-orientation="both"
      aria-label={t('settings.dialogResizeAria')}
      title={t('settings.dialogResizeTitle')}
      onPointerDown={onPointerDown}
      className={cn(
        'absolute bottom-0 right-0 z-20 h-4 w-4 cursor-se-resize rounded-br-[10px]',
        'border-l border-t border-border/70 bg-muted/50 hover:bg-muted',
        'touch-none'
      )}
    />
  )
}
