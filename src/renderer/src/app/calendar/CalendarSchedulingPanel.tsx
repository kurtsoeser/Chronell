import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, Copy, Link2, Loader2, Send, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { ConnectedAccount } from '@shared/types'
import { BOOK_WITH_ME_MANAGE_URL } from '@shared/book-with-me'
import { buildSchedulingInvitationText } from '@shared/scheduling-invitation'
import type { SchedulingSlot } from '@shared/scheduling-types'
import { useLocaleStore } from '@/stores/locale'
import { openExternalUrl } from '@/lib/open-external'
import { requestOpenAccountSettings } from '@/lib/open-account-settings'
import { showAppAlert } from '@/stores/app-dialog'
import { RecipientTokenField } from '@/components/RecipientTokenField'
import { sendSchedulingInvitationMail } from '@/app/calendar/scheduling-send-mail'
import { cn } from '@/lib/utils'
import { clearSchedulingDraft } from '@/app/calendar/scheduling-draft-storage'

async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export interface CalendarSchedulingPanelProps {
  accounts: ConnectedAccount[]
  slots: SchedulingSlot[]
  onSlotsChange: (slots: SchedulingSlot[]) => void
  accountId: string
  onAccountIdChange: (id: string) => void
  durationMinutes: number
  onDurationMinutesChange: (min: number) => void
  meetingTitle: string
  onMeetingTitleChange: (title: string) => void
  timeZone: string
  onClose: () => void
  className?: string
}

