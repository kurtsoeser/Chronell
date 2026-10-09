import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { logIpcError } from '@/lib/ipc-error-log'
import type { Locale } from 'date-fns'
import { format, parseISO } from 'date-fns'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  HelpCircle,
  Loader2,
  MapPin,
  MoreHorizontal,
  User,
  Users,
  Video,
  X,
  XCircle,
  CalendarClock
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  ConnectedAccount,
  MeetingAttendeePartStat,
  MeetingInvitationResponseKind,
  MeetingInvitationView
} from '@shared/types'
import { cn } from '@/lib/utils'
import { PreviewMetaDot, PreviewMetaRow } from '@/components/preview-meta-chrome'
import { Avatar } from '@/components/Avatar'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { showAppAlert, showAppPrompt } from '@/stores/app-dialog'
import { useMailStore } from '@/stores/mail'
import {
  MeetingInvitationDayPreview,
  meetingInvitationHasConflict,
  useMeetingInvitationDayEvents
} from '@/app/layout/meeting-invitation/MeetingInvitationDayPreview'
import {
  formatMeetingProposedRangeLabel,
  MeetingProposeTimeDialog
} from '@/app/layout/meeting-invitation/MeetingProposeTimeDialog'
import { MeetingRescheduleTimePopover } from '@/app/layout/meeting-invitation/MeetingRescheduleTimePopover'
import '@/app/layout/meeting-invitation/meeting-invitation.css'
import {
  displayMeetingSummary,
  meetingAttendeeResponseSummary,
  meetingInvitationIntroKey,
  meetingInvitationIsCompactSummary,
  meetingInvitationNeedsRsvp,
  shouldHideMeetingInvitationPanel
} from '@shared/meeting-invitation-display'

function partStatIcon(stat: MeetingAttendeePartStat): JSX.Element {
  switch (stat) {
    case 'accepted':
      return <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
    case 'declined':
      return <XCircle className="h-3.5 w-3.5 text-rose-500" aria-hidden />
    case 'tentative':
      return <HelpCircle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
    default:
      return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
  }
}

function formatMeetingRange(
  invitation: MeetingInvitationView,
  locale: Locale,
  language: string,
  unknownLabel: string
): string {
  if (!invitation.startIso || !invitation.endIso) return unknownLabel
  if (invitation.isAllDay) {
    const start = parseISO(invitation.startIso)
    const endExclusive = parseISO(invitation.endIso)
    const endInclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000)
    if (format(start, 'yyyy-MM-dd') === format(endInclusive, 'yyyy-MM-dd')) {
      return format(start, 'PPP', { locale })
    }
    return `${format(start, 'PPP', { locale })} – ${format(endInclusive, 'PPP', { locale })}`
  }
  const start = new Date(invitation.startIso)
  const end = new Date(invitation.endIso)
  const datePart = format(start, 'PPP', { locale })
  const timeFmt = language.startsWith('de') ? 'HH:mm' : 'p'
  return `${datePart}, ${format(start, timeFmt, { locale })} – ${format(end, timeFmt, { locale })}`
}

function selfResponseLabel(
  stat: MeetingAttendeePartStat | null,
  t: (key: string) => string
): string | null {
  switch (stat) {
    case 'accepted':
      return t('mail.meetingInvitation.youAccepted')
    case 'declined':
      return t('mail.meetingInvitation.youDeclined')
    case 'tentative':
      return t('mail.meetingInvitation.youTentative')
    default:
      return null
  }
}

function canProposeNewTime(invitation: MeetingInvitationView): boolean {
  return (
    invitation.canRespond &&
    invitation.allowNewTimeProposals &&
    !invitation.isCancelled &&
    !invitation.isAllDay &&
    Boolean(invitation.startIso && invitation.endIso)
  )
}

