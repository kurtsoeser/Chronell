import { useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FilesMailGroupBy, MailFileIndexRow } from '@shared/files'
import {
  buildFilesMailGroupingLabels,
  groupMailFileRows
} from '@/lib/files-mail-grouping'
import type { ConnectedAccount } from '@shared/types'
import { FilesMailTile } from '@/app/files/FilesMailTile'

interface Props {
  rows: MailFileIndexRow[]
  accountsById: Map<string, ConnectedAccount>
  groupBy: FilesMailGroupBy
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
  onContextMenu?: (row: MailFileIndexRow, event: React.MouseEvent) => void
}

export function FilesTilesView({
  rows,
  accountsById,
  groupBy,
  selectedId,
  openingFileId,
  onSelect,
  onOpen,
  onSaveAs,
  onSaveToCloud,
  onOpenSource,
  collapsedGroups,
  onToggleGroup,
  emptyMessage,
  onContextMenu
}: Props): JSX.Element {
  const { t, i18n } = useTranslation()

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

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {emptyMessage ?? t('files.table.empty')}
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      {groups.map((group) => {
        const collapsed = collapsedGroups.has(group.key)
        return (
          <section key={group.key} className="min-w-0">
            <button
              type="button"
              onClick={(): void => onToggleGroup(group.key)}
              className="sticky top-0 z-[1] flex w-full items-center gap-2 border-b border-border/60 bg-card/95 px-3 py-1.5 text-left text-xs font-semibold text-foreground backdrop-blur-sm hover:bg-muted/50"
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span>{group.label}</span>
              <span className="font-normal text-muted-foreground">({group.rows.length})</span>
            </button>
            {!collapsed ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-3 p-3">
                {group.rows.map((row) => {
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
                    <FilesMailTile
                      key={row.id}
                      row={row}
                      account={account}
                      selected={selectedId === row.id}
                      opening={openingFileId === row.id}
                      cloudEnabled={cloudEnabled}
                      dateLabel={dateLabel}
                      onSelect={(): void => onSelect(row)}
                      onOpen={(): void => onOpen(row)}
                      onSaveAs={(): void => onSaveAs(row)}
                      onSaveToCloud={onSaveToCloud ? (): void => onSaveToCloud(row) : undefined}
                      onOpenSource={(): void => onOpenSource(row)}
                      onContextMenu={(e): void => onContextMenu?.(row, e)}
                    />
                  )
                })}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