export function CalendarSchedulingPanel({
  accounts,
  slots,
  onSlotsChange,
  accountId,
  onAccountIdChange,
  durationMinutes,
  onDurationMinutesChange,
  meetingTitle,
  onMeetingTitleChange,
  timeZone,
  onClose,
  className
}: CalendarSchedulingPanelProps): JSX.Element {
  const { t } = useTranslation()
  const appLocale = useLocaleStore((s) => s.locale)
  const invitationLocale = appLocale === 'en' ? 'en' : 'de'
  const dateFnsLoc = invitationLocale === 'de' ? deFns : enUSFns

  const [copiedInvite, setCopiedInvite] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [mailTo, setMailTo] = useState('')
  const [mailCc, setMailCc] = useState('')
  const [mailShowCc, setMailShowCc] = useState(false)
  const [mailSubject, setMailSubject] = useState('')
  const [mailBody, setMailBody] = useState('')
  const [mailBodyTouched, setMailBodyTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const lastAutoBodyRef = useRef('')

  const microsoftAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft'),
    [accounts]
  )

  const selectedAccount =
    microsoftAccounts.find((a) => a.id === accountId) ?? microsoftAccounts[0] ?? null
  const bookWithMeUrl = selectedAccount?.bookWithMeUrl?.trim() ?? ''

  const invitationText = useMemo(
    () =>
      buildSchedulingInvitationText({
        slots,
        bookWithMeUrl: bookWithMeUrl || null,
        durationMinutes,
        locale: invitationLocale,
        timeZone,
        meetingTitle
      }),
    [slots, bookWithMeUrl, durationMinutes, invitationLocale, timeZone, meetingTitle]
  )

  useEffect(() => {
    if (!mailBodyTouched || mailBody === lastAutoBodyRef.current) {
      setMailBody(invitationText)
      lastAutoBodyRef.current = invitationText
    }
  }, [invitationText, mailBodyTouched, mailBody])

  useEffect(() => {
    setMailSubject((prev) => (prev === '' || prev === meetingTitle ? meetingTitle : prev))
  }, [meetingTitle])

  const removeSlot = useCallback(
    (id: string): void => {
      onSlotsChange(slots.filter((s) => s.id !== id))
    },
    [slots, onSlotsChange]
  )

  const clearAll = useCallback((): void => {
    onSlotsChange([])
    clearSchedulingDraft()
  }, [onSlotsChange])

  const handleCopyInvite = useCallback((): void => {
    if (!invitationText) return
    void (async (): Promise<void> => {
      const ok = await copyText(invitationText)
      if (ok) {
        setCopiedInvite(true)
        window.setTimeout(() => setCopiedInvite(false), 2000)
      } else {
        void showAppAlert(t('calendar.errors.clipboardWriteFailed'), {
          title: t('calendar.scheduling.panelTitle')
        })
      }
    })()
  }, [invitationText, t])

  const openBookWithMeSettings = useCallback((): void => {
    requestOpenAccountSettings({ tab: 'calendar' })
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('mailclient:settings-calendar-subnav', { detail: { id: 'bookWithMe' } })
      )
    }, 0)
  }, [])

  const handleCopyLink = useCallback((): void => {
    if (!bookWithMeUrl) return
    void (async (): Promise<void> => {
      const ok = await copyText(bookWithMeUrl)
      if (ok) {
        setCopiedLink(true)
        window.setTimeout(() => setCopiedLink(false), 2000)
      }
    })()
  }, [bookWithMeUrl])

  const handleSendMail = useCallback((): void => {
    if (!selectedAccount) return
    void (async (): Promise<void> => {
      setSending(true)
      setSendError(null)
      try {
        await sendSchedulingInvitationMail({
          accountId: selectedAccount.id,
          to: mailTo,
          cc: mailShowCc ? mailCc : undefined,
          subject: mailSubject,
          bodyPlain: mailBody
        })
        void showAppAlert(t('calendar.scheduling.sendSuccess'), {
          title: t('calendar.scheduling.panelTitle')
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setSendError(msg)
      } finally {
        setSending(false)
      }
    })()
  }, [selectedAccount, mailTo, mailCc, mailShowCc, mailSubject, mailBody, t])

  if (microsoftAccounts.length === 0) {
    return (
      <div className={cn('flex flex-col gap-3 p-4', className)}>
        <p className="text-sm text-muted-foreground">{t('calendar.scheduling.microsoftOnly')}</p>
        <button type="button" className="text-sm text-primary hover:underline" onClick={onClose}>
          {t('calendar.scheduling.close')}
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {t('calendar.scheduling.panelTitle')}
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {t('calendar.scheduling.panelIntro')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-secondary/80"
          title={t('calendar.scheduling.close')}
          aria-label={t('calendar.scheduling.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!bookWithMeUrl ? (
          <div
            role="status"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2"
          >
            <div className="flex gap-2">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500"
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11px] font-medium leading-snug text-amber-950 dark:text-amber-100">
                  {t('calendar.scheduling.noBookWithMeUrlTitle')}
                </p>
                <p className="text-[10px] leading-relaxed text-amber-900/90 dark:text-amber-100/80">
                  {t('calendar.scheduling.noBookWithMeUrl')}
                </p>
                <button
                  type="button"
                  onClick={openBookWithMeSettings}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  {t('calendar.bookWithMe.openSettings')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {microsoftAccounts.length > 1 ? (
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
              {t('settings.calendarAccountLabel')}
            </label>
            <select
              value={selectedAccount?.id ?? ''}
              onChange={(e): void => {
                const nextId = e.target.value
                onAccountIdChange(nextId)
                onSlotsChange([])
                const acc = microsoftAccounts.find((a) => a.id === nextId)
                if (acc) {
                  onMeetingTitleChange(
                    t('calendar.scheduling.defaultMeetingTitle', { name: acc.displayName })
                  )
                }
              }}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
            >
              {microsoftAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <section className="space-y-0 overflow-hidden rounded-lg border border-border bg-muted/15">
          <div className="border-b border-border/60 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('calendar.scheduling.mailHeading')}
            </span>
          </div>
          <RecipientTokenField
            label={t('calendar.scheduling.mailTo')}
            value={mailTo}
            onChange={setMailTo}
            accountId={selectedAccount!.id}
            showToggle={!mailShowCc}
            onToggleCcBcc={(): void => setMailShowCc(true)}
            className="!px-2 !py-1.5"
          />
          {mailShowCc ? (
            <RecipientTokenField
              label={t('calendar.scheduling.mailCc')}
              value={mailCc}
              onChange={setMailCc}
              accountId={selectedAccount!.id}
              className="!px-2 !py-1.5"
            />
          ) : null}
          <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
            <span className="w-10 shrink-0 text-xs text-muted-foreground">
              {t('calendar.scheduling.mailSubject')}
            </span>
            <input
              type="text"
              value={mailSubject}
              onChange={(e): void => setMailSubject(e.target.value)}
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
            />
          </div>
          <div className="p-2">
            <button
              type="button"
              disabled={sending || slots.length === 0 || !mailTo.trim()}
              onClick={handleSendMail}
              className={cn(
                'inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-primary-foreground',
                (sending || slots.length === 0 || !mailTo.trim()) && 'cursor-not-allowed opacity-40'
              )}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              {t('calendar.scheduling.sendMail')}
            </button>
            {sendError ? (
              <p className="mt-1.5 text-[10px] text-destructive">{sendError}</p>
            ) : null}
          </div>
        </section>

        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
            {t('calendar.scheduling.meetingTitle')}
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e): void => onMeetingTitleChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
            {t('calendar.scheduling.duration')}
          </label>
          <select
            value={durationMinutes}
            onChange={(e): void => onDurationMinutesChange(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
          >
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {t('calendar.scheduling.durationMinutes', { count: m })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">
              {t('calendar.scheduling.slotsHeading', { count: slots.length })}
            </span>
            {slots.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] text-muted-foreground hover:text-destructive"
              >
                {t('calendar.scheduling.clearSlots')}
              </button>
            ) : null}
          </div>
          {slots.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground">
              {t('calendar.scheduling.dragHint')}
            </p>
          ) : (
            <ul className="space-y-1">
              {slots.map((slot) => {
                const start = parseISO(slot.startIso)
                const end = parseISO(slot.endIso)
                const label = slot.isAllDay
                  ? format(start, invitationLocale === 'de' ? 'EEE d. MMM' : 'EEE, MMM d', {
                      locale: dateFnsLoc
                    })
                  : `${format(start, 'dd.MM. HH:mm', { locale: dateFnsLoc })} – ${format(end, 'HH:mm', { locale: dateFnsLoc })}`
                return (
                  <li
                    key={slot.id}
                    className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px]"
                  >
                    <span
                      className="h-8 w-1 shrink-0 rounded-full bg-amber-500/80"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <button
                      type="button"
                      onClick={(): void => removeSlot(slot.id)}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                      title={t('calendar.scheduling.removeSlot')}
                      aria-label={t('calendar.scheduling.removeSlot')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-muted-foreground">
              {t('calendar.scheduling.inviteHeading')}
            </span>
            <button
              type="button"
              disabled={!invitationText}
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
            >
              <Copy className="h-3 w-3" aria-hidden />
              {copiedInvite ? t('calendar.bookWithMe.copied') : t('calendar.scheduling.copyInvite')}
            </button>
          </div>
          <textarea
            value={mailBody}
            onChange={(e): void => {
              setMailBodyTouched(true)
              setMailBody(e.target.value)
            }}
            rows={8}
            className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-[11px] leading-relaxed text-foreground"
          />
        </div>

      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border px-3 py-2">
        <button
          type="button"
          disabled={!bookWithMeUrl}
          onClick={handleCopyLink}
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-secondary/80 disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {copiedLink ? t('calendar.bookWithMe.copied') : t('calendar.scheduling.copyBookingLink')}
        </button>
        <button
          type="button"
          onClick={(): void => {
            void openExternalUrl(BOOK_WITH_ME_MANAGE_URL).catch(() => undefined)
          }}
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          {t('calendar.scheduling.finishInBookings')}
        </button>
        <p className="text-center text-[10px] text-muted-foreground">{t('calendar.scheduling.finishHint')}</p>
      </div>
    </div>
  )
}
