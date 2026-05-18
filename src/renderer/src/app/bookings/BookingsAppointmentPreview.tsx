import { useMemo } from 'react'
import { differenceInMinutes, format, parseISO } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import {
  Building2,
  CalendarClock,
  Clock,
  ExternalLink,
  Mail,
  User,
  Users
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  BookingsAppointmentRow,
  BookingsBusinessRow,
  BookingsServiceRow,
  BookingsStaffMemberRow
} from '@shared/types'
import { openExternalUrl } from '@/lib/open-external'

const OUTLOOK_BOOKINGS_URL = 'https://outlook.office.com/bookings/calendar'

function PreviewRow({
  icon: Icon,
  label,
  children
}: {
  icon: typeof User
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex gap-2.5 border-b border-border/60 py-2.5 last:border-b-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  )
}

export function BookingsAppointmentPreview({
  appointment,
  business,
  services,
  staffMembers
}: {
  appointment: BookingsAppointmentRow
  business: BookingsBusinessRow | null
  services: BookingsServiceRow[]
  staffMembers: BookingsStaffMemberRow[]
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const dateFnsLoc = i18n.language.startsWith('de') ? deFns : enUSFns

  const start = parseISO(appointment.startIso)
  const end = parseISO(appointment.endIso)
  const durationMin = useMemo(() => {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    return Math.max(0, differenceInMinutes(end, start))
  }, [start, end])

  const staffById = useMemo(() => new Map(staffMembers.map((s) => [s.id, s])), [staffMembers])

  const resolvedStaff = useMemo(() => {
    return appointment.staffMemberIds.map((id) => {
      const row = staffById.get(id)
      if (row) return { id, row }
      return { id, row: null }
    })
  }, [appointment.staffMemberIds, staffById])

  const matchedService = useMemo(
    () =>
      appointment.serviceName
        ? services.find(
            (s) => s.displayName.trim().toLowerCase() === appointment.serviceName!.trim().toLowerCase()
          ) ?? null
        : null,
    [appointment.serviceName, services]
  )

  const title =
    appointment.serviceName?.trim() ||
    appointment.customerName?.trim() ||
    t('bookings.preview.untitled')

  const whenLabel = useMemo(() => {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return `${appointment.startIso} – ${appointment.endIso}`
    }
    const sameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')
    if (sameDay) {
      return `${format(start, 'EEEE, d. MMMM yyyy', { locale: dateFnsLoc })}\n${format(start, 'HH:mm', { locale: dateFnsLoc })} – ${format(end, 'HH:mm', { locale: dateFnsLoc })}`
    }
    return `${format(start, 'Pp', { locale: dateFnsLoc })} – ${format(end, 'Pp', { locale: dateFnsLoc })}`
  }, [appointment.endIso, appointment.startIso, dateFnsLoc, end, start])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold leading-snug text-foreground">{title}</h2>
        {appointment.isCancelled ? (
          <span className="mt-1.5 inline-flex rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
            {t('bookings.preview.cancelled')}
          </span>
        ) : null}
        {business ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {business.displayName}
          </p>
        ) : null}
      </div>

      <div className="px-4 py-1">
        <PreviewRow icon={CalendarClock} label={t('bookings.preview.when')}>
          <span className="whitespace-pre-line">{whenLabel}</span>
        </PreviewRow>

        {durationMin != null ? (
          <PreviewRow icon={Clock} label={t('bookings.preview.duration')}>
            {t('bookings.durationMinutes', { count: durationMin })}
          </PreviewRow>
        ) : null}

        {appointment.serviceName ? (
          <PreviewRow icon={CalendarClock} label={t('bookings.preview.service')}>
            <span>{appointment.serviceName}</span>
            {matchedService?.defaultDurationMinutes != null &&
            matchedService.defaultDurationMinutes !== durationMin ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('bookings.preview.serviceDefaultDuration', {
                  count: matchedService.defaultDurationMinutes
                })}
              </p>
            ) : null}
            {matchedService?.defaultPrice != null ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('bookings.preview.servicePrice', { price: matchedService.defaultPrice })}
              </p>
            ) : null}
          </PreviewRow>
        ) : null}

        {appointment.customerName || appointment.customerEmail ? (
          <PreviewRow icon={User} label={t('bookings.preview.customer')}>
            {appointment.customerName ? <p>{appointment.customerName}</p> : null}
            {appointment.customerEmail ? (
              <a
                href={`mailto:${appointment.customerEmail}`}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Mail className="h-3 w-3 shrink-0" aria-hidden />
                {appointment.customerEmail}
              </a>
            ) : null}
          </PreviewRow>
        ) : null}

        {resolvedStaff.length > 0 ? (
          <PreviewRow icon={Users} label={t('bookings.preview.staff')}>
            <ul className="space-y-2">
              {resolvedStaff.map(({ id, row }) => (
                <li key={id}>
                  {row ? (
                    <>
                      <p className="font-medium">{row.displayName}</p>
                      {row.emailAddress ? (
                        <a
                          href={`mailto:${row.emailAddress}`}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Mail className="h-3 w-3 shrink-0" aria-hidden />
                          {row.emailAddress}
                        </a>
                      ) : null}
                      {row.role ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t('bookings.preview.staffRole', { role: row.role })}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t('bookings.preview.staffUnknown')}
                      <span className="mt-0.5 block font-mono text-[10px] opacity-80" title={id}>
                        {id}
                      </span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </PreviewRow>
        ) : null}

        <PreviewRow icon={Building2} label={t('bookings.preview.appointmentId')}>
          <span
            className="break-all font-mono text-[10px] text-muted-foreground"
            title={appointment.id}
          >
            {appointment.id}
          </span>
        </PreviewRow>
      </div>

      <div className="mt-auto shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={(): void => {
            void openExternalUrl(OUTLOOK_BOOKINGS_URL).catch(() => undefined)
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('bookings.openInOutlook')}
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          {t('bookings.preview.outlookHint')}
        </p>
      </div>
    </div>
  )
}
