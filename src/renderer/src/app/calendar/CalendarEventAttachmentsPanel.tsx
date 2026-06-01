import { Loader2, Paperclip, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CalendarEventAttachmentMeta } from '@shared/types'
import { ComposeCloudAttachmentChip } from '@/components/ComposeAttachmentsStrip'
import { CalendarEventAttachmentRow } from '@/app/calendar/CalendarEventAttachmentRow'
import type {
  CalendarEventReferenceAttachmentDraft,
  useCalendarEventAttachments
} from '@/app/calendar/useCalendarEventAttachments'
import type { ComposeAttachment } from '@shared/types'
import { formatAttachmentBytes } from '@/lib/attachment-files'
import { cn } from '@/lib/utils'

type AttachmentsApi = ReturnType<typeof useCalendarEventAttachments>

export function CalendarEventAttachmentsPanel({
  attachments,
  disabled,
  compact,
  showDropHint,
  className
}: {
  attachments: AttachmentsApi
  disabled?: boolean
  compact?: boolean
  showDropHint?: boolean
  className?: string
}): JSX.Element | null {
  const { t } = useTranslation()
  const {
    newFiles,
    newReferences,
    existing,
    existingLoading,
    attachmentError,
    supportsFileAttachments,
    removeNewFile,
    removeNewReference,
    openExisting,
    saveExistingAs,
    formatBytes
  } = attachments

  const hasAny =
    newFiles.length > 0 ||
    newReferences.length > 0 ||
    existing.length > 0 ||
    existingLoading ||
    Boolean(attachmentError)

  if (!supportsFileAttachments && !attachmentError) return null

  return (
    <div className={cn('space-y-1.5', className)}>
      {showDropHint && supportsFileAttachments ? (
        <p className="text-2xs text-muted-foreground">
          {t('calendar.eventDialog.attachmentsDropHint')}
        </p>
      ) : null}
      {attachmentError ? (
        <p className="text-2xs text-destructive" role="alert">
          {attachmentError}
        </p>
      ) : null}
      {existingLoading ? (
        <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('calendar.eventDialog.attachmentsLoading')}
        </p>
      ) : null}
      {hasAny ? (
        <div className="space-y-1">
          <p className="text-2xs font-medium text-muted-foreground">
            {t('calendar.eventDialog.attachments')}
          </p>
          <div className="space-y-1">
            {existing.map((a) => (
              <CalendarEventAttachmentRow
                key={`ex-${a.id}`}
                att={a}
                disabled={disabled}
                compact={compact}
                onOpen={(): void => void openExisting(a)}
                onSaveAs={(): void => void saveExistingAs(a)}
              />
            ))}
            {newReferences.map((r) => (
              <div key={r.id} className={compact ? 'max-w-full' : undefined}>
                <ComposeCloudAttachmentChip
                  name={r.name}
                  onRemove={disabled ? (): void => undefined : (): void => removeNewReference(r.id)}
                />
              </div>
            ))}
            {newFiles.map((a, idx) => (
              <NewFileAttachmentRow
                key={`${a.name}-${idx}`}
                att={a}
                disabled={disabled}
                formatBytes={formatBytes}
                onRemove={(): void => removeNewFile(idx)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function NewFileAttachmentRow({
  att,
  disabled,
  formatBytes,
  onRemove
}: {
  att: ComposeAttachment
  disabled?: boolean
  formatBytes: (n: number) => string
  onRemove: () => void
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/70 bg-muted/20 px-2 py-1">
      <div className="min-w-0">
        <p className="truncate text-xs text-foreground">{att.name}</p>
        <p className="text-2xs text-muted-foreground">{formatBytes(att.size || 0)}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        className="text-2xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <X className="h-3 w-3" />
        <span className="sr-only">{t('common.remove')}</span>
      </button>
    </div>
  )
}

export type { CalendarEventReferenceAttachmentDraft }
