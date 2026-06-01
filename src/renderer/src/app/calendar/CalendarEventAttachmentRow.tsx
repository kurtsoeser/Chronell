import { Cloud, Download, ExternalLink, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CalendarEventAttachmentMeta } from '@shared/types'
import { formatAttachmentBytes } from '@/lib/attachment-files'
import { cn } from '@/lib/utils'

export function CalendarEventAttachmentRow({
  att,
  disabled,
  compact,
  onOpen,
  onSaveAs
}: {
  att: CalendarEventAttachmentMeta
  disabled?: boolean
  compact?: boolean
  onOpen: () => void
  onSaveAs: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const isCloud = att.kind === 'reference' || att.kind === 'google_drive'
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded border border-border/70 bg-muted/20 px-2 py-1',
        compact && 'py-0.5'
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {isCloud ? (
          <Cloud className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />
        ) : (
          <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs text-foreground">{att.name}</p>
          {att.size != null && att.size > 0 ? (
            <p className="text-2xs text-muted-foreground">{formatAttachmentBytes(att.size)}</p>
          ) : isCloud ? (
            <p className="text-2xs text-muted-foreground">
              {t('calendar.eventDialog.attachmentCloudHint')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onOpen}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
          title={t('calendar.eventDialog.attachmentOpen')}
        >
          <ExternalLink className="h-3 w-3" />
        </button>
        {!isCloud ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSaveAs}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
            title={t('calendar.eventDialog.attachmentSaveAs')}
          >
            <Download className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
