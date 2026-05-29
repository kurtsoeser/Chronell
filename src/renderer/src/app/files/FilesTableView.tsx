import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Cloud, ExternalLink, FolderOpen, Loader2, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FilesMailGroupBy, MailFileIndexRow, FilesMailSortBy } from '@shared/files'
import { formatBytes } from '@/lib/format-bytes'
import { MailFileTypeIcon } from '@/lib/mail-file-display'
import {
  buildFilesMailGroupingLabels,
  groupMailFileRows
} from '@/lib/files-mail-grouping'
import { cn } from '@/lib/utils'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import type { ConnectedAccount } from '@shared/types'
import { FilesTableColumnResizeHandle } from '@/app/files/FilesTableColumnResizeHandle'
import {
  type FilesMailTableColumnId,
  useFilesMailTableColumnWidths
} from '@/app/files/files-table-column-widths'

interface Props {
  rows: MailFileIndexRow[]
  accountsById: Map<string, ConnectedAccount>
  groupBy: FilesMailGroupBy
  sortBy: FilesMailSortBy
  sortDir: 'asc' | 'desc'
  onSort: (column: FilesMailSortBy) => void
  selectedId: number | null
  openingFileId: number | null
  onSelect: (row: MailFileIndexRow) => void
  onOpen: (row: MailFileIndexRow) => void
  onSaveAs: (row: MailFileIndexRow) => void
  onSaveToCloud?: (row: MailFileIndexRow) => void
  onOpenSource: (row: MailFileIndexRow) => void
  collapsedGroups: Set<string>
  onToggleGroup: (key: string) => void
  emptyMessage?: string
}

function HeaderCell({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  onResize,
  className
}: {
  label: string
  column: FilesMailSortBy
  sortBy: FilesMailSortBy
  sortDir: 'asc' | 'desc'
  onSort: (c: FilesMailSortBy) => void
  onResize?: (delta: number) => void
  className?: string
}): JSX.Element {
  const active = sortBy === column
  const resizeCol = sortColumnToResizeId(column)
  return (
    <div className={cn('relative min-w-0 pr-2', className)}>
      <button
        type="button"
        onClick={(): void => onSort(column)}
        className="inline-flex w-full min-w-0 items-center gap-0.5 truncate text-left text-2xs font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        {active ? <span aria-hidden>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span> : null}
      </button>
      {onResize && resizeCol ? (
        <FilesTableColumnResizeHandle onResize={onResize} />
      ) : null}
    </div>
  )
}

function sortColumnToResizeId(column: FilesMailSortBy): FilesMailTableColumnId | null {
  if (column === 'name' || column === 'subject' || column === 'receivedAt' || column === 'size') {
    return column === 'receivedAt' ? 'date' : column
  }
  return null
}

