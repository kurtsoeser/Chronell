import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { format, parseISO } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { Locale } from 'date-fns'
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
import { Avatar } from '@/components/Avatar'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { showAppAlert, showAppPrompt } from '@/stores/app-dialog'
import {
  MeetingInvitationDayPreview,
  meetingInvitationHasConflict,
  useMeetingInvitationDayEvents
} from '@/app/layout/meeting-invitation/MeetingInvitationDayPreview'
import {
  formatMeetingProposedRangeLabel,
  MeetingProposeTimeDialog
} from '@/app/layout/meeting-invitation/MeetingProposeTimeDialog'
import '@/app/layout/meeting-invitation/meeting-invitation.css'

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
  onReply,
  onReplyAll,
  onForward
}: {
  messageId: number
  account: ConnectedAccount | null
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
}): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const dfLocale: Locale = i18n.language.startsWith('de') ? deFns : enUSFns
  const [invitation, setInvitation] = useState<MeetingInvitationView | null>(null)
  const [loadWarnings, setLoadWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<MeetingInvitationResponseKind | null>(null)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null)
  const [responseMenu, setResponseMenu] = useState<{
    response: MeetingInvitationResponseKind
    x: number
    y: number
  } | null>(null)
  const moreBtnRef = useRef<HTMLButtonElement | null>(null)

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

  const attendeeSummary = useMemo(() => {
    if (!invitation) {
      return { accepted: 0, declined: 0, tentative: 0, pending: 0 }
    }
    const accepted = invitation.attendees.filter((a) => a.partStat === 'accepted').length
    const declined = invitation.attendees.filter((a) => a.partStat === 'declined').length
    const tentative = invitation.attendees.filter((a) => a.partStat === 'tentative').length
    const pending = invitation.attendees.filter(
      (a) => a.partStat === 'needs-action' || a.partStat === 'unknown'
    ).length
    return { accepted, declined, tentative, pending }
  }, [invitation])

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
        void reload()
        void window.mailClient.calendar.syncAccount(account.id).catch(() => undefined)
      } finally {
        setResponding(null)
      }
    },
    [account, invitation, messageId, reload, t]
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

  if (loading) {
    return (
      <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('mail.meetingInvitation.loading')}
      </div>
    )
  }

  if (!invitation) {
    if (loadWarnings.length === 0) return null
    return (
      <div className="mx-6 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-foreground">
        <p className="font-medium">{t('mail.meetingInvitation.loadFailedTitle')}</p>
        <p className="mt-1 text-muted-foreground">{loadWarnings.join(' · ')}</p>
      </div>
    )
  }

  const responseLabel = selfResponseLabel(invitation.selfPartStat, t)
  const proposedRangeLabel = formatMeetingProposedRangeLabel(invitation, dfLocale, i18n.language)
  const showPropose = canProposeNewTime(invitation)

  return (
    <section
      className="meeting-invitation-panel mx-6 mt-3 shrink-0 overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-500/[0.08] to-secondary/10"
      aria-label={t('mail.meetingInvitation.ariaLabel')}
    >
      <div className="space-y-4 px-5 py-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {invitation.isCancelled
              ? t('mail.meetingInvitation.cancelledIntro')
              : t('mail.meetingInvitation.intro')}
          </p>
          <h2 className="text-lg font-semibold leading-snug text-foreground">{invitation.summary}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {formatMeetingRange(invitation, dfLocale, i18n.language, t('mail.meetingInvitation.timeUnknown'))}
            </span>
            {responseLabel ? (
              <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-medium text-foreground">
                {responseLabel}
              </span>
            ) : null}
            {proposedRangeLabel ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {t('mail.meetingInvitation.youProposed', { when: proposedRangeLabel })}
              </span>
            ) : null}
          </div>
        </div>

        {loadWarnings.length > 0 ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">{loadWarnings.join(' · ')}</p>
        ) : null}

        {!invitation.isCancelled ? (
          <div className="flex flex-wrap items-center gap-2">
            <ResponseSplitButton
              tone="accept"
              label={t('mail.meetingInvitation.accept')}
              busy={responding === 'accept'}
              disabled={!!responding || !invitation.canRespond}
              onPrimaryClick={(): void => {
                void respond('accept')
              }}
              onOpenMenu={(x, y): void => setResponseMenu({ response: 'accept', x, y })}
            />
            <ResponseSplitButton
              tone="tentative"
              label={t('mail.meetingInvitation.tentative')}
              busy={responding === 'tentative'}
              disabled={!!responding || !invitation.canRespond}
              onPrimaryClick={(): void => {
                void respond('tentative')
              }}
              onOpenMenu={(x, y): void => setResponseMenu({ response: 'tentative', x, y })}
            />
            <ResponseSplitButton
              tone="decline"
              label={t('mail.meetingInvitation.decline')}
              busy={responding === 'decline'}
              disabled={!!responding || !invitation.canRespond}
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
            <button
              ref={moreBtnRef}
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background/60 px-2.5 text-[12px] font-medium text-foreground hover:bg-secondary/60"
              aria-label={t('mail.meetingInvitation.moreActions')}
              onClick={(e): void => {
                const r = e.currentTarget.getBoundingClientRect()
                setMoreMenu({ x: r.left, y: r.bottom + 4 })
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
            </button>
            {!invitation.canRespond && invitation.respondUnsupportedReason ? (
              <span className="text-[11px] text-muted-foreground">{invitation.respondUnsupportedReason}</span>
            ) : null}
          </div>
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

        <MeetingInvitationDayPreview
          invitation={invitation}
          dayEvents={dayEvents}
          loading={dayLoading}
        />

        <div className="space-y-2.5 text-[13px]">
          {invitation.organizer ? (
            <div className="flex items-start gap-2.5">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
              <Video className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('mail.meetingInvitation.onlineMeeting')}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#5B5FC7] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#4f52b8]"
                  onClick={(): void => {
                    void window.mailClient.app.openExternal(invitation.joinUrl!)
                  }}
                >
                  <Video className="h-4 w-4" aria-hidden />
                  {t('mail.meetingInvitation.joinMeeting')}
                </button>
              </div>
            </div>
          ) : null}

          {invitation.attendees.length > 0 ? (
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
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
                <ul className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
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
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
      : tone === 'decline'
        ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300'
        : 'border-border bg-secondary/50 text-foreground hover:bg-secondary/80'

  const dividerClass =
    tone === 'accept'
      ? 'border-emerald-500/30'
      : tone === 'decline'
        ? 'border-rose-500/30'
        : 'border-border/80'

  const Icon = IconOverride ?? (tone === 'accept' ? Check : tone === 'decline' ? X : Calendar)

  return (
    <div
      className={cn(
        'inline-flex h-9 overflow-hidden rounded-lg border text-[12px] font-semibold transition disabled:opacity-50',
        toneClass,
        disabled ? 'opacity-50' : ''
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onPrimaryClick}
        className="inline-flex h-full items-center gap-1.5 px-3 transition hover:brightness-95 disabled:pointer-events-none"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
        {label}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={t('mail.meetingInvitation.respondMenuAria')}
        className={cn(
          'inline-flex h-full items-center border-l px-1.5 transition hover:brightness-95 disabled:pointer-events-none',
          dividerClass
        )}
        onClick={(e): void => {
          const r = e.currentTarget.getBoundingClientRect()
          onOpenMenu(r.left, r.bottom + 4)
        }}
      >
        <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
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
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
      : tone === 'decline'
        ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300'
        : 'border-border bg-secondary/50 text-foreground hover:bg-secondary/80'

  const Icon = IconOverride ?? (tone === 'accept' ? Check : tone === 'decline' ? X : Calendar)

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition disabled:opacity-50',
        toneClass
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}
