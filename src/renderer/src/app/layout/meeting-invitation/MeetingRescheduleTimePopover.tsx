import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { addDays, addHours, setHours, setMilliseconds, setMinutes, setSeconds } from 'date-fns'
import { Clock, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount, MeetingInvitationView } from '@shared/types'
import { cn } from '@/lib/utils'
import { showAppAlert } from '@/stores/app-dialog'
import { useUndoStore } from '@/stores/undo'
import { logIpcError } from '@/lib/ipc-error-log'
import { confirmMeetingRescheduleNotify } from '@/app/calendar/calendar-meeting-schedule-change'
import {
  MeetingInvitationDayPreview,
  useMeetingInvitationDayEvents
} from '@/app/layout/meeting-invitation/MeetingInvitationDayPreview'
import { eventDatetimeLocalToUtcIso, resolveDefaultEventTimeZone } from '@/lib/calendar-event-timezone'
import { useAccountsStore } from '@/stores/accounts'

const POPOVER_WIDTH_PX = 360
const POPOVER_MARGIN_PX = 8

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function parseDatetimeLocal(value: string): Date | null {
  if (!value) return null
  const d = new Date(`${value}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function meetingDurationMs(invitation: MeetingInvitationView): number {
  const s = invitation.startIso ? Date.parse(invitation.startIso) : Number.NaN
  const e = invitation.endIso ? Date.parse(invitation.endIso) : Number.NaN
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 60 * 60 * 1000
  return e - s
}

function computePopoverStyle(anchor: DOMRect, width: number, height: number): CSSProperties {
  const maxLeft = Math.max(POPOVER_MARGIN_PX, window.innerWidth - POPOVER_MARGIN_PX - width)
  const left = Math.max(POPOVER_MARGIN_PX, Math.min(anchor.left, maxLeft))
  let top = anchor.bottom + 6
  if (top + height > window.innerHeight - POPOVER_MARGIN_PX) {
    top = Math.max(POPOVER_MARGIN_PX, anchor.top - height - 6)
  }
  return { position: 'fixed', left, top, width, zIndex: 300 }
}

export function MeetingRescheduleTimePopover({
  anchorEl,
  invitation,
  account,
  messageId,
  onClose,
  onRescheduled
}: {
  anchorEl: HTMLElement
  invitation: MeetingInvitationView
  account: ConnectedAccount
  messageId: number
  onClose: () => void
  onRescheduled: (patch: { startIso: string; endIso: string }) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const calendarTz = useAccountsStore((s) =>
    resolveDefaultEventTimeZone(s.config?.calendarTimeZone)
  )
  const rootRef = useRef<HTMLDivElement>(null)

  const [startLocal, setStartLocal] = useState(() =>
    invitation.startIso ? toDatetimeLocalValue(invitation.startIso) : ''
  )
  const [endLocal, setEndLocal] = useState(() =>
    invitation.endIso ? toDatetimeLocalValue(invitation.endIso) : ''
  )
  const [busy, setBusy] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    left: -9999,
    top: -9999,
    width: POPOVER_WIDTH_PX,
    zIndex: 300
  })

  useLayoutEffect(() => {
    const rect = anchorEl.getBoundingClientRect()
    const height = rootRef.current?.getBoundingClientRect().height ?? 380
    setStyle(computePopoverStyle(rect, POPOVER_WIDTH_PX, height))
  }, [anchorEl, startLocal, endLocal])

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      const target = e.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      if (anchorEl.contains(target)) return
      onClose()
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return (): void => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [anchorEl, onClose])

  const applyStartKeepingDuration = useCallback(
    (newStart: Date): void => {
      const s = parseDatetimeLocal(startLocal)
      const e = parseDatetimeLocal(endLocal)
      const duration =
        s && e && e.getTime() > s.getTime() ? e.getTime() - s.getTime() : meetingDurationMs(invitation)
      const newEnd = new Date(newStart.getTime() + duration)
      setStartLocal(toDatetimeLocalValue(newStart.toISOString()))
      setEndLocal(toDatetimeLocalValue(newEnd.toISOString()))
    },
    [endLocal, invitation, startLocal]
  )

  const applyPreset = useCallback(
    (preset: 'plusOneHour' | 'thisAfternoon' | 'tomorrowSame'): void => {
      const base = parseDatetimeLocal(startLocal) ?? new Date()
      if (preset === 'plusOneHour') {
        applyStartKeepingDuration(addHours(base, 1))
      } else if (preset === 'tomorrowSame') {
        applyStartKeepingDuration(addDays(base, 1))
      } else {
        const now = new Date()
        let afternoon = setMilliseconds(setSeconds(setMinutes(setHours(now, 14), 0), 0), 0)
        if (afternoon.getTime() <= Date.now()) afternoon = addDays(afternoon, 1)
        applyStartKeepingDuration(afternoon)
      }
    },
    [applyStartKeepingDuration, startLocal]
  )

  const handleStartChange = useCallback(
    (value: string): void => {
      const prevStart = parseDatetimeLocal(startLocal)
      const prevEnd = parseDatetimeLocal(endLocal)
      const nextStart = parseDatetimeLocal(value)
      setStartLocal(value)
      if (nextStart) {
        const duration =
          prevStart && prevEnd && prevEnd.getTime() > prevStart.getTime()
            ? prevEnd.getTime() - prevStart.getTime()
            : meetingDurationMs(invitation)
        setEndLocal(toDatetimeLocalValue(new Date(nextStart.getTime() + duration).toISOString()))
      }
    },
    [endLocal, invitation, startLocal]
  )

  const previewInvitation = useMemo((): MeetingInvitationView => {
    try {
      const startIso = eventDatetimeLocalToUtcIso(
        startLocal,
        calendarTz,
        t('mail.meetingInvitation.changeTimeInvalidStart')
      )
      const endIso = eventDatetimeLocalToUtcIso(
        endLocal,
        calendarTz,
        t('mail.meetingInvitation.changeTimeInvalidEnd')
      )
      return { ...invitation, startIso, endIso, summary: t('mail.meetingInvitation.changeTimePreviewTitle') }
    } catch {
      return invitation
    }
  }, [calendarTz, endLocal, invitation, startLocal, t])

  const { events: dayEvents, loading: dayLoading } = useMeetingInvitationDayEvents(previewInvitation)

  const submit = useCallback(async (): Promise<void> => {
    let startIso: string
    let endIso: string
    try {
      startIso = eventDatetimeLocalToUtcIso(
        startLocal,
        calendarTz,
        t('mail.meetingInvitation.changeTimeInvalidStart')
      )
      endIso = eventDatetimeLocalToUtcIso(
        endLocal,
        calendarTz,
        t('mail.meetingInvitation.changeTimeInvalidEnd')
      )
    } catch (e) {
      await showAppAlert(e instanceof Error ? e.message : String(e), {
        title: t('mail.meetingInvitation.changeTimeFailedTitle')
      })
      return
    }
    if (Date.parse(endIso) <= Date.parse(startIso)) {
      await showAppAlert(t('mail.readingPane.toastEndAfterStart'), {
        title: t('mail.meetingInvitation.changeTimeFailedTitle')
      })
      return
    }

    const proceed = await confirmMeetingRescheduleNotify(t, {
      cancelLabel: t('calendar.scheduleChangeDialog.cancel')
    })
    if (!proceed) return

    setBusy(true)
    try {
      const res = await window.mailClient.calendar.rescheduleMeetingFromMessage({
        accountId: account.id,
        messageId,
        newStartIso: startIso,
        newEndIso: endIso
      })
      if (!res.ok) {
        await showAppAlert(res.error ?? t('mail.meetingInvitation.changeTimeFailed'), {
          title: t('mail.meetingInvitation.changeTimeFailedTitle')
        })
        return
      }
      useUndoStore.getState().pushToast({
        label: t('mail.meetingInvitation.changeTimeSucceeded'),
        variant: 'success'
      })
      onRescheduled({ startIso: res.startIso ?? startIso, endIso: res.endIso ?? endIso })
      void window.mailClient.calendar
        .syncAccount(account.id)
        .catch((err) => logIpcError('calendar.syncAccount', err))
      onClose()
    } finally {
      setBusy(false)
    }
  }, [account.id, calendarTz, endLocal, messageId, onClose, onRescheduled, startLocal, t])

  return createPortal(
    <div
      ref={rootRef}
      style={style}
      role="dialog"
      aria-modal="false"
      aria-labelledby="meeting-reschedule-title"
      className="chronell-acrylic-popover glass-animate-in flex max-h-[min(80vh,560px)] flex-col overflow-hidden rounded-xl border border-border shadow-2xl"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="meeting-reschedule-title" className="text-[13px] font-semibold text-foreground">
          {t('mail.meetingInvitation.changeTimeTitle')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('common.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <PresetChip onClick={(): void => applyPreset('plusOneHour')}>
            {t('mail.meetingInvitation.changeTimePlusOneHour')}
          </PresetChip>
          <PresetChip onClick={(): void => applyPreset('thisAfternoon')}>
            {t('mail.meetingInvitation.changeTimeThisAfternoon')}
          </PresetChip>
          <PresetChip onClick={(): void => applyPreset('tomorrowSame')}>
            {t('mail.meetingInvitation.changeTimeTomorrowSame')}
          </PresetChip>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-medium text-muted-foreground">{t('mail.readingPane.start')}</span>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e): void => handleStartChange(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-medium text-muted-foreground">{t('mail.readingPane.end')}</span>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e): void => setEndLocal(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            {t('mail.meetingInvitation.changeTimePreviewLabel')}
          </div>
          <MeetingInvitationDayPreview
            invitation={previewInvitation}
            dayEvents={dayEvents}
            loading={dayLoading}
          />
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(): void => {
            void submit()
          }}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t('mail.meetingInvitation.changeTimeApply')}
        </button>
      </footer>
    </div>,
    document.body
  )
}

function PresetChip({
  children,
  onClick
}: {
  children: ReactNode
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary/70"
    >
      {children}
    </button>
  )
}
