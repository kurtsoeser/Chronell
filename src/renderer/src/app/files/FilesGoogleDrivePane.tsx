import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUp, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  CloudFileRow,
  FilesMailCategory,
  FilesMailViewMode,
  GoogleDriveExplorerNavCrumb,
  GoogleDriveExplorerScope
} from '@shared/files'
import { matchesFilesMailCategory } from '@shared/attachment-category'
import type { ComposeDriveExplorerEntry, ConnectedAccount } from '@shared/types'
import { FilterTabs, type FilterTabOption } from '@/components/FilterTabs'
import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { FilesCloudTableView } from '@/app/files/FilesCloudTableView'
import { FilesCloudTilesView } from '@/app/files/FilesCloudTilesView'
import {
  persistFilesShellGoogleCrumbs,
  persistFilesShellGoogleScope
} from '@/app/files/files-shell-storage'
import { useUndoStore } from '@/stores/undo'

const GOOGLE_SCOPE_IDS: GoogleDriveExplorerScope[] = ['mydrive', 'sharedWithMe', 'starred']

function rootLabelForScope(scope: GoogleDriveExplorerScope, t: (key: string) => string): string {
  return t(`files.cloud.googleScopes.${scope}`)
}

function buildLocationLabel(
  scope: GoogleDriveExplorerScope,
  crumbs: GoogleDriveExplorerNavCrumb[],
  t: (key: string) => string
): string {
  const parts = [rootLabelForScope(scope, t), ...crumbs.map((c) => c.name)]
  return parts.join(' / ')
}

function entryToCloudRow(
  entry: ComposeDriveExplorerEntry,
  accountId: string,
  scope: GoogleDriveExplorerScope,
  crumbs: GoogleDriveExplorerNavCrumb[],
  t: (key: string) => string
): CloudFileRow {
  return {
    rowKey: `${accountId}:google:${entry.id}`,
    accountId,
    cloudProvider: 'google',
    itemId: entry.id,
    driveId: null,
    siteId: null,
    name: entry.name,
    webUrl: entry.webUrl,
    mime: entry.mimeType,
    size: entry.size,
    isFolder: entry.isFolder,
    scope,
    locationLabel: buildLocationLabel(scope, crumbs, t),
    elementType: 'cloud'
  }
}

export interface FilesGoogleCloudListStats {
  shown: number
  total: number
}

interface Props {
  accountId: string
  accountsById: Map<string, ConnectedAccount>
  scope: GoogleDriveExplorerScope
  crumbs: GoogleDriveExplorerNavCrumb[]
  category: FilesMailCategory
  search: string
  viewMode: FilesMailViewMode
  onScopeChange: (scope: GoogleDriveExplorerScope) => void
  onCrumbsChange: (crumbs: GoogleDriveExplorerNavCrumb[]) => void
  onSelectionChange: (row: CloudFileRow | null) => void
  onStatsChange: (stats: FilesGoogleCloudListStats) => void
  refreshToken?: number
  onContextMenu?: (row: CloudFileRow, event: React.MouseEvent) => void
}