export function MeetingInvitationPanel({
  messageId,
  account,
  bodyPlainLength = 0,
  onReply,
  onReplyAll,
  onForward
}: {
  messageId: number
  account: ConnectedAccount | null
  /** Grobe Länge des Mail-Fliesstexts (für Ausblenden bei Kurznachrichten). */
  bodyPlainLength?: number
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
}): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const [invitation, setInvitation] = useState<MeetingInvitationView | null>(null)
  const [loadWarnings, setLoadWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<MeetingInvitationResponseKind | null>(null)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const rescheduleBtnRef = useRef<HTMLDivElement | null>(null)
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null)
  const [responseMenu, setResponseMenu] = useState<{
    response: MeetingInvitationResponseKind
    x: number
    y: number
  } | null>(null)
  const moreBtnRef = useRef<HTMLButtonElement | null>(null)
  const [detailsExpanded, setDetailsExpanded] = useState(false)

  useEffect(() => {
    setDetailsExpanded(false)
  }, [messageId])

  const toggleDetailsExpanded = useCallback((): void => {
    setDetailsExpanded((prev) => !prev)
  }, [])

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await window.mailClient.calendar.parseMeetingFromMessage(messageId)
      setInvitation(res.invitation)
      setLoadWarnings(res.warnings ?? [])
    } catch (e) {
      setInvitation(null)
      setLoadWarnings([e instanceof Error ? e.message : String(e)])
    } finally {
      setLoading(false)
    }
  }, [messageId])

  useEffect(() => {
    void reload()
  }, [reload])

  const { events: dayEvents, loading: dayLoading } = useMeetingInvitationDayEvents(invitation)

  const hasConflict = useMemo(
    () => (invitation ? meetingInvitationHasConflict(invitation, dayEvents) : false),
    [invitation, dayEvents]
  )

  const attendeeSummary = useMemo(
    () =>
      invitation
        ? meetingAttendeeResponseSummary(invitation.attendees)
        : { accepted: 0, declined: 0, tentative: 0, pending: 0 },
    [invitation]
  )

  const respond = useCallback(
    async (
      response: MeetingInvitationResponseKind,
      opts?: {
        withComment?: boolean
        sendResponse?: boolean
        proposedStartIso?: string
        proposedEndIso?: string
      }
    ): Promise<void> => {
      if (!invitation || !account || !invitation.canRespond) return
      if (response === 'propose' && !canProposeNewTime(invitation)) return

      const sendResponse = opts?.sendResponse !== false
      let comment: string | null = null
      if (opts?.withComment && sendResponse) {
        comment = await showAppPrompt(t('mail.meetingInvitation.commentPrompt'), {
          title: t('mail.meetingInvitation.commentTitle'),
          placeholder: t('mail.meetingInvitation.commentPlaceholder'),
          defaultValue: ''
        })
        if (comment === null) return
      }

      setResponding(response)
      try {
        const res = await window.mailClient.calendar.respondToMeetingInvitation({
          accountId: account.id,
          messageId,
          response,
          comment,
          sendResponse,
          proposedStartIso: opts?.proposedStartIso ?? null,
          proposedEndIso: opts?.proposedEndIso ?? null
        })
        if (!res.ok) {
          await showAppAlert(res.error ?? t('mail.meetingInvitation.respondFailed'), {
            title: t('mail.meetingInvitation.respondFailedTitle')
          })
          return
        }
        setInvitation((prev) => {
          if (!prev) return prev
          const selfEmail = account.email?.trim().toLowerCase()
          const selfPartStat = res.selfPartStat ?? prev.selfPartStat
          const attendees =
            selfEmail && selfPartStat
              ? prev.attendees.map((a) =>
                  a.email.toLowerCase() === selfEmail ? { ...a, partStat: selfPartStat } : a
                )
              : prev.attendees
          return {
            ...prev,
            selfPartStat,
            attendees,
            selfProposedStartIso: res.selfProposedStartIso ?? prev.selfProposedStartIso,
            selfProposedEndIso: res.selfProposedEndIso ?? prev.selfProposedEndIso
          }
        })
        void window.mailClient.calendar
          .syncAccount(account.id)
          .catch((err) => logIpcError('calendar.syncAccount', err))
        // Nach Zusage/Absage/Vorläufig/Zeitvorschlag: Einladung aus dem Posteingang ins Archiv
        // (wie Outlook „Anfragen nach Antwort löschen/archivieren“), sonst bleiben sie sichtbar.
        void useMailStore.getState().archiveMessage(messageId)
      } finally {
        setResponding(null)
      }
    },
    [account, invitation, messageId, t]
  )

  const responseMenuItems = useMemo((): ContextMenuItem[] => {
    if (!responseMenu) return []
    const response = responseMenu.response
    return [
      {
        id: 'without-comment',
        label: t('mail.meetingInvitation.respondWithoutComment'),
        onSelect: (): void => {
          void respond(response)
        }
      },
      {
        id: 'with-comment',
        label: t('mail.meetingInvitation.respondWithComment'),
        onSelect: (): void => {
          void respond(response, { withComment: true })
        }
      },
      {
        id: 'no-send',
        label: t('mail.meetingInvitation.respondDoNotSend'),
        onSelect: (): void => {
          void respond(response, { sendResponse: false })
        }
      }
    ]
  }, [respond, responseMenu, t])

  const moreItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []
    if (invitation && canProposeNewTime(invitation)) {
      items.push({
        id: 'propose-custom',
        label: t('mail.meetingInvitation.proposeNewTime'),
        icon: CalendarClock,
        onSelect: (): void => setProposeOpen(true)
      })
      items.push({ id: 'sep0', label: '', separator: true })
    }
    items.push(
      {
        id: 'reply-organizer',
        label: t('mail.meetingInvitation.replyOrganizer'),
        onSelect: onReply
      },
      {
        id: 'reply-all',
        label: t('mail.meetingInvitation.replyAll'),
        onSelect: onReplyAll
      },
      {
        id: 'forward',
        label: t('mail.meetingInvitation.forwardMeeting'),
        onSelect: onForward
      }
    )
    return items
  }, [invitation, onForward, onReply, onReplyAll, respond, t])

  const panelChromeClass = 'mt-1 overflow-hidden rounded-sm border border-border/60 bg-muted/30'

  if (loading) {
    return (
      <div
        className={cn(
          panelChromeClass,
          'flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground'
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('mail.meetingInvitation.loading')}
      </div>
    )
  }

  if (!invitation) {
    if (loadWarnings.length === 0) return null
    return (
      <div className={cn(panelChromeClass, 'px-2 py-2 text-xs text-foreground')}>
        <p className="font-medium">{t('mail.meetingInvitation.loadFailedTitle')}</p>
        <p className="mt-0.5 text-muted-foreground">{loadWarnings.join(' · ')}</p>
      </div>
    )
  }

  if (shouldHideMeetingInvitationPanel(invitation, bodyPlainLength)) {
    return null
  }

  const responseLabel = selfResponseLabel(invitation.selfPartStat, t)
  const proposedRangeLabel = formatMeetingProposedRangeLabel(invitation, dfLocale, i18n.language)
  const showPropose = canProposeNewTime(invitation)
  const displayTitle = displayMeetingSummary(invitation.summary)
  const introKey = meetingInvitationIntroKey(invitation)
  const needsRsvp = meetingInvitationNeedsRsvp(invitation)
  const compactSummary = meetingInvitationIsCompactSummary(invitation)
  const showOrganizerActions = invitation.isOrganizer && !invitation.isCancelled
  const showActionRow = needsRsvp || showOrganizerActions
  const timeLabel = formatMeetingRange(
    invitation,
    dfLocale,
    i18n.language,
    t('mail.meetingInvitation.timeUnknown')
  )

  const moreButton = (
    <button
      ref={moreBtnRef}
      type="button"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
      aria-label={t('mail.meetingInvitation.moreActions')}
      onClick={(e): void => {
        const r = e.currentTarget.getBoundingClientRect()
        setMoreMenu({ x: r.left, y: r.bottom + 4 })
      }}
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <section
      className={cn('meeting-invitation-panel shrink-0', panelChromeClass)}
      aria-label={t('mail.meetingInvitation.ariaLabel')}
    >
      <PreviewMetaRow label={t('mail.meetingInvitation.rowLabel')} className="border-b-0">
        <div className="space-y-1.5 py-0.5">
          {compactSummary ? (
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
              <button
                type="button"
                onClick={toggleDetailsExpanded}
                aria-expanded={detailsExpanded}
                aria-label={
                  detailsExpanded
                    ? t('mail.meetingInvitation.collapse')
                    : t('mail.meetingInvitation.expand')
                }
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60"
              >
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform',
                    !detailsExpanded && '-rotate-90'
                  )}
                  aria-hidden
                />
              </button>
              <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <button
                type="button"
                onClick={toggleDetailsExpanded}
                className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
              >
                {displayTitle}
              </button>
              <PreviewMetaDot />
              <span className="hidden shrink-0 text-muted-foreground sm:inline">{timeLabel}</span>
              {responseLabel ? (
                <>
                  <PreviewMetaDot />
                  <span className="shrink-0 text-muted-foreground">{responseLabel}</span>
                </>
              ) : null}
              {attendeeSummary.accepted > 0 ? (
                <>
                  <PreviewMetaDot />
                  <span className="hidden shrink-0 text-muted-foreground md:inline">
                    {t('mail.meetingInvitation.acceptedCount', { count: attendeeSummary.accepted })}
                  </span>
                </>
              ) : null}
              {invitation.joinUrl && !detailsExpanded ? (
                <button
                  type="button"
                  className="hidden shrink-0 font-medium text-primary hover:underline lg:inline"
                  onClick={(): void => {
                    void window.mailClient.app.openExternal(invitation.joinUrl!)
                  }}
                >
                  {t('mail.meetingInvitation.joinMeeting')}
                </button>
              ) : null}
              {moreButton}
            </div>
          ) : (
            <div className="flex items-start gap-1">
              <button
                type="button"
                onClick={toggleDetailsExpanded}
                aria-expanded={detailsExpanded}
                aria-label={
                  detailsExpanded
                    ? t('mail.meetingInvitation.collapse')
                    : t('mail.meetingInvitation.expand')
                }
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60"
              >
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform',
                    !detailsExpanded && '-rotate-90'
                  )}
                  aria-hidden
                />
              </button>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[10px] text-muted-foreground">{t(`mail.meetingInvitation.${introKey}`)}</p>
                <p className="text-xs font-medium leading-snug text-foreground">{displayTitle}</p>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden />
                    {timeLabel}
                  </span>
                  {responseLabel ? (
                    <>
                      <PreviewMetaDot />
                      <span>{responseLabel}</span>
                    </>
                  ) : null}
                  {proposedRangeLabel ? (
                    <>
                      <PreviewMetaDot />
                      <span className="text-amber-700 dark:text-amber-300">
                        {t('mail.meetingInvitation.youProposed', { when: proposedRangeLabel })}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              {!showActionRow ? moreButton : null}
            </div>
          )}

      {showActionRow ? (
        <div className="flex flex-wrap items-center gap-1">
          {needsRsvp ? (
            <>
              <ResponseSplitButton
                tone="accept"
                label={t('mail.meetingInvitation.accept')}
                busy={responding === 'accept'}
                disabled={!!responding}
                onPrimaryClick={(): void => {
                  void respond('accept')
                }}
                onOpenMenu={(x, y): void => setResponseMenu({ response: 'accept', x, y })}
              />
              <ResponseSplitButton
                tone="tentative"
                label={t('mail.meetingInvitation.tentative')}
                busy={responding === 'tentative'}
                disabled={!!responding}
                onPrimaryClick={(): void => {
                  void respond('tentative')
                }}
                onOpenMenu={(x, y): void => setResponseMenu({ response: 'tentative', x, y })}
              />
              <ResponseSplitButton
                tone="decline"
                label={t('mail.meetingInvitation.decline')}
                busy={responding === 'decline'}
                disabled={!!responding}
                onPrimaryClick={(): void => {
                  void respond('decline')
                }}
                onOpenMenu={(x, y): void => setResponseMenu({ response: 'decline', x, y })}
              />
              {showPropose ? (
                <ResponseButton
                  tone="tentative"
                  label={t('mail.meetingInvitation.proposeNewTime')}
                  busy={responding === 'propose'}
                  disabled={!!responding}
                  onClick={(): void => setProposeOpen(true)}
                  icon={CalendarClock}
                />
              ) : null}
            </>
          ) : showOrganizerActions ? (
            <>
              {invitation.canReschedule ? (
                <div ref={rescheduleBtnRef} className="inline-flex">
                  <ResponseButton
                    tone="tentative"
                    label={t('mail.meetingInvitation.changeTime')}
                    busy={false}
                    disabled={false}
                    onClick={(): void => setRescheduleOpen(true)}
                    icon={CalendarClock}
                  />
                </div>
              ) : invitation.rescheduleUnsupportedReason ? (
                <span className="text-[11px] text-muted-foreground">
                  {invitation.rescheduleUnsupportedReason}
                </span>
              ) : null}
            </>
          ) : null}
          {moreButton}
        </div>
      ) : null}
        </div>
      </PreviewMetaRow>

      {detailsExpanded ? (
      <div className="space-y-2 border-t border-border/50 bg-background px-2 py-2">
        {loadWarnings.length > 0 ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">{loadWarnings.join(' · ')}</p>
        ) : null}

        {hasConflict && showPropose ? (
          <p className="text-[12px] text-foreground/90">
            {t('mail.meetingInvitation.conflictHint')}{' '}
            <span className="font-medium text-rose-500">{t('mail.meetingInvitation.busy')}</span>
            {' — '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={(): void => setProposeOpen(true)}
            >
              {t('mail.meetingInvitation.proposeNewTimeLink')}
            </button>
          </p>
        ) : hasConflict ? (
          <p className="text-[12px] text-foreground/90">
            {t('mail.meetingInvitation.conflictHint')}{' '}
            <span className="font-medium text-rose-500">{t('mail.meetingInvitation.busy')}</span>
          </p>
        ) : null}

        <div className="meeting-invitation-details-grid grid gap-3 lg:grid-cols-2">
          <MeetingInvitationDayPreview
            invitation={invitation}
            dayEvents={dayEvents}
            loading={dayLoading}
            previewHeightPx={168}
          />

        <div className="space-y-2 text-[12px]">
          {invitation.organizer ? (
            <div className="flex items-start gap-2.5">
              <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('mail.meetingInvitation.organizer')}
                </div>
                <div className="truncate font-medium text-foreground">
                  {invitation.organizer.name ?? invitation.organizer.email}
                </div>
                {invitation.organizer.name ? (
                  <div className="truncate text-[12px] text-muted-foreground">
                    {invitation.organizer.email}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {invitation.location ? (
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('mail.meetingInvitation.location')}
                </div>
                <div className="text-foreground">{invitation.location}</div>
              </div>
            </div>
          ) : null}

          {invitation.joinUrl ? (
            <div className="flex items-start gap-2.5">
              <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('mail.meetingInvitation.onlineMeeting')}
                </div>
                <button
                  type="button"
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 text-[10px] font-medium text-foreground hover:bg-secondary/70"
                  onClick={(): void => {
                    void window.mailClient.app.openExternal(invitation.joinUrl!)
                  }}
                >
                  <Video className="h-3 w-3" aria-hidden />
                  {t('mail.meetingInvitation.joinMeeting')}
                </button>
              </div>
            </div>
          ) : null}

          {invitation.attendees.length > 0 ? (
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('mail.meetingInvitation.attendees')}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    {attendeeSummary.accepted > 0 ? (
                      <span>{t('mail.meetingInvitation.acceptedCount', { count: attendeeSummary.accepted })}</span>
                    ) : null}
                    {attendeeSummary.declined > 0 ? (
                      <span>{t('mail.meetingInvitation.declinedCount', { count: attendeeSummary.declined })}</span>
                    ) : null}
                    {attendeeSummary.tentative > 0 ? (
                      <span>{t('mail.meetingInvitation.tentativeCount', { count: attendeeSummary.tentative })}</span>
                    ) : null}
                    {attendeeSummary.pending > 0 ? (
                      <span>{t('mail.meetingInvitation.pendingCount', { count: attendeeSummary.pending })}</span>
                    ) : null}
                  </div>
                </div>
                <ul className="max-h-32 space-y-1 overflow-y-auto pr-1">
                  {invitation.attendees.map((a) => {
                    const isSelf = a.email.toLowerCase() === account?.email?.trim().toLowerCase()
                    return (
                    <li key={a.email} className="flex items-center gap-2 rounded-md px-1 py-0.5">
                      <Avatar
                        email={a.email}
                        name={a.name ?? a.email}
                        size="xs"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-foreground">
                          {a.name ?? a.email}
                          {isSelf ? (
                            <span className="font-normal text-muted-foreground">
                              {' '}
                              ({t('mail.meetingInvitation.youLabel')})
                            </span>
                          ) : null}
                        </div>
                        {a.name ? (
                          <div className="truncate text-[11px] text-muted-foreground">{a.email}</div>
                        ) : null}
                      </div>
                      <span title={t(`mail.meetingInvitation.partStat.${a.partStat}`)}>
                        {partStatIcon(a.partStat)}
                      </span>
                    </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
        </div>
      </div>
      ) : null}

      {responseMenu ? (
        <ContextMenu
          x={responseMenu.x}
          y={responseMenu.y}
          items={responseMenuItems}
          onClose={(): void => setResponseMenu(null)}
        />
      ) : null}

      {moreMenu ? (
        <ContextMenu
          x={moreMenu.x}
          y={moreMenu.y}
          items={moreItems}
          onClose={(): void => setMoreMenu(null)}
        />
      ) : null}

      {account && proposeOpen ? (
        <MeetingProposeTimeDialog
          open={proposeOpen}
          invitation={invitation}
          account={account}
          messageId={messageId}
          onClose={(): void => setProposeOpen(false)}
          onProposed={(patch): void => {
            setInvitation((prev) =>
              prev
                ? {
                    ...prev,
                    selfPartStat: patch.selfPartStat,
                    selfProposedStartIso: patch.selfProposedStartIso,
                    selfProposedEndIso: patch.selfProposedEndIso
                  }
                : prev
            )
          }}
        />
      ) : null}

      {account && rescheduleOpen && rescheduleBtnRef.current ? (
        <MeetingRescheduleTimePopover
          anchorEl={rescheduleBtnRef.current}
          invitation={invitation}
          account={account}
          messageId={messageId}
          onClose={(): void => setRescheduleOpen(false)}
          onRescheduled={(patch): void => {
            setInvitation((prev) =>
              prev ? { ...prev, startIso: patch.startIso, endIso: patch.endIso } : prev
            )
          }}
        />
      ) : null}
    </section>
  )
}

function ResponseSplitButton({
  tone,
  label,
  busy,
  disabled,
  onPrimaryClick,
  onOpenMenu,
  icon: IconOverride
}: {
  tone: 'accept' | 'tentative' | 'decline'
  label: string
  busy: boolean
  disabled: boolean
  onPrimaryClick: () => void
  onOpenMenu: (x: number, y: number) => void
  icon?: ComponentType<{ className?: string }>
}): JSX.Element {
  const { t } = useTranslation()
  const toneClass =
    tone === 'accept'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400'
      : tone === 'decline'
        ? 'border-rose-500/35 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-400'
        : 'border-border/80 bg-background text-foreground hover:bg-secondary/60'

  const dividerClass =
    tone === 'accept'
      ? 'border-emerald-500/25'
      : tone === 'decline'
        ? 'border-rose-500/25'
        : 'border-border/70'

  const Icon = IconOverride ?? (tone === 'accept' ? Check : tone === 'decline' ? X : Calendar)

  return (
    <div
      className={cn(
        'inline-flex h-6 overflow-hidden rounded-md border text-[10px] font-medium transition disabled:opacity-50',
        toneClass,
        disabled ? 'opacity-50' : ''
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onPrimaryClick}
        className="inline-flex h-full items-center gap-1 px-2 transition disabled:pointer-events-none"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
        {label}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={t('mail.meetingInvitation.respondMenuAria')}
        className={cn(
          'inline-flex h-full items-center border-l px-1 transition disabled:pointer-events-none',
          dividerClass
        )}
        onClick={(e): void => {
          const r = e.currentTarget.getBoundingClientRect()
          onOpenMenu(r.left, r.bottom + 4)
        }}
      >
        <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
      </button>
    </div>
  )
}

function ResponseButton({
  tone,
  label,
  busy,
  disabled,
  onClick,
  icon: IconOverride
}: {
  tone: 'accept' | 'tentative' | 'decline'
  label: string
  busy: boolean
  disabled: boolean
  onClick: () => void
  icon?: ComponentType<{ className?: string }>
}): JSX.Element {
  const toneClass =
    tone === 'accept'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400'
      : tone === 'decline'
        ? 'border-rose-500/35 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-400'
        : 'border-border/80 bg-background text-foreground hover:bg-secondary/60'

  const Icon = IconOverride ?? (tone === 'accept' ? Check : tone === 'decline' ? X : Calendar)

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition disabled:opacity-50',
        toneClass
      )}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {label}
    </button>
  )
}
