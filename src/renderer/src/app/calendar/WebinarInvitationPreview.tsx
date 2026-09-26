import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { sanitizeWebinarInvitationHtml } from '@/lib/sanitize-webinar-invitation-html'
import { cn } from '@/lib/utils'

export interface WebinarInvitationPreviewProps {
  html: string
  className?: string
}

/**
 * Vorschau fuer Webinar-Einladungen: zeigt das HTML so wie es in Outlook ankommt
 * (eigene dunkle Farben, kein Mail-Dark-Invert).
 */
export function WebinarInvitationPreview({
  html,
  className
}: WebinarInvitationPreviewProps): JSX.Element {
  const { t } = useTranslation()
  const safeHtml = useMemo(() => sanitizeWebinarInvitationHtml(html.trim()), [html])
  const isEmpty = !safeHtml

  if (isEmpty) {
    return (
      <p className={cn('text-sm italic leading-snug text-muted-foreground', className)}>
        {t('calendar.eventDialog.webinarPreviewEmpty')}
      </p>
    )
  }

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-border/60 bg-[#121212] p-4',
        className
      )}
    >
      <div
        className="webinar-invitation-preview mx-auto text-left"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  )
}
