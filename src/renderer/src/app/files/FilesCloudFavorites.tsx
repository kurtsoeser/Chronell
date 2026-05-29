import { useCallback, useEffect, useState } from 'react'
import { Loader2, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ComposeDriveExplorerFavorite, ComposeDriveExplorerNavCrumb, ComposeDriveExplorerScope } from '@shared/types'
import {
  buildFilesDriveUploadDestination,
  canSaveToCurrentExplorerPath
} from '@/lib/drive-explorer-destination'
import { driveExplorerCrumbsMatch } from '@/lib/drive-explorer-favorites-nav'
import { cn } from '@/lib/utils'

function isWellFormedFavorite(f: unknown): f is ComposeDriveExplorerFavorite {
  if (!f || typeof f !== 'object') return false
  const o = f as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.label !== 'string') return false
  if (o.scope !== 'recent' && o.scope !== 'myfiles' && o.scope !== 'shared' && o.scope !== 'sharepoint') {
    return false
  }
  return Array.isArray(o.crumbs)
}

interface Props {
  accountId: string
  scope: ComposeDriveExplorerScope
  crumbs: ComposeDriveExplorerNavCrumb[]
  onApply: (scope: ComposeDriveExplorerScope, crumbs: ComposeDriveExplorerNavCrumb[]) => void
}

export function FilesCloudFavorites({ accountId, scope, crumbs, onApply }: Props): JSX.Element {
  const { t } = useTranslation()
  const [favorites, setFavorites] = useState<ComposeDriveExplorerFavorite[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (!accountId) return
    setLoading(true)
    try {
      const rows = await window.mailClient.compose.listDriveExplorerFavorites(accountId)
      setFavorites(Array.isArray(rows) ? rows.filter(isWellFormedFavorite) : [])
    } catch {
      setFavorites([])
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const currentPathFavorite = favorites.find((f) =>
    driveExplorerCrumbsMatch(f.scope, f.crumbs, scope, crumbs)
  )

  async function addCurrent(): Promise<void> {
    setHint(null)
    if (!canSaveToCurrentExplorerPath(scope, crumbs)) {
      setHint(t('files.cloud.pickFolderInvalid'))
      return
    }
    if (currentPathFavorite) return
    setSaving(true)
    try {
      const label = buildFilesDriveUploadDestination(accountId, scope, crumbs).folderLabel
      await window.mailClient.compose.addDriveExplorerFavorite({
        accountId,
        scope,
        crumbs,
        label
      })
      await refresh()
    } catch (e) {
      setHint(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function applyFavorite(f: ComposeDriveExplorerFavorite): void {
    setHint(null)
    onApply(
      f.scope,
      f.crumbs.map((c) => ({
        id: c.id,
        name: c.name,
        driveId: c.driveId ?? null,
        siteId: c.siteId ?? null
      }))
    )
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-1 px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('files.cloud.favorites')}
        </h3>
        {loading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      <button
        type="button"
        disabled={Boolean(currentPathFavorite) || saving || !canSaveToCurrentExplorerPath(scope, crumbs)}
        className="mb-1.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        onClick={(): void => void addCurrent()}
      >
        <Star
          className={cn('h-3.5 w-3.5 shrink-0', currentPathFavorite && 'fill-amber-400 text-amber-500')}
          aria-hidden
        />
        <span className="truncate">
          {currentPathFavorite
            ? t('files.cloud.favoriteSaved')
            : t('files.cloud.addFavorite')}
        </span>
      </button>
      {hint ? (
        <p className="mb-1 px-1 text-[10px] text-destructive">{hint}</p>
      ) : null}
      {favorites.length === 0 ? (
        <p className="px-1 text-[11px] text-muted-foreground">{t('files.cloud.favoritesEmpty')}</p>
      ) : (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
          {favorites.map((f) => {
            const active = driveExplorerCrumbsMatch(f.scope, f.crumbs, scope, crumbs)
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={(): void => applyFavorite(f)}
                  className={cn(
                    'flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors',
                    active
                      ? 'bg-secondary font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  )}
                  title={f.label}
                >
                  <Star className="mt-0.5 h-3 w-3 shrink-0 text-amber-500/90" aria-hidden />
                  <span className="line-clamp-2 min-w-0 flex-1 leading-snug">{f.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