export function FilesTableView({
  rows,
  accountsById,
  groupBy,
  sortBy,
  sortDir,
  onSort,
  selectedId,
  openingFileId,
  onSelect,
  onOpen,
  onSaveAs,
  onSaveToCloud,
  onOpenSource,
  collapsedGroups,
  onToggleGroup,
  emptyMessage
}: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const { gridTemplate, resizeColumn } = useFilesMailTableColumnWidths()

  const groupingLabels = useMemo(() => buildFilesMailGroupingLabels(t), [t])

  const groups = useMemo(() => {
    return groupMailFileRows(rows, groupBy, {
      accountLabel: (accountId) => {
        const acc = accountsById.get(accountId)
        return acc?.displayName || acc?.email || accountId
      },
      labels: groupingLabels
    })
  }, [rows, groupBy, accountsById, groupingLabels])

  const gridStyle = { gridTemplateColumns: gridTemplate }

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {emptyMessage ?? t('files.table.empty')}
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div
        className="sticky top-0 z-10 grid min-w-max items-center gap-x-0 border-b border-border bg-card/95 px-2 py-1 backdrop-blur-sm"
        style={gridStyle}
      >
        <HeaderCell
          label={t('files.table.name')}
          column="name"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          onResize={(d): void => resizeColumn('name', d)}
        />
        <HeaderCell
          label={t('files.table.subject')}
          column="subject"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          onResize={(d): void => resizeColumn('subject', d)}
        />
        <HeaderCell
          label={t('files.table.date')}
          column="receivedAt"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          onResize={(d): void => resizeColumn('date', d)}
        />
        <HeaderCell
          label={t('files.table.size')}
          column="size"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          onResize={(d): void => resizeColumn('size', d)}
        />
        <div className="relative min-w-0 pr-2">
          <span className="text-2xs font-medium text-muted-foreground">{t('files.table.account')}</span>
          <FilesTableColumnResizeHandle onResize={(d): void => resizeColumn('type', d)} />
        </div>
        <span className="sr-only">{t('files.table.actions')}</span>
      </div>

      {groups.map((group) => {
        const collapsed = collapsedGroups.has(group.key)
        return (
          <section key={group.key} className="min-w-max">
            <button
              type="button"
              onClick={(): void => onToggleGroup(group.key)}
              className="flex w-full min-w-max items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-1 text-left text-xs font-semibold text-foreground hover:bg-muted/50"
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span>{group.label}</span>
              <span className="font-normal text-muted-foreground">({group.rows.length})</span>
            </button>
            {!collapsed
              ? group.rows.map((row) => {
                  const selected = selectedId === row.id
                  const opening = openingFileId === row.id
                  const account = accountsById.get(row.accountId)
                  const cloudEnabled =
                    account?.provider === 'microsoft' && Boolean(onSaveToCloud)
                  const dateLabel = row.receivedAt
                    ? new Date(row.receivedAt).toLocaleString(
                        i18n.language.startsWith('de') ? 'de-DE' : 'en-GB',
                        { dateStyle: 'short', timeStyle: 'short' }
                      )
                    : '—'
                  return (
                    <div
                      key={row.id}
                      role="row"
                      tabIndex={0}
                      onClick={(): void => onSelect(row)}
                      onDoubleClick={(e): void => {
                        e.preventDefault()
                        e.stopPropagation()
                        void onOpen(row)
                      }}
                      onKeyDown={(e): void => {
                        if (e.key === 'Enter') void onOpen(row)
                      }}
                      title={t('files.table.openHint')}
                      className={cn(
                        'grid min-w-max cursor-default items-center gap-x-0 border-b border-border/40 px-2 py-1.5 text-sm transition-colors',
                        selected ? 'bg-primary/15' : 'hover:bg-secondary/40'
                      )}
                      style={gridStyle}
                    >
                      <div
                        className="flex min-w-0 items-center gap-2 pr-2"
                        onDoubleClick={(e): void => {
                          e.preventDefault()
                          e.stopPropagation()
                          void onOpen(row)
                        }}
                      >
                        {opening ? (
                          <Loader2
                            className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                            aria-hidden
                          />
                        ) : (
                          <MailFileTypeIcon mime={row.mime} name={row.name} />
                        )}
                        <span className="truncate font-medium" title={row.name}>
                          {row.name}
                        </span>
                      </div>
                      <span className="min-w-0 truncate pr-2 text-muted-foreground" title={row.subject}>
                        {row.subject || t('common.noSubject')}
                      </span>
                      <span className="min-w-0 truncate pr-2 tabular-nums text-muted-foreground">
                        {dateLabel}
                      </span>
                      <span className="pr-2 tabular-nums text-muted-foreground">
                        {row.size != null ? formatBytes(row.size) : '—'}
                      </span>
                      <div
                        className="flex min-w-0 items-center gap-1.5 truncate pr-2 text-muted-foreground"
                        title={account?.displayName || account?.email}
                      >
                        {account ? (
                          <AccountAvatarBadge account={account} className="h-4 w-4 text-[8px]" />
                        ) : null}
                        <span className="truncate text-xs">
                          {account?.displayName || account?.email || '—'}
                        </span>
                      </div>
                      <div
                        className="flex items-center justify-end gap-0.5"
                        onDoubleClick={(e): void => e.stopPropagation()}
                      >
                        {cloudEnabled ? (
                          <button
                            type="button"
                            title={t('files.actions.saveToCloud')}
                            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            onClick={(e): void => {
                              e.stopPropagation()
                              onSaveToCloud?.(row)
                            }}
                          >
                            <Cloud className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title={t('files.actions.saveAs')}
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={(e): void => {
                            e.stopPropagation()
                            onSaveAs(row)
                          }}
                        >
                          <Save className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          title={t('files.actions.openSource')}
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={(e): void => {
                            e.stopPropagation()
                            onOpenSource(row)
                          }}
                        >
                          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          title={t('files.actions.open')}
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={(e): void => {
                            e.stopPropagation()
                            void onOpen(row)
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  )
                })
              : null}
          </section>
        )
      })}
    </div>
  )
}
