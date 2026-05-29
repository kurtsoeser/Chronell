import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addDays, addHours, format, parseISO } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { createPortal } from 'react-dom'
import { Clock, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount, MeetingInvitationView } from '@shared/types'
import { cn } from '@/lib/utils'
import { showAppAlert } from '@/stores/app-dialog'
import {
  MeetingInvitationDayPreview,
  useMeetingInvitationDayEvents
} from '@/app/layout/meeting-invitation/MeetingInvitationDayPreview'
import { eventDatetimeLocalToUtcIso, resolveDefaultEventTimeZone } from '@/lib/calendar-event-timezone'
import { useAccountsStore } from '@/stores/accounts'

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function meetingDurationMs(invitation: MeetingInvitationView): number {
  const s = invitation.startIso ? Date.parse(invitation.startIso) : Number.NaN
  const e = invitation.endIso ? Date.parse(invitation.endIso) : Number.NaN
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 60 * 60 * 1000
  return e - s
}

function shiftProposal(
  invitation: MeetingInvitationView,
  shift: 'nextDay' | 'plusOneHour'
): { start: string; end: string } {
  const duration = meetingDurationMs(invitation)
  if (!invitation.startIso) return { start: '', end: '' }
  const base = new Date(invitation.startIso)
  const start =
    shift === 'nextDay' ? addDays(base, 1) : addHours(base, 1)
  const end = new Date(start.getTime() + duration)
  return { start: toDatetimeLocalValue(start.toISOString()), end: toDatetimeLocalValue(end.toISOString()) }
}

