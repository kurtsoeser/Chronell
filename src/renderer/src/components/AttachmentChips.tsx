import {
  Cloud,
  Download,
  File as FileIcon,
  FileImage,
  FileText,
  Mic,
  X
} from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { formatAttachmentBytes } from '@/lib/attachment-files'

const ATTACHMENT_CHIP_WIDTH_CLASS = 'w-[248px] max-w-full min-w-0'
const ATTACHMENT_CHIP_COMPACT_WIDTH_CLASS = 'w-[168px] max-w-full min-w-0'

export function CloudAttachmentChip({
  name,
  onRemove,
  onOpen,
  onOpenLink,
  openLinkLabel,
  removeAriaLabel = 'Cloud-Anhang entfernen'
}: {
  name: string
  onRemove?: () => void
  onOpen?: () => void
  onOpenLink?: () => void
  openLinkLabel?: string
  removeAriaLabel?: string
}): JSX.Element {
  return (
    <div
      className={cn(
        ATTACHMENT_CHIP_WIDTH_CLASS,
        'flex flex-col gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-left shadow-sm'
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 rounded-sm text-left transition-colors hover:text-sky-700 dark:hover:text-sky-300"
            title={name}
          >
            <span className="line-clamp-2 break-all text-[11px] font-medium text-foreground">
              {name}
            </span>
          </button>
        ) : (
          <span
            className="min-w-0 flex-1 line-clamp-2 break-all text-[11px] font-medium text-foreground"
            title={name}
          >
            {name}
          </span>
        )}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            aria-label={removeAriaLabel}
            title="Entfernen"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-sky-500/20 pt-1.5">
        <span className="shrink-0 text-[10px] text-muted-foreground">OneDrive / SharePoint</span>
        {onOpenLink && openLinkLabel ? (
          <button
            type="button"
            onClick={onOpenLink}
            className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
          >
            {openLinkLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function LocalAttachmentChip({
  name,
  contentType,
  size,
  onRemove,
  onOpen,
  onSaveAs,
  saveAsLabel,
  removeAriaLabel = 'Anhang entfernen',
  compact = false
}: {
  name: string
  contentType: string
  size: number | null
  onRemove?: () => void
  onOpen?: () => void
  onSaveAs?: () => void
  saveAsLabel?: string
  removeAriaLabel?: string
  compact?: boolean
}): JSX.Element {
  const Icon = pickAttachmentIcon(contentType, name)

  return (
    <div
      className={cn(
        compact ? ATTACHMENT_CHIP_COMPACT_WIDTH_CLASS : ATTACHMENT_CHIP_WIDTH_CLASS,
        'flex flex-col rounded-xl border border-border/80 bg-card text-foreground shadow-sm',
        compact ? 'gap-1 px-2 py-1.5 text-2xs' : 'gap-1.5 px-3 py-2 text-[11px]'
      )}
    >
      <div className={cn('flex min-w-0 items-start', compact ? 'gap-1.5' : 'gap-2')}>
        <Icon
          className={cn(
            'shrink-0 text-muted-foreground',
            compact ? 'mt-0.5 h-3 w-3' : 'mt-0.5 h-4 w-4'
          )}
        />
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 rounded-sm text-left transition-colors hover:bg-secondary/40"
            title={size != null ? `${name} · ${formatAttachmentBytes(size)}` : name}
          >
            <span
              className={cn(
                'line-clamp-2 break-all font-medium text-foreground',
                compact && 'leading-tight'
              )}
            >
              {name}
            </span>
          </button>
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 line-clamp-2 break-all font-medium text-foreground',
              compact && 'leading-tight'
            )}
            title={name}
          >
            {name}
          </span>
        )}
        {onRemove ? (
          <button
            type="button"
            onClick={(e): void => {
              e.stopPropagation()
              onRemove()
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            aria-label={removeAriaLabel}
            title="Entfernen"
          >
            <X className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
          </button>
        ) : null}
      </div>

      {(size != null || onSaveAs) && (
        <div
          className={cn(
            'flex min-w-0 items-center justify-between gap-2 border-t border-border/50',
            compact ? 'pt-1' : 'pt-1.5'
          )}
        >
          {size != null ? (
            <span
              className={cn(
                'shrink-0 text-muted-foreground',
                compact ? 'text-[9px]' : 'text-[10px]'
              )}
            >
              {formatAttachmentBytes(size)}
            </span>
          ) : (
            <span />
          )}
          {onSaveAs ? (
            <button
              type="button"
              onClick={onSaveAs}
              className={cn(
                'inline-flex shrink-0 items-center text-primary hover:text-primary/80',
                compact ? 'rounded p-0.5 hover:bg-primary/10' : 'gap-0.5 text-[10px] font-medium hover:underline'
              )}
              aria-label={saveAsLabel ?? 'Download'}
              title={saveAsLabel ?? 'Download'}
            >
              <Download className={compact ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
              {!compact && saveAsLabel ? saveAsLabel : null}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function pickAttachmentIcon(
  mime: string,
  name: string
): ComponentType<{ className?: string }> {
  if (mime.startsWith('image/')) return FileImage
  if (mime.startsWith('audio/')) return Mic
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['webm', 'ogg', 'oga', 'opus', 'mp3', 'm4a', 'wav', 'aac', 'flac'].includes(ext)) return Mic
  if (mime.startsWith('text/') || ['txt', 'md', 'log', 'csv'].includes(ext)) return FileText
  return FileIcon
}
