import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Eraser,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react'
import type { AccountAvatarIconId, AccountAvatarKind } from '@shared/account-avatar'
import { ACCOUNT_AVATAR_ICON_IDS } from '@shared/account-avatar'
import type { AccountMailSyncMeta, ConnectedAccount, SyncStatus } from '@shared/types'
import { AccountSyncStatusButton } from '@/components/AccountSyncStatusButton'
import { AccountAvatarBadge } from '@/components/AccountAvatarBadge'
import { AccountAppearanceSection } from '@/components/account-setup/AccountAppearanceSection'
import { AccountPermissionsInfoBox } from '@/components/account-setup/AccountPermissionsInfoBox'
import { formatAccountLastSyncLabel } from '@/lib/format-sync-timestamp'
import { cn } from '@/lib/utils'

export interface SettingsAccountsPanelProps {
  accounts: ConnectedAccount[]
  accountDisplayAvatarDataUrls: Record<string, string>
  syncByAccount: Record<string, SyncStatus>
  busy: boolean
  hasClientId: boolean
  googleOAuthReady: boolean
  reconnectingAccountId: string | null
  mailCacheClearingAccountId: string | null
  tasksCacheClearingAccountId: string | null
  colorSavingAccountId: string | null
  avatarSavingAccountId: string | null
  mailCacheNotice: string | null
  tasksCacheNotice: string | null
  onAddMicrosoft: () => void
  onAddGoogle: () => void
  onRefreshMicrosoft: (accountId: string) => void
  onRefreshGoogle: (accountId: string) => void
  onRemove: (accountId: string) => void
  onClearMailCache: (accountId: string, email: string) => void
  onClearTasksCache: (accountId: string, email: string) => void
  onColorChange: (accountId: string, color: string) => void
  onAvatarKindChange: (accountId: string, kind: AccountAvatarKind) => void
  onAvatarIconChange: (accountId: string, iconId: AccountAvatarIconId) => void
  onPickCustomAvatar: (accountId: string) => void
  onSyncAccount: (accountId: string) => void
}

function accountServicesLabel(acc: ConnectedAccount, t: (key: string) => string): string {
  if (acc.provider === 'google') {
    return t('settings.accountServicesGoogle')
  }
  return t('settings.accountServicesMicrosoft')
}

