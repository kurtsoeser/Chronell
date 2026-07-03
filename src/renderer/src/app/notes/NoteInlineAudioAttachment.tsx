import { Download, Mic, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNoteAttachment } from '@shared/types'
import { formatAttachmentBytes } from '@/lib/attachment-files'
import { NoteCompactAudioPlayer } from '@/app/notes/NoteCompactAudioPlayer'
import { cn } from '@/lib/utils'

export function NoteInlineAudioAttachment({
  noteId,
  attachment,
  onRemove,
  onSaveAs,
  onError,
  className,
  compact = false
}: {
  noteId: number
  attachment: UserNoteAttachment
  onRemove: () => void
  onSaveAs: () => void
  onError?: (message: string) => void
  className?: string
  compact?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const saveAsLabel = t('notes.attachments.saveAs')

  return (
    <div
      className={cn(
        'flex max-w-full min-w-0 flex-col rounded-xl border border-violet-500/25 bg-violet-500/5 shadow-sm',
        compact ? 'w-[168px] gap-1 px-2 py-1.5' : 'w-[248px] gap-1.5 px-3 py-2',
        className
      )}
    >
      <div className={cn('flex min-w-0 items-start', compact ? 'gap-1.5' : 'gap-2')}>
        <Mic
          className={cn(
            'shrink-0 text-violet-600 dark:text-violet-400',
            compact ? 'mt-0.5 h-3 w-3' : 'mt-0.5 h-4 w-4'
          )}
        />
        <span
          className={cn(
            'min-w-0 flex-1 line-clamp-2 break-all font-medium text-foreground',
            compact ? 'text-2xs leading-tight' : 'text-[11px]'
          )}
          title={attachment.name}
        >
          {attachment.name}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          aria-label={t('notes.attachments.remove')}
          title={t('notes.attachments.remove')}
        >
          <X className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
        </button>
      </div>

      <NoteCompactAudioPlayer
        noteId={noteId}
        attachmentId={attachment.id}
        onError={onError}
        compact={compact}
      />

      <div
        className={cn(
          'flex min-w-0 items-center justify-between gap-2 border-t border-violet-500/20',
          compact ? 'pt-0.5' : 'pt-1'
        )}
      >
        {attachment.size != null ? (
          <span
            className={cn(
              'shrink-0 tabular-nums text-muted-foreground',
              compact ? 'text-[8px]' : 'text-[9px]'
            )}
          >
            {formatAttachmentBytes(attachment.size)}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSaveAs}
          className={cn(
            'inline-flex shrink-0 items-center text-primary hover:text-primary/80',
            compact ? 'rounded p-0.5 hover:bg-primary/10' : 'gap-0.5 text-[10px] font-medium hover:underline'
          )}
          aria-label={saveAsLabel}
          title={saveAsLabel}
        >
          <Download className={compact ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
          {!compact ? saveAsLabel : null}
        </button>
      </div>
    </div>
  )
}