export function FilesGoogleDrivePane({
  accountId,
  accountsById,
  scope,
  crumbs,
  category,
  search,
  viewMode,
  onScopeChange,
  onCrumbsChange,
  onSelectionChange,
  onStatsChange,
  refreshToken = 0,
  onContextMenu
}: Props): JSX.Element {
  const { t } = useTranslation()
  const pushToast = useUndoStore((s) => s.pushToast)
  const [entries, setEntries] = useState<ComposeDriveExplorerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CloudFileRow | null>(null)

  const scopeTabs = useMemo((): FilterTabOption<GoogleDriveExplorerScope>[] => {
    return GOOGLE_SCOPE_IDS.map((id) => ({
      id,
      label: t(`files.cloud.googleScopes.${id}`)
    }))
  }, [t])

  const folderId = crumbs.length > 0 ? (crumbs[crumbs.length - 1]?.id ?? null) : null

  const load = useCallback(async (): Promise<void> => {
    if (!accountId) return
    setLoading(true)
    setLoadError(null)
    try {
      const list = await window.mailClient.files.listGoogleDrive({
        accountId,
        scope,
        folderId
      })
      setEntries(list)
    } catch (e) {
      setEntries([])
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [accountId, scope, folderId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const rows = useMemo((): CloudFileRow[] => {
    const q = search.trim().toLowerCase()
    let list = entries.map((e) => entryToCloudRow(e, accountId, scope, crumbs, t))
    if (category !== 'all') {
      list = list.filter(
        (r) => r.isFolder || matchesFilesMailCategory(category, r.mime, r.name)
      )
    }
    if (q) {
      list = list.filter((r) => r.name.toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return list
  }, [entries, accountId, scope, crumbs, category, search, t])

  useEffect(() => {
    onStatsChange({ shown: rows.length, total: entries.length })
  }, [rows.length, entries.length, onStatsChange])

  useEffect(() => {
    onSelectionChange(selected)
  }, [selected, onSelectionChange])

  useEffect(() => {
    setSelected(null)
  }, [accountId, scope, crumbs])

  const rootLabel = rootLabelForScope(scope, t)
  const canGoUp = crumbs.length > 0

  function setScope(next: GoogleDriveExplorerScope): void {
    onScopeChange(next)
    onCrumbsChange([])
    persistFilesShellGoogleScope(next)
    persistFilesShellGoogleCrumbs([])
  }

  function navigateTo(nextCrumbs: GoogleDriveExplorerNavCrumb[]): void {
    onCrumbsChange(nextCrumbs)
    persistFilesShellGoogleCrumbs(nextCrumbs)
    setSelected(null)
  }

  function openFolder(row: CloudFileRow): void {
    navigateTo([...crumbs, { id: row.itemId, name: row.name }])
  }

  function goCrumb(index: number): void {
    navigateTo(crumbs.slice(0, index + 1))
  }

  function clearToRoot(): void {
    navigateTo([])
  }

  const goParent = useCallback((): void => {
    if (crumbs.length > 0) {
      const next = crumbs.slice(0, -1)
      onCrumbsChange(next)
      persistFilesShellGoogleCrumbs(next)
      setSelected(null)
    }
  }, [crumbs, onCrumbsChange])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Backspace' && e.altKey && canGoUp) {
        e.preventDefault()
        goParent()
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [canGoUp, goParent])

  async function openFile(row: CloudFileRow): Promise<void> {
    if (row.isFolder) {
      openFolder(row)
      return
    }
    const url = row.webUrl?.trim()
    if (!url) {
      pushToast({ label: t('files.cloud.noWebUrl'), variant: 'error' })
      return
    }
    const res = await window.mailClient.files.openCloudItemExternal({ webUrl: url })
    if (!res.ok && res.error) {
      pushToast({ label: res.error, variant: 'error' })
    }
  }

  async function saveAs(row: CloudFileRow): Promise<void> {
    const res = await window.mailClient.files.saveCloudItemAs({
      accountId: row.accountId,
      itemId: row.itemId,
      driveId: row.driveId,
      suggestedName: row.name
    })
    if (res.ok) {
      pushToast({ label: t('files.cloud.savedLocal', { name: row.name }), variant: 'success' })
    } else if (!res.cancelled && res.error) {
      pushToast({ label: res.error, variant: 'error' })
    }
  }

  async function copyLink(row: CloudFileRow): Promise<void> {
    const url = row.webUrl?.trim()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      pushToast({ label: t('files.cloud.linkCopied'), variant: 'success' })
    } catch {
      pushToast({ label: t('files.cloud.linkCopyFailed'), variant: 'error' })
    }
  }

  const emptyMessage =
    search.trim() || category !== 'all'
      ? t('files.table.emptyFiltered')
      : t('files.cloud.tableEmpty')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-1">
        <FilterTabs
          value={scope}
          options={scopeTabs}
          onChange={setScope}
          ariaLabel={t('files.cloud.googleScopesAria')}
          size="compact"
        />
      </div>

      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1 text-2xs text-muted-foreground',
          listSubtleBorderClass
        )}
      >
        <button
          type="button"
          disabled={!canGoUp}
          className="mr-0.5 rounded p-1 hover:bg-secondary hover:text-foreground disabled:opacity-30"
          title={t('files.cloud.goParent')}
          aria-label={t('files.cloud.goParent')}
          onClick={goParent}
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className={cn(
            'rounded px-1.5 py-0.5 hover:bg-secondary hover:text-foreground',
            crumbs.length === 0 && 'font-medium text-foreground'
          )}
          onClick={clearToRoot}
        >
          {rootLabel}
        </button>
        {crumbs.map((c, i) => (
          <span key={`${c.id ?? 'r'}-${i}`} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
            <button
              type="button"
              className={cn(
                'max-w-[200px] truncate rounded px-1.5 py-0.5 hover:bg-secondary hover:text-foreground',
                i === crumbs.length - 1 && 'font-medium text-foreground'
              )}
              title={c.name}
              onClick={(): void => goCrumb(i)}
            >
              {c.name}
            </button>
          </span>
        ))}
        <button
          type="button"
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={(): void => void load()}
          title={t('files.refresh')}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
        </button>
      </div>

      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-destructive">
          <p>{loadError}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            onClick={(): void => void load()}
          >
            {t('files.cloud.retry')}
          </button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('files.cloud.loading')}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : viewMode === 'tiles' ? (
        <FilesCloudTilesView
          rows={rows}
          accountsById={accountsById}
          selectedKey={selected?.rowKey ?? null}
          onSelect={setSelected}
          onOpenFolder={openFolder}
          onOpenFile={(row): void => void openFile(row)}
          onSaveAs={(row): void => void saveAs(row)}
          onCopyLink={(row): void => void copyLink(row)}
          onContextMenu={onContextMenu}
        />
      ) : (
        <FilesCloudTableView
          rows={rows}
          accountsById={accountsById}
          selectedKey={selected?.rowKey ?? null}
          onSelect={setSelected}
          onOpenFolder={openFolder}
          onOpenFile={(row): void => void openFile(row)}
          onSaveAs={(row): void => void saveAs(row)}
          onCopyLink={(row): void => void copyLink(row)}
          onContextMenu={onContextMenu}
        />
      )}
    </div>
  )
}
