import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarGraphCalendarRow,
  CalendarIcsImportEventPreview,
  ConnectedAccount
} from '@shared/types'
import { formatCalendarEventWhenLabel } from '@shared/calendar-datetime'
import {
  calendarDestinationKey,
  destinationAccountOptgroupLabel,
  isWritableCalendarTarget,
  parseCalendarDestinationKey
} from '@/app/calendar/calendar-create-destination'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import { prepareCalendarEventBodyHtml } from '@shared/calendar-event-body-html'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { useCalendarIcsImportStore } from '@/stores/calendar-ics-import'
import { useUndoStore } from '@/stores/undo'

export interface CalendarIcsImportDialogProps {
  calendarAccounts: ConnectedAccount[]
}

function formatEventPreview(
  ev: CalendarIcsImportEventPreview,
  timeZone: string,
  localeCode: 'de' | 'en'
): string {
  const start = formatCalendarEventWhenLabel(
    ev.startIso,
    timeZone,
    localeCode,
    ev.isAllDay
  )
  if (ev.isAllDay) return start ?? ev.startIso
  const end = formatCalendarEventWhenLabel(ev.endIso, timeZone, localeCode, false)
  if (start && end) return `${start} – ${end}`
  return start ?? end ?? ev.startIso
}

export function CalendarIcsImportDialog({
  calendarAccounts
}: CalendarIcsImportDialogProps): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const open = useCalendarIcsImportStore((s) => s.open)
  const loading = useCalendarIcsImportStore((s) => s.loading)
  const parsed = useCalendarIcsImportStore((s) => s.parsed)
  const error = useCalendarIcsImportStore((s) => s.error)
  const close = useCalendarIcsImportStore((s) => s.close)

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localeCode = i18n.language.startsWith('de') ? 'de' : 'en'

  const [destinationSelectValue, setDestinationSelectValue] = useState('')
  const [calendarsByAccount, setCalendarsByAccount] = useState<
    { account: ConnectedAccount; calendars: CalendarGraphCalendarRow[] }[]
  >([])
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const events = parsed?.events ?? []

  useEffect(() => {
    if (!open || calendarAccounts.length === 0) {
      setCalendarsByAccount([])
      setDestinationSelectValue('')
      return
    }
    let cancelled = false
    setCalendarsLoading(true)
    void Promise.all(
      calendarAccounts.map((acc) =>
        window.mailClient.calendar
          .listCalendars({ accountId: acc.id })
          .then((rows) => ({
            account: acc,
            calendars: rows.filter(isWritableCalendarTarget)
          }))
          .catch(() => ({ account: acc, calendars: [] as CalendarGraphCalendarRow[] }))
      )
    )
      .then((bundles) => {
        if (cancelled) return
        setCalendarsByAccount(bundles)
        const bundle = bundles[0]
        if (!bundle) {
          setDestinationSelectValue('')
          return
        }
        let calId = ''
        if (bundle.calendars.length > 0) {
          const def =
            bundle.calendars.find((r) => r.isDefaultCalendar && r.calendarKind !== 'm365Group') ??
            bundle.calendars.find((r) => r.isDefaultCalendar) ??
            bundle.calendars.find((r) => r.calendarKind !== 'm365Group') ??
            bundle.calendars[0]
          calId = def?.id ?? ''
        }
        setDestinationSelectValue(calendarDestinationKey(bundle.account.id, calId))
      })
      .finally(() => {
        if (!cancelled) setCalendarsLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [open, calendarAccounts])

  useEffect(() => {
    if (!open || events.length === 0) {
      setSelectedUids(new Set())
      return
    }
    setSelectedUids(
      new Set(events.map((ev, i) => ev.uid ?? `idx-${i}`))
    )
    setImportError(null)
  }, [open, parsed])

  const destination = useMemo(
    () => parseCalendarDestinationKey(destinationSelectValue),
    [destinationSelectValue]
  )

  const toggleEvent = useCallback((key: string): void => {
    setSelectedUids((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleImport = useCallback(async (): Promise<void> => {
    if (!destination || events.length === 0) return
    const toImport = events.filter((ev, i) => selectedUids.has(ev.uid ?? `idx-${i}`))
    if (toImport.length === 0) {
      setImportError(t('calendar.icsImport.selectAtLeastOne'))
      return
    }
    setImporting(true)
    setImportError(null)
    let created = 0
    try {
      for (const ev of toImport) {
        const bodyHtml = ev.bodyHtml?.trim()
          ? prepareCalendarEventBodyHtml(sanitizeComposeHtmlFragment(ev.bodyHtml.trim()))
          : null
        await window.mailClient.calendar.createEvent({
          accountId: destination.accountId,
          graphCalendarId: destination.graphCalendarId.trim() || null,
          subject: ev.summary.trim() || t('calendar.icsImport.untitled'),
          startIso: ev.startIso,
          endIso: ev.endIso,
          isAllDay: ev.isAllDay,
          location: ev.location,
          bodyHtml
        })
        created++
      }
      useUndoStore.getState().pushToast({
        label:
          created === 1
            ? t('calendar.icsImport.successOne')
            : t('calendar.icsImport.successMany', { count: created }),
        variant: 'success'
      })
      close()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (created > 0) {
        setImportError(t('calendar.icsImport.partialError', { count: created, message: msg }))
      } else {
        setImportError(msg)
      }
    } finally {
      setImporting(false)
    }
  }, [close, destination, events, selectedUids, t])

  if (!open) return null

  const noAccounts = calendarAccounts.length === 0
  const busy = loading || importing || calendarsLoading
  const canImport =
    !busy &&
    !noAccounts &&
    destination != null &&
    events.length > 0 &&
    selectedUids.size > 0

  return (
    <ModalRoot open={open} onBackdropClick={busy ? undefined : close} zIndex={320}>
      <ModalPanel
        className="flex max-h-[min(88vh,640px)] w-[min(96vw,480px)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        role="dialog"
        aria-labelledby="ics-import-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="ics-import-title" className="text-base font-semibold text-foreground">
              {t('calendar.icsImport.title')}
            </h2>
            {parsed?.fileName ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{parsed.fileName}</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary/80"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('calendar.icsImport.loading')}
            </div>
          ) : null}

          {!loading && (error || importError) ? (
            <p className="text-sm text-destructive">{error ?? importError}</p>
          ) : null}

          {!loading && noAccounts ? (
            <p className="text-sm text-muted-foreground">{t('calendar.icsImport.noAccounts')}</p>
          ) : null}

          {!loading && !noAccounts && events.length > 0 ? (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">
                  {t('calendar.icsImport.destination')}
                </span>
                <select
                  value={destinationSelectValue}
                  disabled={busy}
                  onChange={(e): void => setDestinationSelectValue(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {calendarsByAccount.map(({ account, calendars }) => (
                    <optgroup key={account.id} label={destinationAccountOptgroupLabel(account)}>
                      {calendars.length === 0 ? (
                        <option value={calendarDestinationKey(account.id, '')}>
                          {t('calendar.eventDialog.defaultCalendar')}
                        </option>
                      ) : (
                        calendars.map((cal) => (
                          <option
                            key={cal.id}
                            value={calendarDestinationKey(account.id, cal.id)}
                          >
                            {cal.name}
                          </option>
                        ))
                      )}
                    </optgroup>
                  ))}
                </select>
              </label>

              <section className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  {events.length === 1
                    ? t('calendar.icsImport.oneEvent')
                    : t('calendar.icsImport.multipleEvents', { count: events.length })}
                </p>
                <ul className="space-y-1.5">
                  {events.map((ev, i) => {
                    const key = ev.uid ?? `idx-${i}`
                    const checked = selectedUids.has(key)
                    return (
                      <li key={key}>
                        <label
                          className={cn(
                            'flex cursor-pointer gap-2 rounded-md border border-border px-2.5 py-2 transition-colors',
                            checked ? 'bg-secondary/50' : 'hover:bg-secondary/30'
                          )}
                        >
                          {events.length > 1 ? (
                            <input
                              type="checkbox"
                              className="mt-1 shrink-0"
                              checked={checked}
                              disabled={busy}
                              onChange={(): void => toggleEvent(key)}
                            />
                          ) : (
                            <Calendar
                              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {ev.summary}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatEventPreview(ev, timeZone, localeCode)}
                            </span>
                            {ev.location ? (
                              <span className="block truncate text-xs text-muted-foreground/90">
                                {ev.location}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {parsed?.warnings && parsed.warnings.length > 0 ? (
                <ul className="text-xs text-muted-foreground">
                  {parsed.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary/80"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!canImport}
            onClick={(): void => void handleImport()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90',
              !canImport && 'cursor-not-allowed opacity-50'
            )}
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('calendar.icsImport.import')}
          </button>
        </footer>
      </ModalPanel>
    </ModalRoot>
  )
}
