import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Copy, ExternalLink, Link2, Loader2, SquareArrowOutUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount } from '@shared/types'
import { BOOK_WITH_ME_MANAGE_URL, isBookWithMeHost } from '@shared/book-with-me'
import { useAccountsStore } from '@/stores/accounts'
import { openExternalUrl } from '@/lib/open-external'
import { requestOpenAccountSettings } from '@/lib/open-account-settings'
import { showAppAlert } from '@/stores/app-dialog'
import { cn } from '@/lib/utils'

export interface BookWithMeAccountPanelProps {
  accounts: ConnectedAccount[]
  /** Kompakte Darstellung fuer die Kalender-Sidebar. */
  compact?: boolean
  disabled?: boolean
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function BookWithMeAccountPanel({
  accounts,
  compact = false,
  disabled = false
}: BookWithMeAccountPanelProps): JSX.Element | null {
  const { t } = useTranslation()
  const patchAccountBookWithMeUrl = useAccountsStore((s) => s.patchAccountBookWithMeUrl)

  const microsoftAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft'),
    [accounts]
  )

  const [accountId, setAccountId] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const selected = microsoftAccounts.find((a) => a.id === accountId) ?? microsoftAccounts[0] ?? null

  useEffect(() => {
    if (!microsoftAccounts.length) return
    setAccountId((prev) =>
      prev && microsoftAccounts.some((a) => a.id === prev) ? prev : microsoftAccounts[0]!.id
    )
  }, [microsoftAccounts])

  useEffect(() => {
    setDraftUrl(selected?.bookWithMeUrl?.trim() ?? '')
    setCopied(false)
  }, [selected?.id, selected?.bookWithMeUrl])

  const savedUrl = selected?.bookWithMeUrl?.trim() ?? ''
  const draftTrimmed = draftUrl.trim()
  const dirty = draftTrimmed !== savedUrl

  const hostWarning = useMemo(() => {
    if (!draftTrimmed) return null
    try {
      const host = new URL(draftTrimmed).hostname
      if (!isBookWithMeHost(host)) {
        return t('settings.bookWithMeHostHint')
      }
    } catch {
      return null
    }
    return null
  }, [draftTrimmed, t])

  const handleSave = useCallback((): void => {
    if (!selected) return
    void (async (): Promise<void> => {
      setSaving(true)
      try {
        await patchAccountBookWithMeUrl(selected.id, draftTrimmed || null)
      } catch (e) {
        void showAppAlert(e instanceof Error ? e.message : String(e), {
          title: t('settings.bookWithMeHeading')
        })
      } finally {
        setSaving(false)
      }
    })()
  }, [selected, draftTrimmed, patchAccountBookWithMeUrl, t])

  const handleCopy = useCallback((): void => {
    const url = savedUrl || draftTrimmed
    if (!url) return
    void (async (): Promise<void> => {
      const ok = await copyTextToClipboard(url)
      if (ok) {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      } else {
        void showAppAlert(t('calendar.errors.clipboardWriteFailed'), {
          title: t('settings.bookWithMeHeading')
        })
      }
    })()
  }, [savedUrl, draftTrimmed, t])

  const openBookWithMeSettings = (): void => {
    requestOpenAccountSettings({ tab: 'calendar' })
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('mailclient:settings-calendar-subnav', { detail: { id: 'bookWithMe' } })
      )
    }, 0)
  }

  if (microsoftAccounts.length === 0) {
    return compact ? null : (
      <p className="rounded-md border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground">
        {t('settings.bookWithMeMicrosoftOnly')}
      </p>
    )
  }

  const urlForActions = savedUrl || null

  if (compact) {
    return (
      <div className="rounded-lg bg-background/60 px-2 py-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="h-3 w-3 shrink-0" aria-hidden />
          {t('calendar.bookWithMe.sidebarTitle')}
        </div>
        {microsoftAccounts.length > 1 ? (
          <select
            value={selected?.id ?? ''}
            onChange={(e): void => setAccountId(e.target.value)}
            disabled={disabled || saving}
            className="mb-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-ring"
          >
            {microsoftAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        ) : null}
        {urlForActions ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={handleCopy}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-secondary/80 disabled:opacity-40"
            >
              <Copy className="h-3 w-3 shrink-0" aria-hidden />
              {copied ? t('calendar.bookWithMe.copied') : t('calendar.bookWithMe.copyLink')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={(): void => {
                void openExternalUrl(BOOK_WITH_ME_MANAGE_URL).catch(() => undefined)
              }}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-secondary/80 disabled:opacity-40"
            >
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              {t('calendar.bookWithMe.manage')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={(): void => {
              void openExternalUrl(BOOK_WITH_ME_MANAGE_URL).catch(() => undefined)
            }}
            className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            {t('calendar.bookWithMe.setupHint')}
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={openBookWithMeSettings}
          className="mt-1 w-full rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-secondary/50 disabled:opacity-40"
        >
          {t('calendar.bookWithMe.openSettings')}
        </button>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          {t('settings.bookWithMeHeading')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('settings.bookWithMeIntro')}</p>
      </div>

      <div className="space-y-2">
        {microsoftAccounts.length > 1 ? (
          <div>
            <div className="mb-1 text-[10px] font-medium text-muted-foreground">
              {t('settings.calendarAccountLabel')}
            </div>
            <select
              value={selected?.id ?? ''}
              onChange={(e): void => setAccountId(e.target.value)}
              disabled={disabled || saving}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
            >
              {microsoftAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} ({a.email})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <div className="mb-1 text-[10px] font-medium text-muted-foreground">
            {t('settings.bookWithMeUrlLabel')}
          </div>
          <input
            type="url"
            value={draftUrl}
            onChange={(e): void => setDraftUrl(e.target.value)}
            placeholder={t('settings.bookWithMeUrlPlaceholder')}
            disabled={disabled || saving}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
          />
          {hostWarning ? (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">{hostWarning}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || saving || !dirty}
            onClick={handleSave}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground',
              (disabled || saving || !dirty) && 'cursor-not-allowed opacity-40'
            )}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {t('settings.bookWithMeSave')}
          </button>
          <button
            type="button"
            disabled={disabled || (!savedUrl && !draftTrimmed)}
            onClick={handleCopy}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary/80 disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {copied ? t('calendar.bookWithMe.copied') : t('settings.bookWithMeCopy')}
          </button>
          {savedUrl ? (
            <button
              type="button"
              disabled={disabled}
              onClick={(): void => {
                void openExternalUrl(savedUrl).catch(() => undefined)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary/80 disabled:opacity-40"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('settings.bookWithMePreview')}
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={(): void => {
              void openExternalUrl(BOOK_WITH_ME_MANAGE_URL).catch(() => undefined)
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary/80 disabled:opacity-40"
          >
            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('settings.bookWithMeManage')}
          </button>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">{t('settings.bookWithMeHint')}</p>
      </div>
    </section>
  )
}
