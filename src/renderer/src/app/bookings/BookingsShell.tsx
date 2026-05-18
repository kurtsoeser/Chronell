import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import {
  Building2,
  CalendarClock,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Users
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  BookingsAppointmentRow,
  BookingsBusinessDetail,
  BookingsBusinessRow,
  BookingsServiceRow,
  BookingsStaffMemberRow,
  ConnectedAccount
} from '@shared/types'
import { resolveBookingsPublicUrl } from '@shared/bookings-public-url'
import { BookingsWeekCalendar } from '@/app/bookings/BookingsWeekCalendar'
import { BookingsAppointmentPreviewPane } from '@/app/bookings/BookingsAppointmentPreviewPane'
import {
  persistBookingsPreviewOpen,
  persistBookingsPreviewPlacement,
  persistBookingsPreviewWidth,
  readBookingsPreviewOpen,
  readBookingsPreviewPlacement,
  readBookingsPreviewWidth,
  type BookingsPreviewPlacement
} from '@/app/bookings/bookings-shell-storage'
import { CalendarPreviewPaneToolbarButton } from '@/app/calendar/CalendarPosteingangToolbar'
import { VerticalSplitter, useResizableWidth } from '@/components/ResizableSplitter'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderActionsClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderShellBarClass,
  moduleColumnHeaderTitleClass
} from '@/components/ModuleColumnHeader'
import { moduleNavColumnClass, moduleNavColumnScrollClass } from '@/components/module-shell-layout'
import { useAccountsStore } from '@/stores/accounts'
import { useLocaleStore } from '@/stores/locale'
import { openExternalUrl } from '@/lib/open-external'
import { cn } from '@/lib/utils'
import {
  BOOKINGS_APPOINTMENT_DAYS_CHANGED_EVENT,
  readBookingsAppointmentDays
} from '@/lib/bookings-settings-prefs'

const BOOKINGS_NAV_WIDTH_KEY = 'mailclient.bookingsShell.navWidth'
const BOOKINGS_SHELL_CALENDAR_HEIGHT_PX = 800
const OUTLOOK_BOOKINGS_URL = 'https://outlook.office.com/bookings/calendar'