export function SettingsAccountsPanel({
  accounts,
  accountDisplayAvatarDataUrls,
  syncByAccount,
  busy,
  hasClientId,
  googleOAuthReady,
  reconnectingAccountId,
  mailCacheClearingAccountId,
  tasksCacheClearingAccountId,
  colorSavingAccountId,
  avatarSavingAccountId,
  mailCacheNotice,
  tasksCacheNotice,
  onAddMicrosoft,
  onAddGoogle,
  onRefreshMicrosoft,
  onRefreshGoogle,
  onRemove,
  onClearMailCache,
  onClearTasksCache,
  onColorChange,
  onAvatarKindChange,
  onAvatarIconChange,
  onPickCustomAvatar,
  onSyncAccount
}: SettingsAccountsPanelProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncMetaByAccount, setSyncMetaByAccount] = useState<Record<string, AccountMailSyncMeta>>({})

  const loadSyncMeta = useCallback((): void => {
    void window.mailClient.mail.getAccountSyncMeta().then((rows) => {
      setSyncMetaByAccount(Object.fromEntries(rows.map((r) => [r.accountId, r])))
    })
  }, [])

  useEffect(() => {
    loadSyncMeta()
  }, [loadSyncMeta, accounts.length])

  useEffect(() => {
    loadSyncMeta()
  }, [syncByAccount, loadSyncMeta])

  useEffect(() => {
    const offMeta = window.mailClient.events.onMailSyncMetaChanged(() => {
      loadSyncMeta()
    })
    const offMail = window.mailClient.events.onMailChanged(() => {
      loadSyncMeta()
    })
    const interval = window.setInterval(() => {
      loadSyncMeta()
    }, 60_000)
    return (): void => {
      offMeta()
      offMail()
      window.clearInterval(interval)
    }
  }, [loadSyncMeta])

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) => (prev && accounts.some((a) => a.id === prev) ? prev : accounts[0]!.id))
  }, [accounts])

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId]
  )

  const selectedMeta = selected ? syncMetaByAccount[selected.id] : undefined
  const selectedLiveSync = selected ? syncByAccount[selected.id] : undefined
  const isSelectedSyncing = Boolean(selectedLiveSync?.state.startsWith('syncing'))
  const lastSyncIso =
    selectedMeta?.lastSyncFinishedAt ?? selectedMeta?.lastActivityAt ?? null

  const actionsDisabled = busy || reconnectingAccountId !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.accountsIntro')}</p>

      {mailCacheNotice ? (
        <p className="text-2xs text-emerald-600 dark:text-emerald-500">{mailCacheNotice}</p>
      ) : null}
      {tasksCacheNotice ? (
        <p className="text-2xs text-emerald-600 dark:text-emerald-500">{tasksCacheNotice}</p>
      ) : null}

      {accounts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-background/40 p-8">
          <p className="text-center text-xs text-muted-foreground">{t('settings.noAccountYet')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <AddAccountButtons
              busy={busy}
              hasClientId={hasClientId}
              googleOAuthReady={googleOAuthReady}
              reconnectingAccountId={reconnectingAccountId}
              onAddMicrosoft={onAddMicrosoft}
              onAddGoogle={onAddGoogle}
              compact={false}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background/30">
          <aside
            className="flex w-[min(220px,38%)] shrink-0 flex-col border-r border-border"
            aria-label={t('settings.accountsListAria')}
          >
            <ul className="min-h-0 flex-1 overflow-y-auto py-1.5">
              {accounts.map((acc) => {
                const meta = syncMetaByAccount[acc.id]
                const live = syncByAccount[acc.id]
                const syncing = Boolean(live?.state.startsWith('syncing'))
                const lastIso = meta?.lastSyncFinishedAt ?? meta?.lastActivityAt ?? null
                const isSelected = acc.id === selectedId
                return (
                  <li key={acc.id}>
                    <button
                      type="button"
                      onClick={(): void => setSelectedId(acc.id)}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted/60'
                      )}
                    >
                      <AccountAvatarBadge
                        account={acc}
                        imageSrc={accountDisplayAvatarDataUrls[acc.id]}
                        inverted={isSelected}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-xs font-semibold',
                            isSelected ? 'text-primary-foreground' : 'text-foreground'
                          )}
                        >
                          {acc.displayName || acc.email}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 block truncate text-2xs',
                            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          )}
                        >
                          {accountServicesLabel(acc, t)}
                        </span>
                        <span
                          className={cn(
                            'mt-1 block truncate text-2xs',
                            isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground/80'
                          )}
                        >
                          {syncing
                            ? t('settings.accountSyncInProgress')
                            : meta?.lastSyncError && live?.state !== 'syncing-messages'
                              ? t('settings.accountSyncFailedShort')
                              : lastIso
                                ? formatAccountLastSyncLabel(lastIso, i18n.language, {
                                    neverLabel: t('settings.accountSyncNever'),
                                    isSyncing: false
                                  }).split(' (')[0]
                                : t('settings.accountSyncNever')}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="shrink-0 border-t border-border p-2">
              <AddAccountButtons
                busy={busy}
                hasClientId={hasClientId}
                googleOAuthReady={googleOAuthReady}
                reconnectingAccountId={reconnectingAccountId}
                onAddMicrosoft={onAddMicrosoft}
                onAddGoogle={onAddGoogle}
                compact
              />
            </div>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {selected ? (
              <div className="space-y-5">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {selected.displayName || selected.email}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">{selected.email}</p>
                    <p className="mt-1 text-2xs text-muted-foreground">
                      {accountServicesLabel(selected, t)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AccountSyncStatusButton
                      sync={selectedLiveSync}
                      disabled={actionsDisabled}
                      onSync={(): void => onSyncAccount(selected.id)}
                      syncedTitle={t('settings.accountSyncNowTitle')}
                      syncingTitle={t('settings.accountSyncInProgress')}
                      syncTitle={t('settings.accountSyncNowTitle')}
                      errorTitlePrefix={t('settings.accountSyncError')}
                    />
                    {selected.provider === 'microsoft' ? (
                      <button
                        type="button"
                        onClick={(): void => onRefreshMicrosoft(selected.id)}
                        disabled={actionsDisabled}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                        title={t('settings.msReconnectTitle')}
                        aria-label={t('settings.msReconnectAria')}
                      >
                        {reconnectingAccountId === selected.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    ) : selected.provider === 'google' ? (
                      <button
                        type="button"
                        onClick={(): void => onRefreshGoogle(selected.id)}
                        disabled={actionsDisabled}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                        title={t('settings.googleReconnectTitle')}
                        aria-label={t('settings.googleReconnectAria')}
                      >
                        {reconnectingAccountId === selected.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={(): void => {
                        void onRemove(selected.id)
                      }}
                      disabled={actionsDisabled}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive disabled:opacity-40"
                      title={t('settings.removeAccountTitle')}
                      aria-label={t('settings.removeAccountTitle')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <AccountAppearanceSection
                  account={selected}
                  displayAvatarDataUrl={accountDisplayAvatarDataUrls[selected.id]}
                  disabled={actionsDisabled}
                  colorSaving={colorSavingAccountId === selected.id}
                  avatarSaving={avatarSavingAccountId === selected.id}
                  onColorChange={(color): void => onColorChange(selected.id, color)}
                  onAvatarKindChange={(kind): void => {
                    if (kind === 'icon' && !selected.avatarIconId) {
                      onAvatarIconChange(selected.id, ACCOUNT_AVATAR_ICON_IDS[0]!)
                    } else {
                      onAvatarKindChange(selected.id, kind)
                    }
                  }}
                  onAvatarIconChange={(iconId): void => onAvatarIconChange(selected.id, iconId)}
                  onPickCustomImage={(): void => onPickCustomAvatar(selected.id)}
                />

                <section className="space-y-1.5 rounded-md border border-border/80 bg-background/60 p-3">
                  <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('settings.accountSyncHeading')}
                  </h4>
                  <p className="text-xs text-foreground">
                    {isSelectedSyncing
                      ? t('settings.accountSyncInProgress')
                      : t('settings.accountLastSyncLine', {
                          time: formatAccountLastSyncLabel(lastSyncIso, i18n.language, {
                            neverLabel: t('settings.accountSyncNever'),
                            isSyncing: false
                          })
                        })}
                  </p>
                  {selectedLiveSync?.state === 'error' && selectedLiveSync.message ? (
                    <p className="text-2xs text-destructive">{selectedLiveSync.message}</p>
                  ) : null}
                  {selectedMeta?.lastSyncError && selectedLiveSync?.state !== 'error' ? (
                    <p className="text-2xs text-muted-foreground">
                      {t('settings.accountLastSyncError', { message: selectedMeta.lastSyncError })}
                    </p>
                  ) : null}
                </section>

                {(selected.provider === 'microsoft' || selected.provider === 'google') && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(): void => {
                        void onClearMailCache(selected.id, selected.email)
                      }}
                      disabled={
                        actionsDisabled ||
                        mailCacheClearingAccountId !== null ||
                        tasksCacheClearingAccountId !== null
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium outline-none transition-colors hover:bg-secondary/80 disabled:opacity-40"
                      title={t('settings.clearMailCacheTitle')}
                    >
                      {mailCacheClearingAccountId === selected.id ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <Eraser className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      {t('settings.clearMailCacheButton')}
                    </button>
                    <button
                      type="button"
                      onClick={(): void => {
                        void onClearTasksCache(selected.id, selected.email)
                      }}
                      disabled={
                        actionsDisabled ||
                        mailCacheClearingAccountId !== null ||
                        tasksCacheClearingAccountId !== null
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium outline-none transition-colors hover:bg-secondary/80 disabled:opacity-40"
                      title={t('settings.clearTasksCacheTitle')}
                    >
                      {tasksCacheClearingAccountId === selected.id ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <ListTodo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      {t('settings.clearTasksCacheButton')}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <AccountPermissionsInfoBox />
    </div>
  )
}

function AddAccountButtons({
  busy,
  hasClientId,
  googleOAuthReady,
  reconnectingAccountId,
  onAddMicrosoft,
  onAddGoogle,
  compact
}: {
  busy: boolean
  hasClientId: boolean
  googleOAuthReady: boolean
  reconnectingAccountId: string | null
  onAddMicrosoft: () => void
  onAddGoogle: () => void
  compact?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const btnClass = compact
    ? 'flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-2xs font-medium'
    : 'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium'
  return (
    <div className={cn('flex gap-1.5', compact ? 'flex-col' : 'flex-wrap')}>
      <button
        type="button"
        onClick={onAddMicrosoft}
        disabled={busy || !hasClientId || reconnectingAccountId !== null}
        className={cn(
          btnClass,
          'transition-colors',
          busy || !hasClientId || reconnectingAccountId !== null
            ? 'bg-secondary text-muted-foreground'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
        title={!hasClientId ? t('settings.msNoClientTitle') : t('settings.msConnectTitle')}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Microsoft
      </button>
      <button
        type="button"
        onClick={onAddGoogle}
        disabled={busy || !googleOAuthReady || reconnectingAccountId !== null}
        className={cn(
          btnClass,
          'transition-colors',
          busy || !googleOAuthReady || reconnectingAccountId !== null
            ? 'bg-secondary text-muted-foreground'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
        title={
          !googleOAuthReady
            ? t('settings.googleConfigureFirstTitle')
            : t('settings.googleConnectTitle')
        }
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Google
      </button>
    </div>
  )
}
