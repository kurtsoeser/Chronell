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
  className
}: {
  noteId: number
  attachment: UserNoteAttachment
  onRemove: () => void
  onSaveAs: () => void
  onError?: (message: string) => void
  className?: string
}): JSX.Element {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex w-[248px] max-w-full min-w-0 flex-col gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2 shadow-sm',
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Mic className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
        <span
          className="min-w-0 flex-1 line-clamp-2 break-all text-[11px] font-medium text-foreground"
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
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <NoteCompactAudioPlayer
        noteId={noteId}
        attachmentId={attachment.id}
        onError={onError}
      />

      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-violet-500/20 pt-1">
        {attachment.size != null ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatAttachmentBytes(attachment.size)}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSaveAs}
          className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
        >
          <Download className="h-2.5 w-2.5" />
          {t('notes.attachments.saveAs')}
        </button>
      </div>
    </div>
  )
}