async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function BookingsShell(): JSX.Element {
  const { t } = useTranslation()
  const appLocale = useLocaleStore((s) => s.locale)
  const dateFnsLoc = appLocale === 'en' ? enUSFns : deFns
  const accounts = useAccountsStore((s) => s.accounts)

  const microsoftAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft'),
    [accounts]
  )

  const [accountId, setAccountId] = useState('')
  const [businesses, setBusinesses] = useState<BookingsBusinessRow[]>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)
  const [services, setServices] = useState<BookingsServiceRow[]>([])
  const [staffMembers, setStaffMembers] = useState<BookingsStaffMemberRow[]>([])
  const [appointments, setAppointments] = useState<BookingsAppointmentRow[]>([])
  const [loadingBusinesses, setLoadingBusinesses] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailWarning, setDetailWarning] = useState<string | null>(null)
  const [businessDetail, setBusinessDetail] = useState<BookingsBusinessDetail | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(() => readBookingsPreviewOpen())
  const [previewPlacement, setPreviewPlacement] = useState<BookingsPreviewPlacement>(() =>
    readBookingsPreviewPlacement()
  )

  const [navWidth, setNavWidth] = useResizableWidth({
    storageKey: BOOKINGS_NAV_WIDTH_KEY,
    defaultWidth: 220,
    minWidth: 160,
    maxWidth: 360
  })

  const [previewWidth, setPreviewWidth] = useResizableWidth({
    storageKey: 'mailclient.bookingsShell.previewWidth',
    defaultWidth: readBookingsPreviewWidth(),
    minWidth: 280,
    maxWidth: 560
  })

  const selectedAccount = useMemo(
    () => microsoftAccounts.find((a) => a.id === accountId) ?? microsoftAccounts[0] ?? null,
    [microsoftAccounts, accountId]
  )

  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId]
  )

  const selectedAppointment = useMemo(
    () => appointments.find((a) => a.id === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId]
  )

  const handleSelectAppointment = useCallback((row: BookingsAppointmentRow): void => {
    setSelectedAppointmentId(row.id)
    setPreviewOpen(true)
    persistBookingsPreviewOpen(true)
  }, [])

  const handlePreviewOpenChange = useCallback((open: boolean): void => {
    setPreviewOpen(open)
    persistBookingsPreviewOpen(open)
  }, [])

  const handlePreviewPlacementChange = useCallback((placement: BookingsPreviewPlacement): void => {
    setPreviewPlacement(placement)
    persistBookingsPreviewPlacement(placement)
  }, [])

  const handlePreviewDockWidthDrag = useCallback(
    (delta: number): void => {
      setPreviewWidth((w) => {
        const next = Math.min(560, Math.max(280, w - delta))
        persistBookingsPreviewWidth(next)
        return next
      })
    },
    [setPreviewWidth]
  )

  useEffect(() => {
    if (microsoftAccounts.length === 0) {
      setAccountId('')
      return
    }
    if (!accountId || !microsoftAccounts.some((a) => a.id === accountId)) {
      setAccountId(microsoftAccounts[0]!.id)
    }
  }, [microsoftAccounts, accountId])

  const loadBusinesses = useCallback(async (): Promise<void> => {
    if (!selectedAccount) return
    setLoadingBusinesses(true)
    setError(null)
    try {
      const rows = await window.mailClient.bookings.listBusinesses({
        accountId: selectedAccount.id
      })
      setBusinesses(rows)
      setSelectedBusinessId((prev) =>
        prev && rows.some((b) => b.id === prev) ? prev : rows[0]?.id ?? null
      )
    } catch (e) {
      setBusinesses([])
      setSelectedBusinessId(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingBusinesses(false)
    }
  }, [selectedAccount])

  const [appointmentDays, setAppointmentDays] = useState(() => readBookingsAppointmentDays())

  useEffect(() => {
    const sync = (): void => setAppointmentDays(readBookingsAppointmentDays())
    window.addEventListener(BOOKINGS_APPOINTMENT_DAYS_CHANGED_EVENT, sync)
    return (): void => window.removeEventListener(BOOKINGS_APPOINTMENT_DAYS_CHANGED_EVENT, sync)
  }, [])

  const loadBusinessDetail = useCallback(async (): Promise<void> => {
    if (!selectedAccount || !selectedBusinessId) {
      setServices([])
      setStaffMembers([])
      setAppointments([])
      setBusinessDetail(null)
      setDetailWarning(null)
      return
    }
    setLoadingDetail(true)
    setDetailWarning(null)
    setBusinessDetail(null)
    const start = new Date()
    const end = addDays(start, appointmentDays)
    const range = { startIso: start.toISOString(), endIso: end.toISOString() }
    const input = { accountId: selectedAccount.id, businessId: selectedBusinessId }
    const [detailResult, svcResult, staffResult, apptResult] = await Promise.allSettled([
      window.mailClient.bookings.getBusiness(input),
      window.mailClient.bookings.listServices(input),
      window.mailClient.bookings.listStaffMembers(input),
      window.mailClient.bookings.listAppointments({ ...input, ...range })
    ])
    if (detailResult.status === 'fulfilled') {
      setBusinessDetail(detailResult.value)
    }
    if (svcResult.status === 'fulfilled') {
      setServices(svcResult.value)
    } else {
      setServices([])
      const msg =
        svcResult.reason instanceof Error ? svcResult.reason.message : String(svcResult.reason)
      setDetailWarning(msg)
    }
    if (staffResult.status === 'fulfilled') {
      setStaffMembers(staffResult.value)
    } else {
      setStaffMembers([])
    }
    if (apptResult.status === 'fulfilled') {
      setAppointments(apptResult.value)
    } else {
      setAppointments([])
      const msg =
        apptResult.reason instanceof Error ? apptResult.reason.message : String(apptResult.reason)
      setDetailWarning((prev) => prev ?? msg)
    }
    if (
      svcResult.status === 'fulfilled' &&
      apptResult.status === 'fulfilled' &&
      svcResult.value.length === 0 &&
      apptResult.value.length === 0
    ) {
      setDetailWarning(t('bookings.businessEmptyOrNoAccess'))
    }
    setLoadingDetail(false)
  }, [appointmentDays, selectedAccount, selectedBusinessId, t])

  useEffect(() => {
    void loadBusinesses()
  }, [loadBusinesses])

  useEffect(() => {
    void loadBusinessDetail()
  }, [loadBusinessDetail])

  useEffect(() => {
    setSelectedAppointmentId(null)
  }, [selectedBusinessId, selectedAccount?.id])

  useEffect(() => {
    if (!selectedAppointmentId) return
    if (!appointments.some((a) => a.id === selectedAppointmentId)) {
      setSelectedAppointmentId(null)
    }
  }, [appointments, selectedAppointmentId])

  const refreshAll = useCallback((): void => {
    void loadBusinesses()
    void loadBusinessDetail()
  }, [loadBusinesses, loadBusinessDetail])

  const publicBookingUrl = useMemo(() => {
    if (businessDetail?.resolvedPublicUrl?.trim()) {
      return businessDetail.resolvedPublicUrl.trim()
    }
    const fromList = selectedBusiness
      ? resolveBookingsPublicUrl({
          publicUrl: selectedBusiness.publicUrl,
          businessId: selectedBusiness.id,
          serviceWebUrls: services.map((s) => s.bookingWebUrl)
        })
      : { url: null, source: null }
    return fromList.url
  }, [businessDetail, selectedBusiness, services])

  const publicUrlSourceKey = useMemo(() => {
    const src =
      businessDetail?.resolvedPublicUrlSource ??
      (selectedBusiness
        ? resolveBookingsPublicUrl({
            publicUrl: selectedBusiness.publicUrl,
            businessId: selectedBusiness.id,
            serviceWebUrls: services.map((s) => s.bookingWebUrl)
          }).source
        : null)
    if (src === 'graph') return 'bookings.publicUrlSourceGraph'
    if (src === 'service') return 'bookings.publicUrlSourceService'
    if (src === 'inferred') return 'bookings.publicUrlSourceInferred'
    return null
  }, [businessDetail, selectedBusiness, services])

  const isPublished = businessDetail?.isPublished ?? selectedBusiness?.isPublished ?? null

  const handleCopyPublicUrl = useCallback((): void => {
    if (!publicBookingUrl) return
    void (async (): Promise<void> => {
      const ok = await copyText(publicBookingUrl)
      if (ok) {
        setCopiedUrl(true)
        window.setTimeout(() => setCopiedUrl(false), 2000)
      }
    })()
  }, [publicBookingUrl])

  if (microsoftAccounts.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="max-w-sm text-sm text-muted-foreground">{t('bookings.microsoftOnly')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={moduleColumnHeaderShellBarClass}>
        <h1 className={moduleColumnHeaderTitleClass}>
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {t('bookings.shellTitle')}
        </h1>
        <div className={moduleColumnHeaderActionsClass}>
          <CalendarPreviewPaneToolbarButton
            open={previewOpen}
            onOpenChange={handlePreviewOpenChange}
          />
          <ModuleColumnHeaderIconButton
            title={t('bookings.refresh')}
            aria-label={t('bookings.refresh')}
            onClick={refreshAll}
            disabled={loadingBusinesses || loadingDetail}
          >
            {loadingBusinesses || loadingDetail ? (
              <Loader2 className={cn(moduleColumnHeaderIconGlyphClass, 'animate-spin')} />
            ) : (
              <RefreshCw className={moduleColumnHeaderIconGlyphClass} />
            )}
          </ModuleColumnHeaderIconButton>
        </div>
      </div>

      <p className="shrink-0 border-b border-border px-4 py-2 text-xs leading-relaxed text-muted-foreground">
        {t('bookings.shellIntro')}
      </p>

      {error ? (
        <p className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={moduleNavColumnClass}
          style={{ width: navWidth, flexShrink: 0 }}
        >
          <div className="border-b border-border px-2 py-2">
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
              {t('bookings.accountLabel')}
            </label>
            <select
              value={selectedAccount?.id ?? ''}
              onChange={(e): void => setAccountId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
            >
              {microsoftAccounts.map((a: ConnectedAccount) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className={moduleNavColumnScrollClass}>
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('bookings.businessesHeading')}
            </p>
            {loadingBusinesses && businesses.length === 0 ? (
              <p className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('bookings.loading')}
              </p>
            ) : businesses.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">{t('bookings.noBusinesses')}</p>
            ) : (
              <ul className="space-y-0.5 px-1 pb-2">
                {businesses.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={(): void => setSelectedBusinessId(b.id)}
                      className={cn(
                        'w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                        selectedBusinessId === b.id
                          ? 'bg-primary/15 font-medium text-primary'
                          : 'text-foreground hover:bg-secondary/60'
                      )}
                    >
                      {b.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <VerticalSplitter
          ariaLabel={t('bookings.splitterNavAria')}
          onDrag={(delta): void => setNavWidth((w) => w + delta)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <main className="min-w-0 flex-1 overflow-y-auto p-4">
          {!selectedBusiness ? (
            <p className="text-sm text-muted-foreground">{t('bookings.selectBusiness')}</p>
          ) : (
            <div className="mx-auto max-w-6xl space-y-6">
              {detailWarning ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                  {detailWarning}
                </p>
              ) : null}

              <header className="space-y-2">
                <h2 className="text-lg font-semibold">{selectedBusiness.displayName}</h2>
                {selectedBusiness.email ? (
                  <p className="text-xs text-muted-foreground">{selectedBusiness.email}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {publicBookingUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyPublicUrl}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary/80"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {copiedUrl ? t('calendar.bookWithMe.copied') : t('bookings.copyPublicLink')}
                      </button>
                      <button
                        type="button"
                        onClick={(): void => {
                          void openExternalUrl(publicBookingUrl).catch(() => undefined)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        {t('bookings.openPublicPage')}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={(): void => {
                      void openExternalUrl(OUTLOOK_BOOKINGS_URL).catch(() => undefined)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {t('bookings.openInOutlook')}
                  </button>
                </div>
                {publicBookingUrl ? (
                  <p className="break-all rounded border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    {publicBookingUrl}
                  </p>
                ) : null}
                {publicUrlSourceKey ? (
                  <p className="text-[10px] text-muted-foreground">{t(publicUrlSourceKey)}</p>
                ) : null}
                {isPublished === false ? (
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    {t('bookings.notPublishedHint')}
                  </p>
                ) : null}
                {!publicBookingUrl ? (
                  <p className="text-[10px] text-muted-foreground">{t('bookings.noPublicUrlHint')}</p>
                ) : null}
              </header>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
                <div className="flex min-w-0 flex-col gap-6">
                  <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('bookings.servicesHeading', { count: services.length })}
                </h3>
                {loadingDetail && services.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('bookings.loading')}</p>
                ) : services.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('bookings.noServices')}</p>
                ) : (
                  <ul className="space-y-1">
                    {services.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs"
                      >
                        <span className="font-medium">{s.displayName}</span>
                        {s.defaultDurationMinutes != null ? (
                          <span className="ml-2 text-muted-foreground">
                            {t('bookings.durationMinutes', { count: s.defaultDurationMinutes })}
                          </span>
                        ) : null}
                        {s.isHiddenFromCustomers ? (
                          <span className="ml-2 text-amber-600 dark:text-amber-500">
                            ({t('bookings.hiddenService')})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  {t('bookings.appointmentsHeading', { count: appointments.length })}
                </h3>
                <p className="mb-2 text-[10px] text-muted-foreground">
                  {t('bookings.appointmentsRangeHint', { count: appointmentDays })}
                </p>
                {loadingDetail && appointments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('bookings.loading')}</p>
                ) : appointments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('bookings.noAppointments')}</p>
                ) : (
                  <ul className="space-y-1">
                    {appointments.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={(): void => handleSelectAppointment(a)}
                          className={cn(
                            'w-full rounded-md border px-3 py-2 text-left text-xs transition-colors',
                            selectedAppointmentId === a.id
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                              : 'border-border bg-background/60 hover:bg-secondary/50'
                          )}
                        >
                        <div className="font-medium">
                          {format(parseISO(a.startIso), 'EEE d. MMM, HH:mm', { locale: dateFnsLoc })}
                          {' – '}
                          {format(parseISO(a.endIso), 'HH:mm', { locale: dateFnsLoc })}
                        </div>
                        {a.serviceName ? (
                          <div className="mt-0.5 text-muted-foreground">{a.serviceName}</div>
                        ) : null}
                        {a.customerName || a.customerEmail ? (
                          <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3 w-3 shrink-0" aria-hidden />
                            <span>
                              {[a.customerName, a.customerEmail].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {t('bookings.calendarSyncHint')}
                  </p>
                </div>

                <section className="min-w-0 lg:sticky lg:top-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    {t('bookings.calendarHeading', { count: appointmentDays })}
                  </h3>
                  <BookingsWeekCalendar
                    appointments={appointments}
                    selectedAppointmentId={selectedAppointmentId}
                    onSelectAppointment={handleSelectAppointment}
                    bodyHeightPx={BOOKINGS_SHELL_CALENDAR_HEIGHT_PX}
                  />
                </section>
              </div>
            </div>
          )}
          </main>

          <BookingsAppointmentPreviewPane
            open={previewOpen}
            placement={previewPlacement}
            onPlacementChange={handlePreviewPlacementChange}
            onClose={(): void => handlePreviewOpenChange(false)}
            appointment={selectedAppointment}
            business={selectedBusiness}
            services={services}
            staffMembers={staffMembers}
            dockWidthPx={previewWidth}
            onDockWidthDrag={handlePreviewDockWidthDrag}
          />
        </div>
      </div>
    </div>
  )
}