export function MeetingProposeTimeDialog({
  open,
  invitation,
  account,
  messageId,
  onClose,
  onProposed
}: {
  open: boolean
  invitation: MeetingInvitationView
  account: ConnectedAccount
  messageId: number
  onClose: () => void
  onProposed: (patch: {
    selfPartStat: MeetingInvitationView['selfPartStat']
    selfProposedStartIso: string
    selfProposedEndIso: string
  }) => void
}): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const dfLocale: Locale = i18n.language.startsWith('de') ? deFns : enUSFns
  const calendarTz = useAccountsStore((s) =>
    resolveDefaultEventTimeZone(s.config?.calendarTimeZone)
  )

  const initial = useMemo(() => shiftProposal(invitation, 'nextDay'), [invitation])
  const [startLocal, setStartLocal] = useState(initial.start)
  const [endLocal, setEndLocal] = useState(initial.end)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = shiftProposal(invitation, 'nextDay')
    setStartLocal(next.start)
    setEndLocal(next.end)
    setComment('')
  }, [open, invitation])

  const previewInvitation = useMemo((): MeetingInvitationView => {
    try {
      const startIso = eventDatetimeLocalToUtcIso(
        startLocal,
        calendarTz,
        t('mail.meetingInvitation.proposeInvalidStart')
      )
      const endIso = eventDatetimeLocalToUtcIso(
        endLocal,
        calendarTz,
        t('mail.meetingInvitation.proposeInvalidEnd')
      )
      return { ...invitation, startIso, endIso, summary: t('mail.meetingInvitation.proposedPreviewTitle') }
    } catch {
      return invitation
    }
  }, [calendarTz, endLocal, invitation, startLocal, t])

  const { events: dayEvents, loading: dayLoading } = useMeetingInvitationDayEvents(
    open ? previewInvitation : null
  )

  const applyPreset = useCallback(
    (shift: 'nextDay' | 'plusOneHour'): void => {
      const next = shiftProposal(invitation, shift)
      setStartLocal(next.start)
      setEndLocal(next.end)
    },
    [invitation]
  )

  const submit = useCallback(async (): Promise<void> => {
    let startIso: string
    let endIso: string
    try {
      startIso = eventDatetimeLocalToUtcIso(
        startLocal,
        calendarTz,
        t('mail.meetingInvitation.proposeInvalidStart')
      )
      endIso = eventDatetimeLocalToUtcIso(
        endLocal,
        calendarTz,
        t('mail.meetingInvitation.proposeInvalidEnd')
      )
    } catch (e) {
      await showAppAlert(e instanceof Error ? e.message : String(e), {
        title: t('mail.meetingInvitation.proposeFailedTitle')
      })
      return
    }
    if (Date.parse(endIso) <= Date.parse(startIso)) {
      await showAppAlert(t('mail.readingPane.toastEndAfterStart'), {
        title: t('mail.meetingInvitation.proposeFailedTitle')
      })
      return
    }

    setBusy(true)
    try {
      const res = await window.mailClient.calendar.respondToMeetingInvitation({
        accountId: account.id,
        messageId,
        response: 'propose',
        comment: comment.trim() || null,
        proposedStartIso: startIso,
        proposedEndIso: endIso
      })
      if (!res.ok) {
        await showAppAlert(res.error ?? t('mail.meetingInvitation.proposeFailed'), {
          title: t('mail.meetingInvitation.proposeFailedTitle')
        })
        return
      }
      onProposed({
        selfPartStat: res.selfPartStat ?? 'tentative',
        selfProposedStartIso: res.selfProposedStartIso ?? startIso,
        selfProposedEndIso: res.selfProposedEndIso ?? endIso
      })
      void window.mailClient.calendar.syncAccount(account.id).catch(() => undefined)
      onClose()
    } finally {
      setBusy(false)
    }
  }, [account.id, calendarTz, comment, endLocal, messageId, onClose, onProposed, startLocal, t])

  if (!open) return null

  const originalStart = new Date(invitation.startIso ?? Date.now())
  const summaryDate = format(originalStart, 'PPP', { locale: dfLocale })

  return createPortal(
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e): void => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="chronell-acrylic-popover flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-propose-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2 id="meeting-propose-title" className="text-base font-semibold text-foreground">
              {t('mail.meetingInvitation.proposeTitle')}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {t('mail.meetingInvitation.proposeSubtitle', {
                title: invitation.summary,
                date: summaryDate
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <PresetButton onClick={(): void => applyPreset('nextDay')}>
              {t('mail.meetingInvitation.proposeNextDay')}
            </PresetButton>
            <PresetButton onClick={(): void => applyPreset('plusOneHour')}>
              {t('mail.meetingInvitation.proposePlusOneHour')}
            </PresetButton>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[12px]">
              <span className="font-medium text-muted-foreground">{t('mail.readingPane.start')}</span>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e): void => setStartLocal(e.target.value)}
                className="rounded-md border border-border bg-background px-2.5 py-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px]">
              <span className="font-medium text-muted-foreground">{t('mail.readingPane.end')}</span>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e): void => setEndLocal(e.target.value)}
                className="rounded-md border border-border bg-background px-2.5 py-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-[12px]">
            <span className="font-medium text-muted-foreground">
              {t('mail.meetingInvitation.commentTitle')}
            </span>
            <textarea
              value={comment}
              onChange={(e): void => setComment(e.target.value)}
              rows={3}
              placeholder={t('mail.meetingInvitation.proposeCommentPlaceholder')}
              className="resize-y rounded-md border border-border bg-background px-2.5 py-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {t('mail.meetingInvitation.proposePreviewLabel')}
            </div>
            <MeetingInvitationDayPreview
              invitation={previewInvitation}
              dayEvents={dayEvents}
              loading={dayLoading}
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-[12px] font-medium text-foreground hover:bg-secondary disabled:opacity-50"
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
              'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
            )}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('mail.meetingInvitation.proposeSend')}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

function PresetButton({
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
      className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] font-medium text-foreground hover:bg-secondary/70"
    >
      {children}
    </button>
  )
}

function formatProposedRange(
  startIso: string,
  endIso: string,
  locale: Locale,
  language: string
): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const datePart = format(start, 'PPP', { locale })
  const timeFmt = language.startsWith('de') ? 'HH:mm' : 'p'
  return `${datePart}, ${format(start, timeFmt, { locale })} – ${format(end, timeFmt, { locale })}`
}

export function formatMeetingProposedRangeLabel(
  invitation: MeetingInvitationView,
  locale: Locale,
  language: string
): string | null {
  if (!invitation.selfProposedStartIso || !invitation.selfProposedEndIso) return null
  return formatProposedRange(invitation.selfProposedStartIso, invitation.selfProposedEndIso, locale, language)
}
