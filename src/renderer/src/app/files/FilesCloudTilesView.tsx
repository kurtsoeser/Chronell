import type { CloudFileRow } from '@shared/files'
import type { ConnectedAccount } from '@shared/types'
import { FilesCloudTile } from '@/app/files/FilesCloudTile'

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

export function FilesCloudTilesView({
  rows,
  accountsById,
  selectedKey,
  onSelect,
  onOpenFolder,
  onOpenFile,
  onSaveAs,
  onCopyLink
}: Props): JSX.Element {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-3 p-3">
        {rows.map((row) => {
          const account = accountsById.get(row.accountId)
          return (
            <FilesCloudTile
              key={row.rowKey}
              row={row}
              account={account}
              selected={selectedKey === row.rowKey}
              onSelect={(): void => onSelect(row)}
              onOpen={(): void => {
                if (row.isFolder) onOpenFolder(row)
                else onOpenFile(row)
              }}
              onSaveAs={(): void => onSaveAs(row)}
              onCopyLink={(): void => onCopyLink(row)}
            />
          )
        })}
      </div>
    </div>
  )
}
