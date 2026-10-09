import { useTranslation } from 'react-i18next'
import { chronellPillBadgeClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'

/** Mail-ToDo-Kennzeichnung in der Zeitliste (lila Pill). */
export function MailTodoKindPill({ className }: { className?: string }): JSX.Element {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        chronellPillBadgeClass,
        'bg-[#7B61FF] text-white',
        className
      )}
    >
      {t('mega.shell.mailTodoPill')}
    </span>
  )
}
