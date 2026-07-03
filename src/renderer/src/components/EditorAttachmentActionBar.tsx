import { useCallback, useRef } from 'react'
import { Cloud, Paperclip, PenLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AudioRecorderButton } from '@/components/AudioRecorderButton'
import { useInkPngAttachment } from '@/components/use-ink-png-attachment'
import { cn } from '@/lib/utils'

export function EditorAttachmentActionBar({
  disabled,
  onError,
  onAddFiles,
  onCloudAttach,
  attachmentCount = 0,
  cloudAttachmentCount = 0,
  compact,
  inEditorSurface,
  showMediaActions = true,
  enableFileAttach = true,
  className
}: {
  disabled?: boolean
  onError?: (message: string) => void
  onAddFiles: (files: File[]) => void | Promise<void>
  onCloudAttach?: () => void
  attachmentCount?: number
  cloudAttachmentCount?: number
  compact?: boolean
  /** Styling passend zur Compose-Oberfläche (dunkle Editor-Chrome). */
  inEditorSurface?: boolean
  /** Audio-Aufnahme und Freihand (benötigt Datei-Anhänge). */
  showMediaActions?: boolean
  /** Lokale Datei-Anhänge (Büroklammer). */
  enableFileAttach?: boolean
  className?: string
}): JSX.Element {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const ink = useInkPngAttachment({ onAddFiles, onError })

  const handleRecorded = useCallback(
    async (payload: { name: string; contentType: string; blob: Blob }): Promise<void> => {
      const file = new File([payload.blob], payload.name, { type: payload.contentType })
      await onAddFiles([file])
    },
    [onAddFiles]
  )

  const handleFilesChosen = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const files = event.target.files
      if (files?.length) void onAddFiles(Array.from(files))
      event.target.value = ''
    },
    [onAddFiles]
  )

  const buttonClass = cn(
    'relative inline-flex items-center gap-1 rounded-md border font-medium disabled:opacity-50',
    compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-2xs',
    inEditorSurface
      ? 'border-[hsl(var(--compose-surface-border)/0.55)] text-foreground hover:bg-[hsl(var(--compose-surface-border)/0.18)]'
      : 'border-border text-foreground hover:bg-secondary'
  )

  const cloudButtonClass = cn(
    buttonClass,
    inEditorSurface
      ? 'border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15'
      : 'border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10'
  )

  const badgeClass =
    'pointer-events-none absolute -right-1 -top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full px-0.5 text-[8px] font-semibold leading-none'

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-1.5 border-t px-3 py-1.5',
          inEditorSurface
            ? 'border-[hsl(var(--compose-surface-border)/0.45)] bg-[hsl(var(--compose-surface)/0.28)]'
            : 'border-border/60 bg-secondary/10',
          className
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilesChosen}
        />
        {enableFileAttach ? (
          <button
            type="button"
            disabled={disabled}
            onClick={(): void => fileInputRef.current?.click()}
            className={buttonClass}
          >
            <Paperclip className="h-3 w-3" />
            {t('notes.attachments.addFile')}
            {attachmentCount > 0 ? (
              <span className={cn(badgeClass, 'bg-primary text-primary-foreground')}>
                {attachmentCount > 99 ? '99+' : attachmentCount}
              </span>
            ) : null}
          </button>
        ) : null}
        {onCloudAttach ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onCloudAttach}
            className={cloudButtonClass}
          >
            <Cloud className={cn('h-3 w-3', inEditorSurface ? 'text-sky-400' : 'text-sky-600 dark:text-sky-400')} />
            {t('mail.composeTile.addCloud')}
            {cloudAttachmentCount > 0 ? (
              <span className={cn(badgeClass, 'bg-sky-600 text-white')}>
                {cloudAttachmentCount > 99 ? '99+' : cloudAttachmentCount}
              </span>
            ) : null}
          </button>
        ) : null}
        {showMediaActions ? (
          <>
            <AudioRecorderButton
              disabled={disabled}
              onError={onError}
              onRecorded={handleRecorded}
              compact={compact}
              inEditorSurface={inEditorSurface}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={ink.openInkDraw}
              className={buttonClass}
            >
              <PenLine className="h-3 w-3" />
              {t('notes.ink.button')}
            </button>
          </>
        ) : null}
      </div>
      {showMediaActions ? ink.inkDialog : null}
    </>
  )
}
