import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Locale } from 'date-fns'
import { addDays, differenceInMinutes, format, parseISO, startOfDay } from 'date-fns'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  AlignLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Info,
  Link2,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Tag,
  User,
  Users,
  Video,
  X
} from 'lucide-react'
import type { CalendarEventAttachmentMeta, CalendarEventView, MeetingAttendeePartStat } from '@shared/types'
import { preferTeamsJoinUrl } from '@shared/teams-join-url'
import { CalendarEventAttachmentRow } from '@/app/calendar/CalendarEventAttachmentRow'
import { fullCalendarEventToPatchSchedule } from '@/app/calendar/calendar-shell-view-helpers'
import {
  patchScheduleInputWithMeetingNotify,
  resolveMeetingScheduleChange
} from '@/app/calendar/calendar-meeting-schedule-change'
import { openExternalUrl } from '@/lib/open-external'
import { useResolvedCopilotPrompt } from '@/lib/copilot-prompt-prefs'
import { listCopilotEngineOptions } from '@/lib/copilot-engine-options'
import { useAiConnectionsSettings } from '@/lib/use-ai-connections-settings'
import {
  calendarEventCanRespondAsAttendee,
  respondToCalendarEventInvitation
} from '@/lib/calendar-event-rsvp'
import { ChronellDateField } from '@/components/ChronellDateField'
import { ChronellTimeField } from '@/components/ChronellTimeField'
import {
  previewSectionDividerClass,
  eventDialogPanelSelectClass
} from '@/lib/chronell-ui-classes'
import {
  addMinutesToDate,
  mergeHmIntoDate,
  mergeHmIntoEndAfterStart,
  mergeYmdIntoDate
} from '@/lib/calendar-time-select'
import { cn } from '@/lib/utils'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import { CalendarEventDescriptionPreview } from '@/app/calendar/CalendarEventDescriptionPreview'
import { WebinarInvitationPreview } from '@/app/calendar/WebinarInvitationPreview'
import {
  buildWebinarAttendeePreviewHtml,
  isWebinarInvitationHtmlLikelyGutted
} from '@/lib/build-webinar-attendee-preview-html'
import {
  buildWebinarRepairPreviewHtml,
  prepareWebinarRepairSaveBundle
} from '@/lib/build-webinar-repair-preview'
import { CalendarMeetingInsightsPanel } from '@/app/calendar/CalendarMeetingInsightsPanel'
import { formatMeetingAiInsightsForCopilotContext } from '@/app/calendar/format-meeting-ai-insights-for-copilot'
import { useMeetingAiInsights } from '@/app/calendar/use-meeting-ai-insights'
import { CopilotAssistPanel } from '@/components/copilot/CopilotAssistPanel'
import { PreviewFoldSection } from '@/components/PreviewFoldSection'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { calendarEventIconIsExplicit, resolveCalendarEventIcon } from '@/lib/calendar-event-icons'
import { isWebinarInvitationHtml } from '@/lib/parse-webinar-invitation-html'
import { prepareWebinarInvitationBodyForGraph } from '@/lib/sanitize-webinar-invitation-html'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import {
  prepareCalendarEventBodyHtmlForAttendeeDisplay,
  prepareCalendarEventBodyHtmlForEditor
} from '@/lib/prepare-calendar-event-body-html'
import { prepareCalendarEventDescriptionFromEditorHtml } from '@shared/calendar-event-body-html'
import { useThemeStore } from '@/stores/theme'

function formatEventRange(
  ev: CalendarEventView,
  locale: Locale,
  allDaySuffix: string,
  sameDayTimeFormat: string
): string {
  const start = parseISO(ev.startIso)
  const end = parseISO(ev.endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${ev.startIso} – ${ev.endIso}`
  }
  if (ev.isAllDay) {
    const a = format(start, 'PPP', { locale })
    const b = format(addDays(end, -1), 'PPP', { locale })
    if (a === b) return `${a} ${allDaySuffix}`
    return `${a} – ${b} ${allDaySuffix}`
  }
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return `${format(start, sameDayTimeFormat, { locale })} · ${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
  }
  return `${format(start, 'Pp', { locale })} – ${format(end, 'Pp', { locale })}`
}

function eventToScheduleDraft(ev: CalendarEventView): {
  isAllDay: boolean
  rangeStart: Date
  rangeEnd: Date
} {
  const start = parseISO(ev.startIso)
  const end = parseISO(ev.endIso)
  if (ev.isAllDay) {
    const rangeStart = startOfDay(Number.isNaN(start.getTime()) ? new Date() : start)
    const rangeEnd = startOfDay(
      Number.isNaN(end.getTime()) ? addDays(rangeStart, 1) : end
    )
    return { isAllDay: true, rangeStart, rangeEnd }
  }
  return {
    isAllDay: false,
    rangeStart: Number.isNaN(start.getTime()) ? new Date() : start,
    rangeEnd: Number.isNaN(end.getTime()) ? new Date() : end
  }
}

type PreviewEditField = 'title' | 'schedule'

function formatEventDurationMinutes(totalMin: number, t: TFunction): string {
  if (totalMin < 1) return t('calendar.eventPreview.durationUnderMinute')
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours === 0) return t('calendar.eventPreview.durationMinutesOnly', { minutes })
  if (minutes === 0) return t('calendar.eventPreview.durationHoursOnly', { hours })
  return t('calendar.eventPreview.durationHoursMinutes', { hours, minutes })
}

function locationMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

