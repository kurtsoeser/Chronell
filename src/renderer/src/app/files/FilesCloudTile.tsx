import { Copy, Download, ExternalLink, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CloudFileRow } from '@shared/files'
import { formatBytes } from '@/lib/format-bytes'
import { MailFileTypeIcon } from '@/lib/mail-file-display'
import { cn } from '@/lib/utils'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import type { ConnectedAccount } from '@shared/types'

interface Props {
  row: CloudFileRow
  account?: ConnectedAccount
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onSaveAs: () => void
  onCopyLink: () => void
  onContextMenu?: (event: React.MouseEvent) => void
}

export function FilesCloudTile({
  row,
  account,
  selected,
  onSelect,
  onOpen,
  onSaveAs,
  onCopyLink,
  onContextMenu
}: Props): JSX.Element {
  const { t } = useTranslation()
  const isFolder = row.isFolder

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onContextMenu={(e): void => {
        e.preventDefault()
        onContextMenu?.(e)
      }}
      onDoubleClick={(e): void => {
        e.preventDefault()
        e.stopPropagation()
        onOpen()
      }}
      onKeyDown={(e): void => {
        if (e.key === 'Enter') onOpen()
      }}
      className={cn(
        'group relative flex min-h-[10rem] cursor-default flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm',
        'transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary/50 ring-2 ring-primary/40',
        isFolder && 'min-h-[8.5rem]'
      )}
    >
      <div className="flex flex-1 flex-col p-3 pb-2">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted/50">
            {isFolder ? (
              <Folder
                className="h-10 w-10 shrink-0 text-amber-600/90 dark:text-amber-400/90"
                aria-hidden
              />
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
          {isFolder ? t('files.cloud.typeFolder') : t('files.cloud.typeFile')}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={row.locationLabel}>
          {row.locationLabel}
        </p>
        {!isFolder ? (
          <p className="mt-auto pt-2 text-[11px] tabular-nums text-muted-foreground">
            {row.size != null ? formatBytes(row.size) : '—'}
          </p>
        ) : null}
      </div>

      {!isFolder ? (
        <div
          className={cn(
            'flex items-center justify-end gap-0.5 border-t border-border/60 bg-muted/30 px-1 py-0.5',
            'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
            selected && 'opacity-100'
          )}
          onDoubleClick={(e): void => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={!row.webUrl}
            title={t('files.cloud.copyLink')}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
            onClick={(e): void => {
              e.stopPropagation()
              onCopyLink()
            }}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            title={t('files.actions.saveAs')}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={(e): void => {
              e.stopPropagation()
              onSaveAs()
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!row.webUrl}
            title={t('files.cloud.openInBrowser')}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
            onClick={(e): void => {
              e.stopPropagation()
              onOpen()
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </article>
  )
}
