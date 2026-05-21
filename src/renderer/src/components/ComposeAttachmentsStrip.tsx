import { AlertCircle, Cloud, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ComposeAttachmentFile, ComposeReferenceAttachmentDraft } from '@/stores/compose'
import { formatBytes } from '@/lib/format-bytes'
import { cn } from '@/lib/utils'

export function ComposeCloudAttachmentChip({
  name,
  onRemove
}: {
  name: string
  onRemove: () => void
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex max-w-[260px] flex-col gap-1 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground" title={name}>
          {name}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          aria-label={t('mail.composeTile.removeCloudAttachmentAria', {
            defaultValue: 'Cloud-Anhang entfernen'
          })}
          title={t('common.remove', { defaultValue: 'Entfernen' })}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <span className="text-[10px] text-muted-foreground">
        {t('mail.composeTile.cloudAttachmentHint', {
          defaultValue: 'OneDrive / SharePoint (Link)'
        })}
      </span>
    </div>
  )
}

interface Props {
  attachments: ComposeAttachmentFile[]
  referenceAttachments: ComposeReferenceAttachmentDraft[]
  attachmentError: string | null
  onRemoveLocal: (id: string) => void
  onRemoveCloud: (id: string) => void
  className?: string
  compact?: boolean
}

export function ComposeAttachmentsStrip({
  attachments,
  referenceAttachments,
  attachmentError,
  onRemoveLocal,
  onRemoveCloud,
  className,
  compact
}: Props): JSX.Element | null {
  const { t } = useTranslation()
  const hasAny =
    attachments.length > 0 || referenceAttachments.length > 0 || Boolean(attachmentError)
  if (!hasAny) return null

  return (
    <div
      className={cn(
        'max-h-24 shrink-0 overflow-y-auto border-t border-border/60 bg-secondary/15',
        compact ? 'px-2 py-1' : 'px-3 py-2',
        className
      )}
    >
      {attachmentError ? (
        <div
          className={cn(
            'mb-1 flex items-start gap-1.5 text-destructive',
            compact ? 'text-[10px]' : 'text-xs'
          )}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{attachmentError}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {referenceAttachments.map((r) => (
          <ComposeCloudAttachmentChip
            key={r.id}
            name={r.name}
            onRemove={(): void => onRemoveCloud(r.id)}
          />
        ))}
        {attachments.map((a) => (
          <span
            key={a.id}
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-card text-[11px]',
              compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
            )}
          >
            <span className="truncate">{a.name}</span>
            <span className="text-muted-foreground">({formatBytes(a.size)})</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              aria-label={t('mail.composeTile.removeAttachmentAria')}
              onClick={(): void => onRemoveLocal(a.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
