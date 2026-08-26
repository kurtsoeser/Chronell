import { CircleDot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconGlyphClass
} from '@/components/ModuleColumnHeader'

export type MailCalendarGoToTodayIconButtonProps = {
  disabled?: boolean
  onClick: () => void
  className?: string
  /** Kompakter Button für eingebettete Leisten ohne Modul-Header. */
  variant?: 'header' | 'compact'
}

export function MailCalendarGoToTodayIconButton({
  disabled = false,
  onClick,
  className,
  variant = 'header'
}: MailCalendarGoToTodayIconButtonProps): JSX.Element {
  const { t } = useTranslation()

  if (variant === 'header') {
    return (
      <ModuleColumnHeaderIconButton
        title={t('mail.rightSidebar.dayGoToToday')}
        aria-label={t('mail.rightSidebar.dayGoToToday')}
        disabled={disabled}
        onClick={onClick}
        className={cn(disabled && 'opacity-45', className)}
      >
        <CircleDot className={moduleColumnHeaderIconGlyphClass} />
      </ModuleColumnHeaderIconButton>
    )
  }

  return (
    <button
      type="button"
      title={t('mail.rightSidebar.dayGoToToday')}
      aria-label={t('mail.rightSidebar.dayGoToToday')}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:cursor-default disabled:opacity-45',
        className
      )}
    >
      <CircleDot className="h-3.5 w-3.5 shrink-0" />
    </button>
  )
}
