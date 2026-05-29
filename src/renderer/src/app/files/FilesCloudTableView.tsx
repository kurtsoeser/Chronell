import { ChevronRight, Copy, Download, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CloudFileRow } from '@shared/files'
import { MailFileTypeIcon } from '@/lib/mail-file-display'
import { Folder } from 'lucide-react'
import { formatBytes } from '@/lib/format-bytes'
import { cn } from '@/lib/utils'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import type { ConnectedAccount } from '@shared/types'

interface Props {
  rows: CloudFileRow[]
  accountsById: Map<string, ConnectedAccount>
  selectedKey: string | null
  onSelect: (row: CloudFileRow) => void
  onOpenFolder: (row: CloudFileRow) => void
  onOpenFile: (row: CloudFileRow) => void
  onSaveAs: (row: CloudFileRow) => void
  onCopyLink: (row: CloudFileRow) => void
}

export function FilesCloudTableView({
  rows,
  accountsById,
  selectedKey,
  onSelect,
  onOpenFolder,
  onOpenFile,
  onSaveAs,
  onCopyLink
}: Props): JSX.Element {
  const { t } = useTranslation()

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {t('files.cloud.tableEmpty')}
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_5rem_6rem_5rem] gap-2 border-b border-border bg-card/95 px-2 py-1 backdrop-blur-sm">
        <span className="text-2xs font-medium text-muted-foreground">{t('files.table.name')}</span>
        <span className="text-2xs font-medium text-muted-foreground">
          {t('files.cloud.columnLocation')}
        </span>
        <span className="text-2xs font-medium text-muted-foreground">{t('files.table.size')}</span>
        <span className="text-2xs font-medium text-muted-foreground">{t('files.table.type')}</span>
        <span className="sr-only">{t('files.table.actions')}</span>
      </div>

      <ul>
        {rows.map((row) => {
          const selected = selectedKey === row.rowKey
          const account = accountsById.get(row.accountId)
          return (
            <li key={row.rowKey}>
              <div
                role="row"
                tabIndex={0}
                onClick={(): void => onSelect(row)}
                onDoubleClick={(e): void => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (row.isFolder) onOpenFolder(row)
                  else onOpenFile(row)
                }}
                onKeyDown={(e): void => {
                  if (e.key === 'Enter') {
                    if (row.isFolder) onOpenFolder(row)
                    else onOpenFile(row)
                  }
                }}
                className={cn(
                  'grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_5rem_6rem_5rem] gap-2 border-b border-border/40 px-2 py-1.5 text-sm transition-colors',
                  selected ? 'bg-primary/15' : 'hover:bg-secondary/40'
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {row.isFolder ? (
                    <Folder
                      className="h-4 w-4 shrink-0 text-amber-600/90 dark:text-amber-400/90"
                      aria-hidden
                    />
                  ) : (
                    <MailFileTypeIcon mime={row.mime} name={row.name} />
                  )}
                  <span className="truncate font-medium" title={row.name}>
                    {row.name}
                  </span>
                </div>
                <span className="truncate text-muted-foreground" title={row.locationLabel}>
                  {row.locationLabel}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {row.isFolder ? '—' : row.size != null ? formatBytes(row.size) : '—'}
                </span>
                <div className="flex items-center gap-1.5 truncate text-muted-foreground">
                  {account ? (
                    <AccountAvatarBadge account={account} className="h-4 w-4 text-[8px]" />
                  ) : null}
                  <span className="truncate text-xs">
                    {row.isFolder
                      ? t('files.cloud.typeFolder')
                      : t('files.cloud.typeFile')}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-0.5">
                  {!row.isFolder ? (
                    <>
                      <button
                        type="button"
                        title={t('files.cloud.copyLink')}
                        disabled={!row.webUrl}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                        onClick={(e): void => {
                          e.stopPropagation()
                          onCopyLink(row)
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title={t('files.actions.saveAs')}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={(e): void => {
                          e.stopPropagation()
                          onSaveAs(row)
                        }}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title={t('files.cloud.openInBrowser')}
                        disabled={!row.webUrl}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                        onClick={(e): void => {
                          e.stopPropagation()
                          onOpenFile(row)
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      title={t('files.cloud.openFolder')}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      onClick={(e): void => {
                        e.stopPropagation()
                        onOpenFolder(row)
                      }}
                    >
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
