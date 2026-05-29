import { Cloud, ExternalLink, FolderOpen, Loader2, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MailFileIndexRow } from '@shared/files'
import { formatBytes } from '@/lib/format-bytes'
import {
  MailFileTypeIcon,
  mailFileVisualKindLabelKey,
  resolveMailFileVisualKind
} from '@/lib/mail-file-display'
import { cn } from '@/lib/utils'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import type { ConnectedAccount } from '@shared/types'

interface Props {
  row: MailFileIndexRow
  account?: ConnectedAccount
  selected: boolean
  opening: boolean
  cloudEnabled: boolean
  dateLabel: string
  onSelect: () => void
  onOpen: () => void
  onSaveAs: () => void
  onSaveToCloud?: () => void
  onOpenSource: () => void
}

export function FilesMailTile({
  row,
  account,
  selected,
  opening,
  cloudEnabled,
  dateLabel,
  onSelect,
  onOpen,
  onSaveAs,
  onSaveToCloud,
  onOpenSource
}: Props): JSX.Element {
  const { t } = useTranslation()
  const kind = resolveMailFileVisualKind(row.mime, row.name)
  const kindLabel = t(mailFileVisualKindLabelKey(kind))

  return (
    <article
      role="button"
      tabIndex={0}
      title={t('files.table.openHint')}
      onClick={onSelect}
      onDoubleClick={(e): void => {
        e.preventDefault()
        e.stopPropagation()
        onOpen()
      }}
      onKeyDown={(e): void => {
        if (e.key === 'Enter') onOpen()
      }}
      className={cn(
        'group relative flex min-h-[11rem] cursor-default flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm',
        'transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary/50 ring-2 ring-primary/40'
      )}
    >
      <div className="flex flex-1 flex-col p-3 pb-2">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted/50">
            {opening ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <MailFileTypeIcon mime={row.mime} name={row.name} size="tile" />
            )}
          </div>
          {account ? (
            <AccountAvatarBadge account={account} className="h-5 w-5 shrink-0 text-[9px]" />
          ) : null}
        </div>
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground" title={row.name}>
          {row.name}
        </p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {kindLabel}
        </p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground" title={row.subject}>
          {row.subject || t('common.noSubject')}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-2 text-[11px] tabular-nums text-muted-foreground">
          <span>{dateLabel}</span>
          <span aria-hidden>·</span>
          <span>{row.size != null ? formatBytes(row.size) : '—'}</span>
        </div>
      </div>

      <div
        className={cn(
          'flex items-center justify-end gap-0.5 border-t border-border/60 bg-muted/30 px-1 py-0.5',
          'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
          selected && 'opacity-100'
        )}
        onDoubleClick={(e): void => e.stopPropagation()}
      >
        {cloudEnabled ? (
          <button
            type="button"
            title={t('files.actions.saveToCloud')}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={(e): void => {
              e.stopPropagation()
              onSaveToCloud?.()
            }}
          >
            <Cloud className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          title={t('files.actions.saveAs')}
          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={(e): void => {
            e.stopPropagation()
            onSaveAs()
          }}
        >
          <Save className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          title={t('files.actions.openSource')}
          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={(e): void => {
            e.stopPropagation()
            onOpenSource()
          }}
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          title={t('files.actions.open')}
          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={(e): void => {
            e.stopPropagation()
            onOpen()
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </article>
  )
}
