import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cloud, Loader2, LogOut, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  replaceLocalStorageFromBackup,
  snapshotLocalStorage
} from '@/lib/local-storage-snapshot'
import { formatProfileSyncTimestamp } from '@/lib/format-profile-sync-timestamp'
import type { ProfileDataMode, ProfileSyncRunResult, ProfileSyncStatus } from '@shared/types'

export function AccountSetupCloudSyncSection(): JSX.Element {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<ProfileSyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const s = await window.mailClient.profileSync.getStatus()
      setStatus(s)
      if (s.session?.email) setEmail(s.session.email)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const offStatus = window.mailClient.events.onProfileSyncStatus((s) => {
      setStatus(s)
    })
    return offStatus
  }, [refresh])

  async function handleSetMode(mode: ProfileDataMode): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const s = await window.mailClient.profileSync.setDataMode(mode)
      setStatus(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleSendOtp(): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await window.mailClient.profileSync.sendOtp(email)
      setOtpSent(true)
      setNotice(t('settings.cloudSync.otpSent'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp(): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const s = await window.mailClient.profileSync.verifyOtp(email, otp)
      setStatus(s)
      setOtp('')
      setOtpSent(false)
      setNotice(t('settings.cloudSync.signedIn'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleSignInMicrosoft365(): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const s = await window.mailClient.profileSync.signInMicrosoft365()
      setStatus(s)
      setOtpSent(false)
      setNotice(t('settings.cloudSync.signedInMicrosoft'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut(): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const s = await window.mailClient.profileSync.signOut()
      setStatus(s)
      setOtpSent(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function formatSyncResult(r: ProfileSyncRunResult): string {
    if (!r.ok) return r.error
    const parts: string[] = []
    if (r.pulled) parts.push(t('settings.cloudSync.resultPulled'))
    if (r.pushed) parts.push(t('settings.cloudSync.resultPushed'))
    if (r.attachmentsUploaded > 0) {
      parts.push(t('settings.cloudSync.resultAttachmentsUp', { count: r.attachmentsUploaded }))
    }
    if (r.attachmentsDownloaded > 0) {
      parts.push(t('settings.cloudSync.resultAttachmentsDown', { count: r.attachmentsDownloaded }))
    }
    if (parts.length === 0) parts.push(t('settings.cloudSync.resultNoChanges'))
    return parts.join(' · ')
  }

  async function handleSyncNow(): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const ls = snapshotLocalStorage()
      const r = await window.mailClient.profileSync.syncNow(ls)
      if (!r.ok) {
        setError(r.error)
        return
      }
      if (r.localStorage) {
        replaceLocalStorageFromBackup(r.localStorage)
        setNotice(`${formatSyncResult(r)} ${t('settings.cloudSync.reloadHint')}`)
        window.location.reload()
        return
      }
      setNotice(formatSyncResult(r))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const configured = status?.configured ?? false
  const signedIn = status?.signedIn ?? false
  const dataMode = status?.dataMode ?? 'local'

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Cloud className="h-3.5 w-3.5" />
        {t('settings.cloudSync.heading')}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.cloudSync.intro')}</p>

      {!configured && !loading ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
          {t('settings.cloudSync.notConfigured')}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('common.loading')}
        </p>
      ) : status ? (
        <div className="space-y-3">
          {status.conflictRemoteNewer ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-100">
              {t('settings.cloudSync.conflictHint')}
            </p>
          ) : null}
          {status.syncing ? (
            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('settings.cloudSync.syncing')}
            </p>
          ) : status.autoSyncActive ? (
            <p className="text-[10px] text-muted-foreground">{t('settings.cloudSync.autoSyncOn')}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={(): void => void handleSetMode('local')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                dataMode === 'local'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-secondary/80 text-foreground hover:bg-secondary'
              )}
            >
              {t('settings.cloudSync.modeLocal')}
            </button>
            <button
              type="button"
              disabled={busy || !configured}
              onClick={(): void => void handleSetMode('cloud')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                dataMode === 'cloud'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-secondary/80 text-foreground hover:bg-secondary'
              )}
            >
              {t('settings.cloudSync.modeCloud')}
            </button>
          </div>

          {status.deviceId ? (
            <p className="text-[10px] text-muted-foreground">
              {t('settings.cloudSync.deviceId', { id: status.deviceId.slice(0, 8) })}
            </p>
          ) : null}

          {signedIn && status.session ? (
            <p className="text-[11px] text-foreground">
              {t('settings.cloudSync.signedInAs', {
                email: status.session.email ?? status.session.userId
              })}
            </p>
          ) : null}

          {!signedIn && dataMode === 'cloud' && configured ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">{t('settings.cloudSync.loginIntro')}</p>
              <button
                type="button"
                disabled={busy}
                onClick={(): void => void handleSignInMicrosoft365()}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#2f2f2f] px-3 py-2 text-xs font-medium text-white hover:bg-[#3a3a3a] disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden>
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                )}
                {t('settings.cloudSync.signInMicrosoft365')}
              </button>
              <p className="text-center text-[10px] text-muted-foreground">
                {t('settings.cloudSync.loginDivider')}
              </p>
              <input
                type="email"
                value={email}
                onChange={(e): void => setEmail(e.target.value)}
                placeholder={t('settings.cloudSync.emailPlaceholder')}
                autoComplete="email"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
              />
              {!otpSent ? (
                <button
                  type="button"
                  disabled={busy || !email.trim()}
                  onClick={(): void => void handleSendOtp()}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {t('settings.cloudSync.sendCode')}
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e): void => setOtp(e.target.value)}
                    placeholder={t('settings.cloudSync.codePlaceholder')}
                    autoComplete="one-time-code"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
                  />
                  <button
                    type="button"
                    disabled={busy || !otp.trim()}
                    onClick={(): void => void handleVerifyOtp()}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {t('settings.cloudSync.verifyCode')}
                  </button>
                </>
              )}
            </div>
          ) : null}

          {signedIn ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || dataMode !== 'cloud'}
                onClick={(): void => void handleSyncNow()}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {t('settings.cloudSync.syncNow')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={(): void => void handleSignOut()}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t('settings.cloudSync.signOut')}
              </button>
            </div>
          ) : null}

          {status.lastPushedAt || status.lastPulledAt || status.remoteUpdatedAt ? (
            <ul className="space-y-0.5 text-[10px] text-muted-foreground">
              {status.lastPulledAt ? (
                <li>
                  {t('settings.cloudSync.lastPull', {
                    at: formatProfileSyncTimestamp(status.lastPulledAt, i18n.language)
                  })}
                </li>
              ) : null}
              {status.lastPushedAt ? (
                <li>
                  {t('settings.cloudSync.lastPush', {
                    at: formatProfileSyncTimestamp(status.lastPushedAt, i18n.language)
                  })}
                </li>
              ) : null}
              {status.remoteUpdatedAt ? (
                <li>
                  {t('settings.cloudSync.remoteAt', {
                    at: formatProfileSyncTimestamp(status.remoteUpdatedAt, i18n.language)
                  })}
                </li>
              ) : null}
            </ul>
          ) : null}

          {status.lastError ? (
            <p className="text-[10px] text-destructive">{status.lastError}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {notice ? <p className="text-[11px] text-emerald-500">{notice}</p> : null}
    </section>
  )
}
