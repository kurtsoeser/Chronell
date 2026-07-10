import { Cloud, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FilesShellSourceId } from '@shared/files'
import type { ComposeDriveExplorerNavCrumb, ComposeDriveExplorerScope, ConnectedAccount } from '@shared/types'
import { FilesCloudFavorites } from '@/app/files/FilesCloudFavorites'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import { cn } from '@/lib/utils'
import { moduleNavColumnScrollClass } from '@/components/module-shell-layout'

interface Props {
  source: FilesShellSourceId
  onSourceChange: (source: FilesShellSourceId) => void
  accounts: ConnectedAccount[]
  /** Mail: Mehrfachauswahl (null = alle). */
  selectedMailAccountIds: string[] | null
  onChangeMailAccountIds: (ids: string[] | null) => void
  /** Cloud: genau ein Konto (Microsoft oder Google). */
  cloudAccountId: string | null
  onChangeCloudAccountId: (id: string) => void
  cloudScope: ComposeDriveExplorerScope
  cloudCrumbs: ComposeDriveExplorerNavCrumb[]
  onApplyCloudPath: (scope: ComposeDriveExplorerScope, crumbs: ComposeDriveExplorerNavCrumb[]) => void
  indexPending: number
}

function CloudAccountList({
  accounts,
  activeId,
  onSelect
}: {
  accounts: ConnectedAccount[]
  activeId: string | null
  onSelect: (id: string) => void
}): JSX.Element | null {
  if (accounts.length === 0) return null
  return (
    <ul className="space-y-0.5">
      {accounts.map((acc) => {
        const active = activeId === acc.id
        return (
          <li key={acc.id}>
            <button
              type="button"
              onClick={(): void => onSelect(acc.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50'
              )}
            >
              <AccountAvatarBadge account={acc} className="h-5 w-5 shrink-0 text-[10px]" />
              <span className="min-w-0 truncate">{acc.displayName || acc.email}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function FilesShellSidebar({
  source,
  onSourceChange,
  accounts,
  selectedMailAccountIds,
  onChangeMailAccountIds,
  cloudAccountId,
  onChangeCloudAccountId,
  cloudScope,
  cloudCrumbs,
  onApplyCloudPath,
  indexPending
}: Props): JSX.Element {
  const { t } = useTranslation()

  const microsoftAccounts = accounts.filter((a) => a.provider === 'microsoft')
  const googleAccounts = accounts.filter((a) => a.provider === 'google')
  const cloudAccounts = [...microsoftAccounts, ...googleAccounts]
  const selectedCloudAccount = cloudAccountId
    ? accounts.find((a) => a.id === cloudAccountId)
    : null
  const mailAllSelected =
    selectedMailAccountIds == null || selectedMailAccountIds.length === 0

  function toggleMailAccount(accountId: string): void {
    if (mailAllSelected) {
      onChangeMailAccountIds([accountId])
      return
    }
    const set = new Set(selectedMailAccountIds ?? [])
    if (set.has(accountId)) {
      set.delete(accountId)
      onChangeMailAccountIds(set.size > 0 ? [...set] : null)
    } else {
      set.add(accountId)
      onChangeMailAccountIds([...set])
    }
  }

  return (
    <div className={cn(moduleNavColumnScrollClass, 'flex flex-col gap-3 p-3')}>
      <div>
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('files.sidebar.source')}
        </h2>
        <div
          className="mt-1.5 flex rounded-lg bg-muted/50 p-0.5"
          role="group"
          aria-label={t('files.sidebar.source')}
        >
          <button
            type="button"
            aria-pressed={source === 'mail'}
            title={t('files.sidebar.fromMail')}
            onClick={(): void => onSourceChange('mail')}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              source === 'mail'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t('files.sidebar.fromMailShort')}</span>
          </button>
          <button
            type="button"
            aria-pressed={source === 'cloud'}
            title={t('files.sidebar.fromCloud')}
            onClick={(): void => onSourceChange('cloud')}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              source === 'cloud'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t('files.sidebar.fromCloudShort')}</span>
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {source === 'mail' ? t('files.sidebar.fromMailHint') : t('files.sidebar.fromCloudHint')}
        </p>
      </div>

      <div>
        <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('files.sidebar.accounts')}
        </h3>
        {source === 'mail' ? (
          <>
            <button
              type="button"
              onClick={(): void => onChangeMailAccountIds(null)}
              className={cn(
                'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                mailAllSelected
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50'
              )}
            >
              {t('files.sidebar.allAccounts')}
            </button>
            <ul className="mt-1 space-y-0.5">
              {accounts.map((acc) => {
                const active =
                  !mailAllSelected && (selectedMailAccountIds?.includes(acc.id) ?? false)
                return (
                  <li key={acc.id}>
                    <button
                      type="button"
                      onClick={(): void => toggleMailAccount(acc.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        active
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/50'
                      )}
                    >
                      <AccountAvatarBadge account={acc} className="h-5 w-5 shrink-0 text-[10px]" />
                      <span className="min-w-0 truncate">{acc.displayName || acc.email}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : cloudAccounts.length === 0 ? (
          <p className="px-1 text-[11px] text-muted-foreground">{t('files.cloud.noCloudAccount')}</p>
        ) : (
          <div className="space-y-3">
            {microsoftAccounts.length > 0 ? (
              <div>
                <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('files.sidebar.cloudMicrosoft')}
                </p>
                <CloudAccountList
                  accounts={microsoftAccounts}
                  activeId={cloudAccountId}
                  onSelect={onChangeCloudAccountId}
                />
              </div>
            ) : null}
            {googleAccounts.length > 0 ? (
              <div>
                <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('files.sidebar.cloudGoogle')}
                </p>
                <CloudAccountList
                  accounts={googleAccounts}
                  activeId={cloudAccountId}
                  onSelect={onChangeCloudAccountId}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {source === 'cloud' &&
      cloudAccountId &&
      selectedCloudAccount?.provider === 'microsoft' ? (
        <FilesCloudFavorites
          accountId={cloudAccountId}
          scope={cloudScope}
          crumbs={cloudCrumbs}
          onApply={onApplyCloudPath}
        />
      ) : null}

      {source === 'mail' && indexPending > 0 ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          {t('files.sidebar.indexPending', { count: indexPending })}
        </p>
      ) : null}
    </div>
  )
}
