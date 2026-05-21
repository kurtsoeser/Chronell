import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, CalendarClock, ExternalLink, LayoutGrid, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount } from '@shared/types'
import {
  BOOKINGS_APPOINTMENT_DAYS_OPTIONS,
  persistBookingsAppointmentDays,
  readBookingsAppointmentDays,
  type BookingsAppointmentDays
} from '@/lib/bookings-settings-prefs'
import { openExternalUrl } from '@/lib/open-external'
import { requestOpenAccountSettings } from '@/lib/open-account-settings'
import {
  TOPBAR_MODULE_PREFS_CHANGED_EVENT,
  isTopbarModuleVisible,
  setTopbarModuleVisible
} from '@/app/layout/topbar-module-prefs'

const OUTLOOK_BOOKINGS_URL = 'https://outlook.office.com/bookings/calendar'

export function SettingsBookingsSection({
  accounts,
  subNavId
}: {
  accounts: ConnectedAccount[]
  subNavId: string
}): JSX.Element {
  const { t } = useTranslation()
  const microsoftAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft'),
    [accounts]
  )
  const [topbarVisible, setTopbarVisible] = useState(() => isTopbarModuleVisible('bookings'))
  const [appointmentDays, setAppointmentDays] = useState<BookingsAppointmentDays>(() =>
    readBookingsAppointmentDays()
  )

  useEffect(() => {
    const sync = (): void => {
      setTopbarVisible(isTopbarModuleVisible('bookings'))
    }
    window.addEventListener(TOPBAR_MODULE_PREFS_CHANGED_EVENT, sync)
    return (): void => window.removeEventListener(TOPBAR_MODULE_PREFS_CHANGED_EVENT, sync)
  }, [])

  const onToggleTopbar = useCallback((): void => {
    const next = !topbarVisible
    setTopbarModuleVisible('bookings', next)
    setTopbarVisible(next)
  }, [topbarVisible])

  const onDaysChange = useCallback((days: BookingsAppointmentDays): void => {
    setAppointmentDays(days)
    persistBookingsAppointmentDays(days)
  }, [])

  const openBookWithMeSettings = (): void => {
    requestOpenAccountSettings({ tab: 'calendar' })
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('mailclient:settings-calendar-subnav', { detail: { id: 'bookWithMe' } })
      )
    }, 0)
  }

  const openAccountsTab = (): void => {
    requestOpenAccountSettings({ tab: 'accounts' })
  }

  const openModulesInGeneral = (): void => {
    requestOpenAccountSettings({ tab: 'general' })
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('mailclient:settings-general-subnav', { detail: { id: 'modules' } })
      )
    }, 0)
  }

  if (subNavId === 'personal') {
    return (
      <section className="space-y-3 rounded-md border border-border/35 bg-muted/20 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          {t('settings.bookingsPersonalHeading')}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.bookingsPersonalIntro')}</p>
        <button
          type="button"
          onClick={openBookWithMeSettings}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t('settings.bookingsOpenBookWithMe')}
        </button>
      </section>
    )
  }

  if (subNavId === 'access') {
    return (
      <section className="space-y-3 rounded-md border border-border/35 bg-muted/20 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3.5 w-3.5" aria-hidden />
          {t('settings.bookingsAccessHeading')}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.bookingsAccessIntro')}</p>
        <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
          <li>Bookings.Read.All</li>
          <li>BookingsAppointment.ReadWrite.All</li>
        </ul>
        {microsoftAccounts.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground">
            {t('settings.bookingsMicrosoftOnly')}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('settings.bookingsReconnectHint')}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(): void => void openExternalUrl(OUTLOOK_BOOKINGS_URL)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('settings.bookingsOpenOutlook')}
          </button>
          <button
            type="button"
            onClick={openAccountsTab}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {t('settings.bookingsGoAccounts')}
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2 rounded-md border border-border/35 bg-muted/20 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          {t('settings.bookingsOverviewHeading')}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.bookingsOverviewIntro')}</p>
        {microsoftAccounts.length === 0 ? (
          <p className="rounded-md border border-dashed border-amber-500/35 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200/95">
            {t('settings.bookingsMicrosoftOnly')}
          </p>
        ) : null}
        <button
          type="button"
          onClick={(): void => void openExternalUrl(OUTLOOK_BOOKINGS_URL)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('settings.bookingsOpenOutlook')}
        </button>
      </section>

      <section className="space-y-2 rounded-md border border-border/35 bg-muted/20 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          {t('settings.bookingsTopbarHeading')}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.bookingsTopbarHint')}</p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={topbarVisible}
            onChange={onToggleTopbar}
            className="h-3.5 w-3.5 rounded border-border"
          />
          {t('settings.bookingsTopbarShow')}
        </label>
        <button
          type="button"
          onClick={openModulesInGeneral}
          className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('settings.bookingsAllModulesLink')}
        </button>
      </section>

      <section className="space-y-2 rounded-md border border-border/35 bg-muted/20 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('settings.bookingsRangeHeading')}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.bookingsRangeHint')}</p>
        <select
          value={appointmentDays}
          onChange={(e): void => onDaysChange(Number(e.target.value) as BookingsAppointmentDays)}
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
        >
          {BOOKINGS_APPOINTMENT_DAYS_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {t('settings.bookingsRangeDays', { count: d })}
            </option>
          ))}
        </select>
      </section>
    </div>
  )
}