/** Ort ist redundant, wenn schon ein Join-Link im Header existiert. */
function isRedundantOnlineLocation(location: string, hasJoinUrl: boolean): boolean {
  if (!hasJoinUrl) return false
  const n = location.trim().toLowerCase()
  if (!n) return true
  if (/^https?:\/\//i.test(n)) return true
  return (
    n === 'online' ||
    n === 'teams' ||
    n === 'microsoft teams' ||
    n === 'microsoft teams-besprechung' ||
    n === 'microsoft teams meeting' ||
    n.includes('microsoft teams meeting') ||
    n.includes('teams-besprechung') ||
    n === 'zoom' ||
    n === 'webex' ||
    n === 'google meet'
  )
}

const INFO_ATTENDEE_PREVIEW = 3

function PreviewDetailRow(props: {
  icon: typeof MapPin
  label: string
  children: ReactNode
}): JSX.Element {
  const Icon = props.icon
  return (
    <div className="flex gap-2.5 py-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {props.label}
        </p>
        <div className="text-sm leading-snug text-foreground">{props.children}</div>
      </div>
    </div>
  )
}

export function CalendarEventPreview(props: {
  event: CalendarEventView
  /** Anzeigename des Kalenderordners (Sidebar), falls bekannt. */
  calendarName?: string | null
  /** Verbindungen-Vorschau: Kontext lebt im separaten Panel darunter. */
  hideEntityContext?: boolean
  /** Klick (Standard) oder Doppelklick zum Start der Inline-Bearbeitung. */
  inlineEditActivateOn?: 'click' | 'doubleClick'
  onEdit: () => void
  onSaved?: () => void
  onEventChange?: (event: CalendarEventView) => void
  className?: string
}): JSX.Element {
  const {
    event: ev,
    calendarName,
    hideEntityContext = false,
    inlineEditActivateOn = 'click',
    onEdit,
    onSaved,
    onEventChange,
    className
  } = props
  const { t, i18n } = useTranslation()
  const meetingPreparePrompt = useResolvedCopilotPrompt('meeting.prepare')
  const meetingReviewPrompt = useResolvedCopilotPrompt('meeting.review')
  const { settings: aiSettings } = useAiConnectionsSettings()
  const meetingAiAssistAvailable =
    listCopilotEngineOptions({
      microsoftAccount: ev.accountId.startsWith('ms:'),
      aiSettings
    }).length > 0
  const viewerTheme = useThemeStore((s) => s.effective)
  const [err, setErr] = useState<string | null>(null)
  const [descHtml, setDescHtml] = useState('')
  const [descIsWebinar, setDescIsWebinar] = useState(false)
  const [descChronellWebinarInvitation, setDescChronellWebinarInvitation] = useState(false)
  const [webinarRepairBusy, setWebinarRepairBusy] = useState(false)
  const [descLoading, setDescLoading] = useState(false)
  const [descErr, setDescErr] = useState<string | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [infoExpanded, setInfoExpanded] = useState(true)
  const [infoDetailsExpanded, setInfoDetailsExpanded] = useState(false)
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([])
  const [teamsMeeting, setTeamsMeeting] = useState(false)
  const [detailJoinUrl, setDetailJoinUrl] = useState<string | null>(null)
  const [detailLocation, setDetailLocation] = useState<string | null>(null)
  const [detailOrganizer, setDetailOrganizer] = useState<string | null>(null)
  const [detailIsOrganizer, setDetailIsOrganizer] = useState<boolean | null>(null)
  const [detailEventType, setDetailEventType] = useState<
    'singleInstance' | 'occurrence' | 'exception' | 'seriesMaster' | null
  >(null)
  const [detailSeriesMasterId, setDetailSeriesMasterId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<CalendarEventAttachmentMeta[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentBusyId, setAttachmentBusyId] = useState<string | null>(null)
  const [joinUrlCopied, setJoinUrlCopied] = useState(false)
  const [rsvpBusy, setRsvpBusy] = useState<'accept' | 'decline' | 'tentative' | null>(null)
  const [rsvpMenuOpen, setRsvpMenuOpen] = useState(false)
  const rsvpMenuRef = useRef<HTMLDivElement>(null)
  const [selfPartStat, setSelfPartStat] = useState<MeetingAttendeePartStat | null>(null)
  const [selfResponseAtIso, setSelfResponseAtIso] = useState<string | null>(null)

  const [editingField, setEditingField] = useState<PreviewEditField | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [isAllDay, setIsAllDay] = useState(ev.isAllDay)
  const [rangeStart, setRangeStart] = useState(() => new Date())
  const [rangeEnd, setRangeEnd] = useState(() => new Date())
  const [inlineSaving, setInlineSaving] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const scheduleEditorRef = useRef<HTMLDivElement>(null)

  const dfLocale = useDateFnsLocale()
  const allDaySuffix = t('calendar.eventPreview.allDaySuffix')
  const sameDayFmt = i18n.language.startsWith('de') ? 'EEEE, d. MMMM yyyy' : 'EEEE, MMMM d, yyyy'
  const rangeLabel = useMemo(
    () => formatEventRange(ev, dfLocale, allDaySuffix, sameDayFmt),
    [ev, dfLocale, allDaySuffix, sameDayFmt]
  )
  const durationLabel = useMemo(() => {
    if (ev.isAllDay) return null
    const start = parseISO(ev.startIso)
    const end = parseISO(ev.endIso)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    const mins = differenceInMinutes(end, start)
    if (mins <= 0) return null
    return formatEventDurationMinutes(mins, t)
  }, [ev.endIso, ev.isAllDay, ev.startIso, t])
  const locationLabel = (ev.location?.trim() || detailLocation?.trim() || '').trim() || null
  const organizerLabel = (ev.organizer?.trim() || detailOrganizer?.trim() || '').trim() || null
  const calendarLabel = calendarName?.trim() || null
  const meetingJoinUrl = (detailJoinUrl?.trim() || ev.joinUrl?.trim() || '').trim() || null
  const meetingEnded = useMemo(() => {
    const endMs = Date.parse(ev.endIso)
    return Number.isFinite(endMs) && endMs <= Date.now()
  }, [ev.endIso])
  const canRespondAsAttendee = calendarEventCanRespondAsAttendee(ev, {
    isOrganizer: detailIsOrganizer
  })

  const { loading: meetingInsightsLoading, result: meetingInsights } = useMeetingAiInsights({
    accountId: ev.accountId,
    joinUrl: meetingJoinUrl,
    endIso: ev.endIso
  })

  const meetingPrepContext = useMemo(() => {
    const lines = [
      ev.title?.trim() ? `Meeting: ${ev.title.trim()}` : null,
      `When: ${ev.startIso} – ${ev.endIso}`,
      locationLabel ? `Location: ${locationLabel}` : null,
      organizerLabel ? `Organizer: ${organizerLabel}` : null,
      attendeeEmails.length > 0 ? `Attendees: ${attendeeEmails.join(', ')}` : null,
      meetingJoinUrl ? `Join URL: ${meetingJoinUrl}` : null
    ].filter(Boolean)
    const bodyPlain = descHtml.trim()
      ? descHtml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 6_000)
      : ''
    const insightsBlock = formatMeetingAiInsightsForCopilotContext(meetingInsights)
    return [...lines, bodyPlain, insightsBlock].filter(
      (s): s is string => !!s && s.trim().length > 0
    )
  }, [
    attendeeEmails,
    descHtml,
    ev.endIso,
    ev.startIso,
    ev.title,
    locationLabel,
    meetingInsights,
    meetingJoinUrl,
    organizerLabel
  ])

  const selfResponseAtLabel = useMemo(() => {
    if (!selfResponseAtIso) return null
    try {
      const d = parseISO(selfResponseAtIso)
      if (Number.isNaN(d.getTime())) return null
      return format(d, i18n.language.startsWith('de') ? 'd. MMM yyyy, HH:mm' : 'MMM d, yyyy, HH:mm', {
        locale: dfLocale
      })
    } catch {
      return null
    }
  }, [dfLocale, i18n.language, selfResponseAtIso])

  const selfResponseLabel = useMemo(() => {
    if (selfPartStat === 'accepted') {
      return selfResponseAtLabel
        ? t('calendar.eventRsvp.statusAcceptedAt', { when: selfResponseAtLabel })
        : t('calendar.eventRsvp.statusAccepted')
    }
    if (selfPartStat === 'tentative') {
      return selfResponseAtLabel
        ? t('calendar.eventRsvp.statusTentativeAt', { when: selfResponseAtLabel })
        : t('calendar.eventRsvp.statusTentative')
    }
    if (selfPartStat === 'declined') {
      return selfResponseAtLabel
        ? t('calendar.eventRsvp.statusDeclinedAt', { when: selfResponseAtLabel })
        : t('calendar.eventRsvp.statusDeclined')
    }
    if (selfPartStat === 'needs-action' && canRespondAsAttendee) {
      return t('calendar.eventRsvp.statusNeedsAction')
    }
    return null
  }, [canRespondAsAttendee, selfPartStat, selfResponseAtLabel, t])

  const selfResponseToneClass =
    selfPartStat === 'accepted'
      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : selfPartStat === 'declined'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : selfPartStat === 'tentative'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
          : 'border-border bg-secondary text-secondary-foreground'
  const noteTarget = useMemo(() => {
    const eventRemoteId = ev.graphEventId?.trim()
    if (!eventRemoteId) return null
    return {
      kind: 'calendar' as const,
      accountId: ev.accountId,
      calendarSource: ev.source,
      calendarRemoteId: ev.graphCalendarId?.trim() || 'default',
      eventRemoteId,
      title: ev.title,
      eventTitleSnapshot: ev.title,
      eventStartIsoSnapshot: ev.startIso
    }
  }, [ev.accountId, ev.graphCalendarId, ev.graphEventId, ev.source, ev.startIso, ev.title])

  const canEdit = ev.calendarCanEdit !== false && Boolean(ev.graphEventId)

  useEffect(() => {
    setEditingField(null)
    setInlineError(null)
    setDescExpanded(false)
    setInfoExpanded(true)
    setInfoDetailsExpanded(false)
  }, [ev.id, ev.startIso, ev.endIso, ev.title])

  useEffect(() => {
    if (editingField === 'title') {
      setTitleDraft(ev.title?.trim() ?? '')
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
    if (editingField === 'schedule') {
      const draft = eventToScheduleDraft(ev)
      setIsAllDay(draft.isAllDay)
      setRangeStart(draft.rangeStart)
      setRangeEnd(draft.rangeEnd)
    }
  }, [editingField, ev])

  useEffect(() => {
    const eventId = ev.graphEventId?.trim()
    if (!eventId) {
      setDescHtml('')
      setDescIsWebinar(false)
      setDescChronellWebinarInvitation(false)
      setDescLoading(false)
      setDescErr(null)
      setAttendeeEmails([])
      setTeamsMeeting(false)
      setDetailJoinUrl(null)
      setDetailLocation(null)
      setDetailOrganizer(null)
      setDetailIsOrganizer(null)
      setDetailEventType(null)
      setDetailSeriesMasterId(null)
      setSelfPartStat(null)
      setSelfResponseAtIso(null)
      setAttachments([])
      setAttachmentsLoading(false)
      return
    }
    if (ev.source === 'google' && !ev.graphCalendarId?.trim()) {
      setDescHtml('')
      setDescIsWebinar(false)
      setDescChronellWebinarInvitation(false)
      setDescLoading(false)
      setDescErr(null)
      setAttendeeEmails([])
      setTeamsMeeting(false)
      setDetailJoinUrl(null)
      setDetailLocation(null)
      setDetailOrganizer(null)
      setDetailIsOrganizer(null)
      setDetailEventType(null)
      setDetailSeriesMasterId(null)
      setSelfPartStat(null)
      setSelfResponseAtIso(null)
      setAttachments([])
      setAttachmentsLoading(false)
      return
    }
    const canLoadAttachments = ev.source === 'microsoft' || ev.source === 'google'
    let cancelled = false
    setDescLoading(true)
    setDescErr(null)
    setAttachmentsLoading(canLoadAttachments)
    void window.mailClient.calendar
      .getEvent({
        accountId: ev.accountId,
        graphEventId: eventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        forceRefresh: true
      })
      .then(async (d) => {
        if (cancelled) return
        let raw = d.bodyHtml?.trim() ? d.bodyHtml.trim() : ''
        const isWebinarBody =
          !!d.chronellWebinarInvitation || isWebinarInvitationHtml(raw)
        if (
          isWebinarBody &&
          isWebinarInvitationHtmlLikelyGutted(raw, {
            chronellWebinarInvitation: !!d.chronellWebinarInvitation
          })
        ) {
          const fresh = await window.mailClient.calendar.getEvent({
            accountId: ev.accountId,
            graphEventId: eventId,
            graphCalendarId: ev.graphCalendarId ?? null,
            forceRefresh: true
          })
          if (cancelled) return
          raw = fresh.bodyHtml?.trim() ? fresh.bodyHtml.trim() : raw
        }
        setDescIsWebinar(isWebinarBody)
        setDescChronellWebinarInvitation(!!d.chronellWebinarInvitation)
        try {
          const prepared = await prepareCalendarEventBodyHtmlForAttendeeDisplay(raw, {
            accountId: ev.accountId,
            graphEventId: eventId,
            graphCalendarId: ev.graphCalendarId ?? null,
            resolveInlineImages: ev.source === 'microsoft'
          })
          if (cancelled) return
          setDescHtml(prepared)
        } catch (e) {
          console.warn('[calendar-preview] prepare body:', e)
          if (!cancelled) setDescHtml(raw)
        }
        setAttendeeEmails(
          [...d.attendeeEmails, ...(d.optionalAttendeeEmails ?? [])].filter(
            (addr, i, all) => all.indexOf(addr) === i
          )
        )
        setTeamsMeeting(!!d.isOnlineMeeting && !ev.isAllDay)
        setDetailJoinUrl(
          preferTeamsJoinUrl({
            joinUrl: d.joinUrl,
            bodyHtml: d.bodyHtml
          })
        )
        setDetailLocation(d.location?.trim() || null)
        setDetailOrganizer(d.organizer?.trim() || null)
        setDetailIsOrganizer(typeof d.isOrganizer === 'boolean' ? d.isOrganizer : null)
        setDetailEventType(d.eventType ?? null)
        setDetailSeriesMasterId(d.seriesMasterId?.trim() || null)
        setSelfPartStat(d.selfPartStat ?? null)
        setSelfResponseAtIso(d.selfResponseAtIso?.trim() || null)
        setDescErr(null)

        if (canLoadAttachments) {
          try {
            const attList = await window.mailClient.calendar.listEventAttachments({
              accountId: ev.accountId,
              graphEventId: eventId,
              graphCalendarId: ev.graphCalendarId ?? null
            })
            if (!cancelled) setAttachments(attList.filter((a) => !a.isInline))
          } catch (e) {
            console.warn('[calendar-preview] attachments:', e)
            if (!cancelled) setAttachments([])
          } finally {
            if (!cancelled) setAttachmentsLoading(false)
          }
        }
      })
      .catch((e) => {
        if (cancelled) return
        setDescHtml('')
        setDescIsWebinar(false)
        setDescChronellWebinarInvitation(false)
        setAttendeeEmails([])
        setTeamsMeeting(false)
        setDetailJoinUrl(null)
        setDetailLocation(null)
        setDetailOrganizer(null)
        setDetailIsOrganizer(null)
        setDetailEventType(null)
        setDetailSeriesMasterId(null)
        setSelfPartStat(null)
        setSelfResponseAtIso(null)
        setDescErr(e instanceof Error ? e.message : String(e))
        if (canLoadAttachments) setAttachmentsLoading(false)
      })
      .finally(() => {
        if (!cancelled) setDescLoading(false)
      })

    return (): void => {
      cancelled = true
    }
  }, [ev.accountId, ev.graphCalendarId, ev.graphEventId, ev.isAllDay, ev.source])

  useEffect(() => {
    setJoinUrlCopied(false)
  }, [meetingJoinUrl])

  useEffect(() => {
    if (!rsvpMenuOpen) return
    const onDoc = (e: MouseEvent): void => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (rsvpMenuRef.current?.contains(t)) return
      setRsvpMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setRsvpMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return (): void => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [rsvpMenuOpen])

  useEffect(() => {
    setRsvpMenuOpen(false)
  }, [ev.id, ev.graphEventId])

  const cancelInlineEdit = useCallback((): void => {
    setEditingField(null)
    setInlineError(null)
  }, [])

  const respondAsAttendee = useCallback(
    async (response: 'accept' | 'decline' | 'tentative'): Promise<void> => {
      if (rsvpBusy) return
      setErr(null)
      setRsvpBusy(response)
      try {
        const res = await respondToCalendarEventInvitation(ev, response, {
          t,
          detail: {
            subject: null,
            attendeeEmails,
            joinUrl: detailJoinUrl,
            isOnlineMeeting: teamsMeeting,
            bodyHtml: null,
            isOrganizer: detailIsOrganizer,
            eventType: detailEventType,
            seriesMasterId: detailSeriesMasterId
          }
        })
        if (res?.ok) {
          if (response === 'accept') setSelfPartStat('accepted')
          else if (response === 'tentative') setSelfPartStat('tentative')
          else if (response === 'decline') setSelfPartStat('declined')
          setSelfResponseAtIso(new Date().toISOString())
          onSaved?.()
          if (response === 'decline') {
            // Vorschau bleibt ggf. offen; Eltern laden die Liste neu.
          }
        }
      } finally {
        setRsvpBusy(null)
      }
    },
    [
      attendeeEmails,
      detailEventType,
      detailIsOrganizer,
      detailJoinUrl,
      detailSeriesMasterId,
      ev,
      onSaved,
      rsvpBusy,
      t,
      teamsMeeting
    ]
  )

  const openAttachment = useCallback(
    async (att: CalendarEventAttachmentMeta): Promise<void> => {
      const eventId = ev.graphEventId?.trim()
      if (!eventId) return
      setAttachmentBusyId(att.id)
      setErr(null)
      try {
        const res = await window.mailClient.calendar.openEventAttachment({
          accountId: ev.accountId,
          graphEventId: eventId,
          graphCalendarId: ev.graphCalendarId ?? null,
          attachmentId: att.id
        })
        if (!res.ok && res.error) setErr(res.error)
      } finally {
        setAttachmentBusyId(null)
      }
    },
    [ev.accountId, ev.graphCalendarId, ev.graphEventId]
  )

  const saveAttachmentAs = useCallback(
    async (att: CalendarEventAttachmentMeta): Promise<void> => {
      const eventId = ev.graphEventId?.trim()
      if (!eventId) return
      setAttachmentBusyId(att.id)
      setErr(null)
      try {
        const res = await window.mailClient.calendar.saveEventAttachmentAs({
          accountId: ev.accountId,
          graphEventId: eventId,
          graphCalendarId: ev.graphCalendarId ?? null,
          attachmentId: att.id,
          suggestedName: att.name
        })
        if (!res.ok && !res.cancelled && res.error) setErr(res.error)
      } finally {
        setAttachmentBusyId(null)
      }
    },
    [ev.accountId, ev.graphCalendarId, ev.graphEventId]
  )

  const applyLocalEventPatch = useCallback(
    (
      patch: Partial<Pick<CalendarEventView, 'title' | 'startIso' | 'endIso' | 'isAllDay' | 'icon'>>
    ): void => {
      const next: CalendarEventView = {
        ...ev,
        ...patch,
        title: patch.title ?? ev.title
      }
      onEventChange?.(next)
    },
    [ev, onEventChange]
  )

  const persistEventIcon = useCallback(
    async (iconId: string | undefined): Promise<void> => {
      const graphEventId = ev.graphEventId?.trim()
      if (!graphEventId || !canEdit) return
      const nextIcon = iconId?.trim() || null
      const prevIcon = ev.icon?.trim() || null
      if ((nextIcon ?? '') === (prevIcon ?? '')) return
      setInlineSaving(true)
      setInlineError(null)
      try {
        await window.mailClient.calendar.patchEventIcon({
          accountId: ev.accountId,
          graphEventId,
          iconId: nextIcon
        })
        applyLocalEventPatch({ icon: nextIcon })
        onSaved?.()
      } catch (e) {
        setInlineError(e instanceof Error ? e.message : String(e))
      } finally {
        setInlineSaving(false)
      }
    },
    [ev, canEdit, onSaved, applyLocalEventPatch]
  )

  const saveTitle = useCallback(async (): Promise<void> => {
    const graphEventId = ev.graphEventId?.trim()
    if (!graphEventId) return
    const subject = titleDraft.trim()
    if (!subject) {
      setInlineError(t('calendar.eventDialog.enterTitle'))
      return
    }
    if (subject === (ev.title?.trim() ?? '')) {
      cancelInlineEdit()
      return
    }
    setInlineSaving(true)
    setInlineError(null)
    try {
      await window.mailClient.calendar.updateEvent({
        accountId: ev.accountId,
        graphEventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        subject,
        startIso: ev.startIso,
        endIso: ev.endIso,
        isAllDay: ev.isAllDay,
        location: ev.location ?? null,
        bodyHtml: descHtml.trim()
          ? descIsWebinar
            ? prepareWebinarInvitationBodyForGraph(descHtml)
            : prepareCalendarEventDescriptionFromEditorHtml(
                descHtml,
                sanitizeComposeHtmlFragment
              )
          : null,
        categories: ev.categories ?? null
      })
      applyLocalEventPatch({ title: subject })
      cancelInlineEdit()
      onSaved?.()
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e))
    } finally {
      setInlineSaving(false)
    }
  }, [
    applyLocalEventPatch,
    cancelInlineEdit,
    descHtml,
    descIsWebinar,
    ev,
    onSaved,
    t,
    titleDraft
  ])

  const handleRepairWebinarLayout = useCallback(async (): Promise<void> => {
    const graphEventId = ev.graphEventId?.trim()
    if (!graphEventId || !canEdit || webinarRepairBusy) return
    setWebinarRepairBusy(true)
    setInlineError(null)
    try {
      const bundle = prepareWebinarRepairSaveBundle({
        title: ev.title?.trim() || t('calendar.eventDialog.untitled'),
        startIso: ev.startIso,
        endIso: ev.endIso,
        isAllDay: ev.isAllDay,
        locale: i18n.language,
        joinUrl: meetingJoinUrl
      })
      await window.mailClient.calendar.updateEvent({
        accountId: ev.accountId,
        graphEventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        subject: ev.title?.trim() || t('calendar.eventDialog.untitled'),
        startIso: ev.startIso,
        endIso: ev.endIso,
        isAllDay: ev.isAllDay,
        location: ev.location ?? null,
        bodyHtml: bundle.bodyHtml,
        categories: ev.categories ?? null,
        teamsMeeting: teamsMeeting && !ev.isAllDay,
        chronellWebinarInvitation: true,
        ...(bundle.inlineAttachments.length > 0 ? { attachments: bundle.inlineAttachments } : {})
      })
      const d = await window.mailClient.calendar.getEvent({
        accountId: ev.accountId,
        graphEventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        forceRefresh: true
      })
      const raw = d.bodyHtml?.trim() ? d.bodyHtml.trim() : ''
      const prepared = await prepareCalendarEventBodyHtmlForAttendeeDisplay(raw, {
        accountId: ev.accountId,
        graphEventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        resolveInlineImages: ev.source === 'microsoft'
      })
      setDescHtml(prepared)
      setDescChronellWebinarInvitation(!!d.chronellWebinarInvitation)
      onSaved?.()
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e))
    } finally {
      setWebinarRepairBusy(false)
    }
  }, [
    canEdit,
    ev,
    i18n.language,
    meetingJoinUrl,
    onSaved,
    t,
    teamsMeeting,
    webinarRepairBusy
  ])

  const saveSchedule = useCallback(async (): Promise<void> => {
    const graphEventId = ev.graphEventId?.trim()
    if (!graphEventId) return
    if (isAllDay && rangeEnd.getTime() <= rangeStart.getTime()) {
      setInlineError(t('calendar.eventDialog.endAfterStartExclusive'))
      return
    }
    if (!isAllDay && rangeEnd.getTime() <= rangeStart.getTime()) {
      setInlineError(t('calendar.eventDialog.endAfterStart'))
      return
    }
    const sched = fullCalendarEventToPatchSchedule({
      start: rangeStart,
      end: rangeEnd,
      allDay: isAllDay
    })
    if (!sched) {
      setInlineError(t('calendar.eventDialog.scheduleParseFailed'))
      return
    }
    if (
      sched.startIso === ev.startIso &&
      sched.endIso === ev.endIso &&
      sched.isAllDay === ev.isAllDay
    ) {
      cancelInlineEdit()
      return
    }
    setInlineSaving(true)
    setInlineError(null)
    try {
      const scheduleResolution = await resolveMeetingScheduleChange(ev, t)
      if (scheduleResolution.action === 'discard') {
        cancelInlineEdit()
        return
      }
      await window.mailClient.calendar.patchEventSchedule(
        patchScheduleInputWithMeetingNotify(
          {
            accountId: ev.accountId,
            graphEventId,
            graphCalendarId: ev.graphCalendarId ?? null,
            startIso: sched.startIso,
            endIso: sched.endIso,
            isAllDay: sched.isAllDay
          },
          scheduleResolution.notifyAttendees
        )
      )
      applyLocalEventPatch({
        startIso: sched.startIso,
        endIso: sched.endIso,
        isAllDay: sched.isAllDay
      })
      cancelInlineEdit()
      onSaved?.()
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e))
    } finally {
      setInlineSaving(false)
    }
  }, [
    applyLocalEventPatch,
    cancelInlineEdit,
    ev,
    isAllDay,
    onSaved,
    rangeEnd,
    rangeStart,
    t
  ])

  useEffect(() => {
    if (!editingField) return
    function onDocMouseDown(e: MouseEvent): void {
      const target = e.target as Node
      if (editingField === 'title' && titleInputRef.current?.contains(target)) return
      if (editingField === 'schedule' && scheduleEditorRef.current?.contains(target)) return
      if (editingField === 'title') void saveTitle()
      else void saveSchedule()
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      e.preventDefault()
      cancelInlineEdit()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown, true)
    return (): void => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [cancelInlineEdit, editingField, saveSchedule, saveTitle])

  const toggleAllDay = useCallback(
    (next: boolean): void => {
      if (next) {
        const s = startOfDay(rangeStart)
        let endExcl = startOfDay(rangeEnd)
        if (endExcl.getTime() <= s.getTime()) endExcl = addDays(s, 1)
        setRangeStart(s)
        setRangeEnd(endExcl)
      } else {
        const s = new Date(rangeStart)
        if (s.getHours() === 0 && s.getMinutes() === 0) s.setHours(9, 0, 0, 0)
        let e = new Date(rangeEnd)
        if (e.getTime() <= s.getTime()) e = new Date(s.getTime() + 30 * 60 * 1000)
        setRangeStart(s)
        setRangeEnd(e)
      }
      setIsAllDay(next)
    },
    [rangeEnd, rangeStart]
  )

  const timedStartYmd = useMemo(() => format(rangeStart, 'yyyy-MM-dd'), [rangeStart])
  const timedStartHm = useMemo(() => format(rangeStart, 'HH:mm'), [rangeStart])
  const timedEndYmd = useMemo(() => format(rangeEnd, 'yyyy-MM-dd'), [rangeEnd])
  const timedEndHm = useMemo(() => format(rangeEnd, 'HH:mm'), [rangeEnd])

  const clickableClass = canEdit
    ? 'cursor-pointer rounded-sm transition-colors hover:bg-secondary/60 hover:text-foreground'
    : ''

  const beginInlineEdit = useCallback(
    (field: PreviewEditField): void => {
      if (!canEdit || inlineSaving) return
      setEditingField(field)
    },
    [canEdit, inlineSaving]
  )

  const inlineEditHandlers = useCallback(
    (field: PreviewEditField) => {
      if (!canEdit) return {}
      if (inlineEditActivateOn === 'doubleClick') {
        return {
          title:
            field === 'title'
              ? t('calendar.eventPreview.editTitleDoubleClick')
              : t('calendar.eventPreview.editScheduleDoubleClick'),
          onDoubleClick: (e: { preventDefault: () => void; stopPropagation: () => void }): void => {
            e.preventDefault()
            e.stopPropagation()
            beginInlineEdit(field)
          }
        }
      }
      return {
        title:
          field === 'title'
            ? t('calendar.eventPreview.editTitle')
            : t('calendar.eventPreview.editScheduleTitle'),
        onClick: (): void => beginInlineEdit(field)
      }
    },
    [beginInlineEdit, canEdit, inlineEditActivateOn, t]
  )

  const entityContextBlock =
    ev.graphEventId?.trim() && !hideEntityContext && noteTarget ? (
      <EntityContextBlock
        anchor={{
          kind: 'calendar_event',
          accountId: ev.accountId,
          graphEventId: ev.graphEventId
        }}
        noteTarget={noteTarget}
        dense
        contentPaddingClass="px-4"
        sectionCollapsedDefault
        className="min-h-0"
      />
    ) : null

  const showLocationRow =
    Boolean(locationLabel) && !isRedundantOnlineLocation(locationLabel!, Boolean(meetingJoinUrl))
  /** Teams-Hinweis weglassen, wenn Join-URL bereits sichtbar ist. */
  const showTeamsMeetingRow = teamsMeeting && !meetingJoinUrl
  const showCategoriesRow = Boolean(ev.categories && ev.categories.length > 0)
  const showMeetingLinkRow = Boolean(meetingJoinUrl)
  const showCalendarRow = Boolean(calendarLabel || ev.accountEmail?.trim())
  const showOpenInCalendar = Boolean(ev.webLink?.trim())
  const hasInfoExtra =
    showCalendarRow ||
    showOpenInCalendar ||
    showLocationRow ||
    showCategoriesRow ||
    showTeamsMeetingRow

  const hasInfoContent =
    showCalendarRow ||
    Boolean(organizerLabel) ||
    attendeeEmails.length > 0 ||
    attachments.length > 0 ||
    attachmentsLoading ||
    showMeetingLinkRow ||
    hasInfoExtra

  const infoSummary = useMemo(() => {
    const parts: string[] = []
    if (meetingJoinUrl) parts.push(t('calendar.eventPreview.meetingLinkLabel'))
    if (organizerLabel) parts.push(organizerLabel)
    if (attendeeEmails.length > 0) {
      parts.push(
        t('calendar.eventPreview.infoAttendeesSummary', { count: attendeeEmails.length })
      )
    }
    if (attachments.length > 0) {
      parts.push(
        t('calendar.eventPreview.infoAttachmentsSummary', { count: attachments.length })
      )
    }
    return parts.length > 0 ? parts.join(' · ') : undefined
  }, [attachments.length, attendeeEmails.length, meetingJoinUrl, organizerLabel, t])

  const descPreviewHtml = useMemo(
    () => buildWebinarAttendeePreviewHtml('', descHtml),
    [descHtml]
  )
  const descLikelyGutted = useMemo(
    () =>
      descIsWebinar &&
      isWebinarInvitationHtmlLikelyGutted(descHtml, {
        chronellWebinarInvitation: descChronellWebinarInvitation
      }),
    [descChronellWebinarInvitation, descHtml, descIsWebinar]
  )

  const webinarRepairPreviewHtml = useMemo(() => {
    if (!descIsWebinar || !descLikelyGutted) return null
    return buildWebinarRepairPreviewHtml({
      title: ev.title?.trim() || t('calendar.eventDialog.untitled'),
      startIso: ev.startIso,
      endIso: ev.endIso,
      isAllDay: ev.isAllDay,
      locale: i18n.language,
      joinUrl: meetingJoinUrl,
      graphBodyHtml: descHtml
    })
  }, [
    descHtml,
    descIsWebinar,
    descLikelyGutted,
    ev.endIso,
    ev.isAllDay,
    ev.startIso,
    ev.title,
    i18n.language,
    meetingJoinUrl,
    t
  ])

  const descDisplayPreviewHtml =
    descLikelyGutted && webinarRepairPreviewHtml
      ? webinarRepairPreviewHtml
      : descPreviewHtml

  const descriptionSummary = useMemo(() => {
    if (descLoading) return t('calendar.eventDialog.loadingEventDetails')
    if (descErr) return t('calendar.eventPreview.descriptionUnavailable')
    const plain = descHtml
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!plain) return t('calendar.eventDialog.descriptionEmptyReadonly')
    return plain.length > 280 ? `${plain.slice(0, 277)}…` : plain
  }, [descErr, descHtml, descLoading, t])

  const attendeePreview = useMemo(() => {
    if (infoDetailsExpanded || attendeeEmails.length <= INFO_ATTENDEE_PREVIEW) {
      return { shown: attendeeEmails, hidden: 0 }
    }
    return {
      shown: attendeeEmails.slice(0, INFO_ATTENDEE_PREVIEW),
      hidden: attendeeEmails.length - INFO_ATTENDEE_PREVIEW
    }
  }, [attendeeEmails, infoDetailsExpanded])

  const copyMeetingLink = useCallback((): void => {
    if (!meetingJoinUrl) return
    setErr(null)
    void navigator.clipboard
      .writeText(meetingJoinUrl)
      .then(() => {
        setJoinUrlCopied(true)
        window.setTimeout(() => setJoinUrlCopied(false), 1600)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [meetingJoinUrl])

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-background',
        className
      )}
    >
      {/* Sticky Titel-Block */}
      <div
        className={cn(
          'z-20 shrink-0 space-y-2.5 border-b bg-background/95 px-4 py-3 backdrop-blur-sm',
          previewSectionDividerClass
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start gap-2">
              {canEdit ? (
                <CalendarEventIconPicker
                  layout="compact"
                  iconId={ev.icon}
                  title={ev.title}
                  disabled={inlineSaving}
                  onIconChange={(id): void => void persistEventIcon(id)}
                />
              ) : calendarEventIconIsExplicit(ev.icon) ? (
                ((): JSX.Element => {
                  const Icon = resolveCalendarEventIcon(ev.icon)
                  return (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-secondary/20 text-muted-foreground">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                  )
                })()
              ) : null}
              {editingField === 'title' ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={titleDraft}
                  disabled={inlineSaving}
                  onChange={(e): void => setTitleDraft(e.target.value)}
                  onKeyDown={(e): void => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void saveTitle()
                    }
                  }}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-[17px] font-semibold leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              ) : (
                <h2
                  role={canEdit ? 'button' : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  title={inlineEditHandlers('title').title}
                  onClick={inlineEditHandlers('title').onClick}
                  onDoubleClick={inlineEditHandlers('title').onDoubleClick}
                  onKeyDown={(e): void => {
                    if (!canEdit) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      beginInlineEdit('title')
                    }
                  }}
                  className={cn(
                    'min-w-0 flex-1 text-[17px] font-semibold leading-snug text-foreground',
                    clickableClass,
                    canEdit && '-mx-1 px-1'
                  )}
                >
                  {ev.title || t('calendar.eventPreview.noTitle')}
                </h2>
              )}
            </div>
            {editingField === 'schedule' ? (
              <div
                ref={scheduleEditorRef}
                className="space-y-2 rounded-lg border border-border/70 bg-secondary/20 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('calendar.quickCreate.whenLabel')}
                  </span>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border"
                      checked={isAllDay}
                      disabled={inlineSaving}
                      onChange={(e): void => toggleAllDay(e.target.checked)}
                    />
                    <span className={cn(isAllDay ? 'text-foreground' : 'text-muted-foreground')}>
                      {t('calendar.eventDialog.allDay')}
                    </span>
                  </label>
                </div>
                {isAllDay ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-0.5">
                      <span className="text-2xs text-muted-foreground">
                        {t('calendar.eventDialog.labelBegin')}
                      </span>
                      <ChronellDateField
                        disabled={inlineSaving}
                        value={format(rangeStart, 'yyyy-MM-dd')}
                        onChange={(v): void => {
                          if (!v) return
                          const nextStart = startOfDay(parseISO(v))
                          setRangeStart(nextStart)
                          if (rangeEnd.getTime() <= nextStart.getTime()) {
                            setRangeEnd(addDays(nextStart, 1))
                          }
                        }}
                        className="tabular-nums"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <span className="text-2xs text-muted-foreground">
                        {t('calendar.eventDialog.labelEnd')}
                      </span>
                      <ChronellDateField
                        disabled={inlineSaving}
                        value={format(addDays(rangeEnd, -1), 'yyyy-MM-dd')}
                        onChange={(v): void => {
                          if (!v) return
                          const lastDay = startOfDay(parseISO(v))
                          const nextEnd = addDays(lastDay, 1)
                          setRangeEnd(nextEnd)
                          if (nextEnd.getTime() <= rangeStart.getTime()) {
                            setRangeStart(lastDay)
                          }
                        }}
                        className="tabular-nums"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block space-y-0.5">
                      <span className="text-2xs text-muted-foreground">
                        {t('calendar.eventDialog.labelBegin')}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <ChronellDateField
                          disabled={inlineSaving}
                          value={timedStartYmd}
                          onChange={(v): void => {
                            if (!v) return
                            const nextStart = mergeYmdIntoDate(rangeStart, v)
                            setRangeStart(nextStart)
                            if (rangeEnd.getTime() <= nextStart.getTime()) {
                              setRangeEnd(addMinutesToDate(nextStart, 30))
                            }
                          }}
                          className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                        />
                        <ChronellTimeField
                          disabled={inlineSaving}
                          value={timedStartHm}
                          aria-label={t('calendar.eventDialog.editStartTimeAria')}
                          className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                          onChange={(hm): void => {
                            const nextStart = mergeHmIntoDate(rangeStart, hm)
                            setRangeStart(nextStart)
                            if (rangeEnd.getTime() <= nextStart.getTime()) {
                              setRangeEnd(addMinutesToDate(nextStart, 30))
                            }
                          }}
                        />
                      </div>
                    </label>
                    <label className="block space-y-0.5">
                      <span className="text-2xs text-muted-foreground">
                        {t('calendar.eventDialog.labelEnd')}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <ChronellDateField
                          disabled={inlineSaving}
                          value={timedEndYmd}
                          min={timedStartYmd}
                          onChange={(v): void => {
                            if (!v) return
                            const nextEnd = mergeYmdIntoDate(rangeEnd, v)
                            if (nextEnd.getTime() <= rangeStart.getTime()) {
                              setRangeEnd(addMinutesToDate(rangeStart, 30))
                            } else {
                              setRangeEnd(nextEnd)
                            }
                          }}
                          className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                        />
                        <ChronellTimeField
                          disabled={inlineSaving}
                          value={timedEndHm}
                          aria-label={t('calendar.eventDialog.editEndTimeAria')}
                          className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                          onChange={(hm): void => {
                            setRangeEnd(
                              mergeHmIntoEndAfterStart(rangeStart, rangeEnd, hm, 30)
                            )
                          }}
                        />
                      </div>
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-stretch gap-2">
                <div
                  role={canEdit ? 'button' : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  title={inlineEditHandlers('schedule').title}
                  onClick={inlineEditHandlers('schedule').onClick}
                  onDoubleClick={inlineEditHandlers('schedule').onDoubleClick}
                  onKeyDown={(e): void => {
                    if (!canEdit) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      beginInlineEdit('schedule')
                    }
                  }}
                  className={cn(
                    'inline-flex max-w-full items-center gap-2 rounded-md border border-border/80 bg-secondary/40 px-2.5 py-1.5 text-sm leading-snug text-foreground',
                    canEdit && 'cursor-pointer hover:bg-secondary/70'
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">{rangeLabel}</span>
                </div>
                {durationLabel ? (
                  <div className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-secondary/40 px-2.5 py-1.5 text-sm leading-snug text-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span>{durationLabel}</span>
                  </div>
                ) : null}
              </div>
            )}
            {inlineError ? <p className="text-xs text-destructive">{inlineError}</p> : null}
            {inlineSaving ? (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('calendar.eventPreview.saving')}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <button
              type="button"
              disabled={!canEdit}
              title={canEdit ? t('calendar.eventPreview.editTitle') : t('calendar.eventPreview.readOnlyTitle')}
              onClick={onEdit}
              className={cn(
                'flex h-6 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-2xs font-medium transition-colors',
                'text-foreground hover:bg-secondary',
                !canEdit && 'cursor-not-allowed opacity-45'
              )}
            >
              <Pencil className="h-3 w-3" />
              {t('calendar.eventPreview.editButton')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {meetingJoinUrl ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              onClick={(): void => {
                setErr(null)
                void openExternalUrl(meetingJoinUrl).catch((e) =>
                  setErr(e instanceof Error ? e.message : String(e))
                )
              }}
            >
              <Video className="h-3.5 w-3.5" />
              {t('calendar.eventPreview.joinTeams')}
            </button>
          ) : null}
          {meetingJoinUrl ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              onClick={copyMeetingLink}
            >
              {joinUrlCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {joinUrlCopied
                ? t('calendar.eventPreview.meetingLinkCopied')
                : t('calendar.eventPreview.copyMeetingLinkShort')}
            </button>
          ) : null}
          {canRespondAsAttendee || selfResponseLabel ? (
            <div className="relative" ref={rsvpMenuRef}>
              <button
                type="button"
                disabled={rsvpBusy != null}
                title={selfResponseLabel ?? t('calendar.eventRsvp.respondMenu')}
                aria-haspopup="menu"
                aria-expanded={rsvpMenuOpen}
                className={cn(
                  'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50',
                  selfResponseToneClass,
                  canRespondAsAttendee && 'hover:opacity-90'
                )}
                onClick={(): void => {
                  if (!canRespondAsAttendee || rsvpBusy) return
                  setRsvpMenuOpen((o) => !o)
                }}
              >
                {rsvpBusy ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : selfPartStat === 'accepted' ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : selfPartStat === 'tentative' ? (
                  <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                ) : selfPartStat === 'declined' ? (
                  <X className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Check className="h-3.5 w-3.5 shrink-0 opacity-70" />
                )}
                <span className="truncate">
                  {selfResponseLabel ?? t('calendar.eventRsvp.respondMenu')}
                </span>
                {canRespondAsAttendee ? (
                  <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-70', rsvpMenuOpen && 'rotate-180')} />
                ) : null}
              </button>
              {rsvpMenuOpen && canRespondAsAttendee ? (
                <div
                  role="menu"
                  className="chronell-acrylic-popover absolute left-0 top-full z-[280] mt-1 min-w-[11.5rem] overflow-hidden rounded-md py-1 text-popover-foreground shadow-lg"
                >
                  {(
                    [
                      { id: 'accept' as const, label: t('calendar.eventRsvp.accept'), Icon: Check },
                      {
                        id: 'tentative' as const,
                        label: t('calendar.eventRsvp.tentative'),
                        Icon: HelpCircle
                      },
                      { id: 'decline' as const, label: t('calendar.eventRsvp.decline'), Icon: X }
                    ] as const
                  ).map((opt) => {
                    const selected =
                      (opt.id === 'accept' && selfPartStat === 'accepted') ||
                      (opt.id === 'tentative' && selfPartStat === 'tentative') ||
                      (opt.id === 'decline' && selfPartStat === 'declined')
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="menuitem"
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent',
                          opt.id === 'accept' && selected && 'text-emerald-700 dark:text-emerald-300',
                          opt.id === 'tentative' && selected && 'text-amber-800 dark:text-amber-200',
                          opt.id === 'decline' && 'text-destructive',
                          selected && 'bg-accent/60 font-medium'
                        )}
                        onClick={(): void => {
                          setRsvpMenuOpen(false)
                          void respondAsAttendee(opt.id)
                        }}
                      >
                        <opt.Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">{opt.label}</span>
                        {selected ? <Check className="h-3.5 w-3.5 shrink-0 opacity-80" /> : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {rsvpBusy ? (
          <p className="text-xs text-muted-foreground">{t('calendar.eventRsvp.responding')}</p>
        ) : null}
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {hasInfoContent ? (
          <PreviewFoldSection
            icon={Info}
            title={t('calendar.eventPreview.infoSection')}
            expanded={infoExpanded}
            onToggle={(): void => setInfoExpanded((v) => !v)}
            summary={infoSummary}
            className="border-t-0"
            contentClassName="divide-y divide-white/[0.04] pt-0.5"
          >
            {showMeetingLinkRow && meetingJoinUrl ? (
              <PreviewDetailRow icon={Link2} label={t('calendar.eventPreview.meetingLinkLabel')}>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-2 text-2xs font-medium text-secondary-foreground hover:bg-secondary/70"
                    onClick={copyMeetingLink}
                  >
                    {joinUrlCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {joinUrlCopied
                      ? t('calendar.eventPreview.meetingLinkCopied')
                      : t('calendar.eventPreview.copyMeetingLinkShort')}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 text-2xs font-medium text-foreground hover:bg-secondary/40"
                    onClick={(): void => {
                      setErr(null)
                      void openExternalUrl(meetingJoinUrl).catch((e) =>
                        setErr(e instanceof Error ? e.message : String(e))
                      )
                    }}
                  >
                    <Video className="h-3 w-3" />
                    {t('calendar.eventPreview.openMeetingLink')}
                  </button>
                </div>
              </PreviewDetailRow>
            ) : null}
            {organizerLabel ? (
              <PreviewDetailRow icon={User} label={t('calendar.eventPreview.organizerLabel')}>
                <span className="block min-w-0 break-all">{organizerLabel}</span>
              </PreviewDetailRow>
            ) : null}
            {attendeeEmails.length > 0 ? (
              <PreviewDetailRow
                icon={Users}
                label={`${t('calendar.eventPreview.attendeesLabel')} (${attendeeEmails.length})`}
              >
                <div className="flex flex-wrap gap-1.5">
                  {attendeePreview.shown.map((addr) => (
                    <span
                      key={addr}
                      className="inline-flex max-w-full truncate rounded-md border border-border/50 bg-secondary/30 px-1.5 py-0.5 text-2xs text-foreground"
                      title={addr}
                    >
                      {addr}
                    </span>
                  ))}
                  {attendeePreview.hidden > 0 ? (
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border border-dashed border-border/60 px-1.5 py-0.5 text-2xs font-medium text-primary hover:bg-secondary/40"
                      onClick={(): void => setInfoDetailsExpanded(true)}
                    >
                      {t('calendar.eventPreview.infoAttendeesMore', {
                        count: attendeePreview.hidden
                      })}
                    </button>
                  ) : null}
                </div>
              </PreviewDetailRow>
            ) : null}
            {attachmentsLoading ? (
              <PreviewDetailRow icon={Paperclip} label={t('calendar.eventDialog.attachments')}>
                <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('calendar.eventDialog.attachmentsLoading')}
                </p>
              </PreviewDetailRow>
            ) : attachments.length > 0 ? (
              <PreviewDetailRow icon={Paperclip} label={t('calendar.eventDialog.attachments')}>
                <ul className="space-y-1.5">
                  {attachments.map((att) => (
                    <li key={att.id}>
                      <CalendarEventAttachmentRow
                        att={att}
                        disabled={attachmentBusyId === att.id}
                        onOpen={(): void => void openAttachment(att)}
                        onSaveAs={(): void => void saveAttachmentAs(att)}
                      />
                    </li>
                  ))}
                </ul>
              </PreviewDetailRow>
            ) : null}

            {infoDetailsExpanded ? (
              <>
                {showCalendarRow ? (
                  <PreviewDetailRow icon={CalendarDays} label={t('calendar.eventPreview.calendarLabel')}>
                    <span className="block min-w-0 break-words">
                      {calendarLabel || t('calendar.eventPreview.calendarFallback')}
                      {ev.accountEmail?.trim() &&
                      ev.accountEmail.trim().toLowerCase() !==
                        (calendarLabel || t('calendar.eventPreview.calendarFallback')).toLowerCase() ? (
                        <span className="text-muted-foreground"> ({ev.accountEmail.trim()})</span>
                      ) : null}
                    </span>
                    {showOpenInCalendar ? (
                      <button
                        type="button"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        onClick={(): void => {
                          setErr(null)
                          void openExternalUrl(ev.webLink!.trim()).catch((e) =>
                            setErr(e instanceof Error ? e.message : String(e))
                          )
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        {t('calendar.eventPreview.openInCalendar')}
                      </button>
                    ) : null}
                  </PreviewDetailRow>
                ) : showOpenInCalendar ? (
                  <PreviewDetailRow icon={ExternalLink} label={t('calendar.eventPreview.openInCalendar')}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      onClick={(): void => {
                        setErr(null)
                        void openExternalUrl(ev.webLink!.trim()).catch((e) =>
                          setErr(e instanceof Error ? e.message : String(e))
                        )
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('calendar.eventPreview.openInCalendar')}
                    </button>
                  </PreviewDetailRow>
                ) : null}
                {showLocationRow && locationLabel ? (
                  <PreviewDetailRow icon={MapPin} label={t('calendar.eventDialog.locationRowLabel')}>
                    <span className="block min-w-0">{locationLabel}</span>
                    <button
                      type="button"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      onClick={(): void => {
                        setErr(null)
                        void openExternalUrl(locationMapsUrl(locationLabel)).catch((e) =>
                          setErr(e instanceof Error ? e.message : String(e))
                        )
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('calendar.eventPreview.openInMaps')}
                    </button>
                  </PreviewDetailRow>
                ) : null}
                {showTeamsMeetingRow ? (
                  <PreviewDetailRow icon={Video} label={t('calendar.eventPreview.meetingLabel')}>
                    <span>{t('calendar.eventPreview.teamsMeetingScheduled')}</span>
                  </PreviewDetailRow>
                ) : null}
                {showCategoriesRow && ev.categories ? (
                  <PreviewDetailRow icon={Tag} label={t('calendar.eventPreview.categories')}>
                    <div className="flex flex-wrap gap-1.5">
                      {ev.categories.map((c) => (
                        <span
                          key={c}
                          className="inline-flex max-w-full truncate rounded-md border border-border/50 bg-secondary/30 px-1.5 py-0.5 text-2xs text-foreground"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </PreviewDetailRow>
                ) : null}
              </>
            ) : null}

            {hasInfoExtra ? (
              <div className="pt-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-0.5 py-1 text-2xs font-medium text-primary hover:underline"
                  aria-expanded={infoDetailsExpanded}
                  onClick={(): void => setInfoDetailsExpanded((v) => !v)}
                >
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      infoDetailsExpanded ? 'rotate-180' : 'rotate-0'
                    )}
                    aria-hidden
                  />
                  {infoDetailsExpanded
                    ? t('calendar.eventPreview.infoShowLess')
                    : t('calendar.eventPreview.infoShowMore')}
                </button>
              </div>
            ) : null}
          </PreviewFoldSection>
        ) : descLoading && ev.graphEventId?.trim() ? (
          <p className="inline-flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('calendar.eventDialog.loadingEventDetails')}
          </p>
        ) : null}

        {ev.accountId.startsWith('ms:') || meetingAiAssistAvailable ? (
          <CopilotAssistPanel
            accountId={ev.accountId}
            contextKey={`cal:${ev.accountId}:${ev.graphEventId ?? ev.id}`}
            contextTexts={meetingPrepContext}
            primaryPrompt={meetingEnded ? meetingReviewPrompt : meetingPreparePrompt}
            primaryActionLabel={t(
              meetingEnded ? 'copilot.meeting.review' : 'copilot.meeting.prepare'
            )}
            title={t(meetingEnded ? 'copilot.meeting.reviewTitle' : 'copilot.meeting.title')}
            retrievalQuery={ev.title?.trim() || null}
            collapsedDefault
            noteTarget={noteTarget}
          />
        ) : null}

        {meetingJoinUrl && ev.accountId.startsWith('ms:') ? (
          <CalendarMeetingInsightsPanel
            accountId={ev.accountId}
            joinUrl={meetingJoinUrl}
            result={meetingInsights}
            loading={meetingInsightsLoading}
          />
        ) : null}

        {ev.graphEventId?.trim() ? (
          <PreviewFoldSection
            icon={AlignLeft}
            title={t('calendar.eventDialog.description')}
            expanded={descExpanded}
            onToggle={(): void => setDescExpanded((v) => !v)}
            summary={descriptionSummary}
            summaryLines={3}
          >
            {ev.source === 'google' && !ev.graphCalendarId?.trim() ? (
              <p className="text-xs text-muted-foreground">
                {t('calendar.eventDialog.googleCalendarIdMissing')}
              </p>
            ) : descLoading ? (
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('calendar.eventDialog.loadingEventDetails')}
              </p>
            ) : descErr ? (
              <p className="text-xs text-destructive" role="alert">
                {descErr}
              </p>
            ) : descIsWebinar ? (
              <div className="space-y-2">
                {descLikelyGutted ? (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    <p>{t('calendar.eventPreview.webinarPreviewRepairHint')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {canEdit ? (
                        <button
                          type="button"
                          disabled={webinarRepairBusy}
                          onClick={(): void => {
                            void handleRepairWebinarLayout()
                          }}
                          className="rounded-md border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-50 hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          {webinarRepairBusy
                            ? t('calendar.eventPreview.saving')
                            : t('calendar.eventPreview.webinarRepairSave')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={onEdit}
                        className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
                      >
                        {t('calendar.eventPreview.editButton')}
                      </button>
                    </div>
                  </div>
                ) : null}
                {descDisplayPreviewHtml ? (
                  <WebinarInvitationPreview html={descDisplayPreviewHtml} className="w-full" />
                ) : null}
              </div>
            ) : (
              <CalendarEventDescriptionPreview
                html={descHtml}
                viewerTheme={viewerTheme}
                className="w-full"
              />
            )}
          </PreviewFoldSection>
        ) : null}

        {ev.graphEventId?.trim() && hideEntityContext ? (
          <EntityContextBlock
            anchor={{
              kind: 'calendar_event',
              accountId: ev.accountId,
              graphEventId: ev.graphEventId
            }}
            noteTarget={noteTarget}
            contentPaddingClass="px-4"
            sectionCollapsedDefault
            className="min-h-0"
          />
        ) : null}

        {entityContextBlock}
      </div>
    </div>
  )
}