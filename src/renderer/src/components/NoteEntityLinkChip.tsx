import { ExternalLink, X } from 'lucide-react'
import type { NoteEntityLinkTargetKind } from '@shared/note-entity-links'
import { cn } from '@/lib/utils'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'

const CHIP_WIDTH_CLASS = 'w-[168px] max-w-full min-w-0'

const KIND_CHIP_SURFACE_CLASS: Partial<Record<NoteEntityLinkTargetKind, string>> = {
  people_contact: 'border-rose-500/30 bg-rose-500/5',
  mail: 'border-sky-500/30 bg-sky-500/5',
  calendar_event: 'border-violet-500/30 bg-violet-500/5',
  cloud_task: 'border-emerald-500/30 bg-emerald-500/5',
  note: 'border-amber-500/30 bg-amber-500/5'
}

const KIND_ICON_CLASS: Partial<Record<NoteEntityLinkTargetKind, string>> = {
  people_contact: 'text-rose-600 dark:text-rose-400',
  mail: 'text-sky-600 dark:text-sky-400',
  calendar_event: 'text-violet-600 dark:text-violet-400',
  cloud_task: 'text-emerald-600 dark:text-emerald-400',
  note: 'text-amber-700 dark:text-amber-400'
}

export function NoteEntityLinkChip({
  kind,
  title,
  meta,
  selected = false,
  busy = false,
  previewTitle,
  openTitle,
  removeTitle,
  onSelect,
  onOpen,
  onRemove
}: {
  kind: NoteEntityLinkTargetKind
  title: string
  meta: string
  selected?: boolean
  busy?: boolean
  previewTitle?: string
  openTitle?: string
  removeTitle?: string
  onSelect?: () => void
  onOpen?: () => void
  onRemove?: () => void
}): JSX.Element {
  const Icon = entityRefKindIcon(kind)

  return (
    <div
      className={cn(
        CHIP_WIDTH_CLASS,
        'flex flex-col gap-1 rounded-xl border px-2 py-1.5 text-2xs text-foreground shadow-sm',
        KIND_CHIP_SURFACE_CLASS[kind] ?? 'border-border/80 bg-card',
        selected && 'border-primary/50 ring-1 ring-primary/30'
      )}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <Icon
          className={cn(
            'mt-0.5 h-3 w-3 shrink-0',
            KIND_ICON_CLASS[kind] ?? 'text-muted-foreground'
          )}
        />
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 flex-1 rounded-sm text-left transition-colors hover:bg-secondary/40"
            title={previewTitle ?? title}
          >
            <span className="line-clamp-2 break-all font-medium leading-tight text-foreground">
              {title}
            </span>
          </button>
        ) : (
          <span
            className="min-w-0 flex-1 line-clamp-2 break-all font-medium leading-tight text-foreground"
            title={title}
          >
            {title}
          </span>
        )}
        {onRemove ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive disabled:opacity-50"
            aria-label={removeTitle}
            title={removeTitle}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border/50 pt-1">
        <span className="min-w-0 truncate text-[9px] text-muted-foreground" title={meta}>
          {meta}
        </span>
        {onOpen ? (
          <button
            type="button"
            disabled={busy}
            onClick={onOpen}
            className="shrink-0 rounded p-0.5 text-primary hover:bg-primary/10 disabled:opacity-50"
            aria-label={openTitle}
            title={openTitle}
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
