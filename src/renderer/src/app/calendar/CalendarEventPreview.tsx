import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_DEFAULT,
  CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_KEY,
  CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN,
  calendarPreviewNotePaneHeightMax
} from '@/app/calendar/calendar-preview-storage'
import {
  HorizontalSplitter,
  useResizableHeight
} from '@/components/ResizableSplitter'
import { addDays, differenceInMinutes, format, parseISO, startOfDay } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  CalendarDays,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Tag,
  User,
  Users,
  Video
} from 'lucide-react'
import type { CalendarEventView } from '@shared/types'
import { fullCalendarEventToPatchSchedule } from '@/app/calendar/calendar-shell-view-helpers'
import {
  patchScheduleInputWithMeetingNotify,
  resolveMeetingScheduleChange
} from '@/app/calendar/calendar-meeting-schedule-change'
import { openExternalUrl } from '@/lib/open-external'
import { ChronellDateField } from '@/components/ChronellDateField'
import {
  previewDetailPanelClass,
  previewSectionDividerClass
} from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import { CalendarEventDescriptionPreview } from '@/app/calendar/CalendarEventDescriptionPreview'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { calendarEventIconIsExplicit, resolveCalendarEventIcon } from '@/lib/calendar-event-icons'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
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

function PreviewDetailRow(props: {
  icon: typeof MapPin
  label: string
  children: ReactNode
}): JSX.Element {
  const Icon = props.icon
  return (
    <div className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
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
  const viewerTheme = useThemeStore((s) => s.effective)
  const [err, setErr] = useState<string | null>(null)
  const [descHtml, setDescHtml] = useState('')
  const [descLoading, setDescLoading] = useState(false)
  const [descErr, setDescErr] = useState<string | null>(null)
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([])
  const [teamsMeeting, setTeamsMeeting] = useState(false)
  const [detailLocation, setDetailLocation] = useState<string | null>(null)
  const [detailOrganizer, setDetailOrganizer] = useState<string | null>(null)

  const [editingField, setEditingField] = useState<PreviewEditField | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [isAllDay, setIsAllDay] = useState(ev.isAllDay)
  const [rangeStart, setRangeStart] = useState(() => new Date())
  const [rangeEnd, setRangeEnd] = useState(() => new Date())
  const [inlineSaving, setInlineSaving] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const scheduleEditorRef = useRef<HTMLDivElement>(null)

  const dfLocale: Locale = i18n.language.startsWith('de') ? deFns : enUSFns
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
  const showResizableNotePane = Boolean(ev.graphEventId?.trim()) && !hideEntityContext
  const notePaneHeightMax = calendarPreviewNotePaneHeightMax()
  const [notePaneHeight, setNotePaneHeight] = useResizableHeight({
    storageKey: CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_KEY,
    defaultHeight: CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_DEFAULT,
    minHeight: CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN,
    maxHeight: notePaneHeightMax
  })

  useEffect(() => {
    if (!showResizableNotePane) return
    const clamp = (): void => {
      const max = calendarPreviewNotePaneHeightMax()
      setNotePaneHeight((h) =>
        Math.min(max, Math.max(CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN, h))
      )
    }
    window.addEventListener('resize', clamp)
    return (): void => window.removeEventListener('resize', clamp)
  }, [showResizableNotePane, setNotePaneHeight])

  useEffect(() => {
    setEditingField(null)
    setInlineError(null)
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
      setDescLoading(false)
      setDescErr(null)
      setAttendeeEmails([])
      setTeamsMeeting(false)
      setDetailLocation(null)
      setDetailOrganizer(null)
      return
    }
    if (ev.source === 'google' && !ev.graphCalendarId?.trim()) {
      setDescHtml('')
      setDescLoading(false)
      setDescErr(null)
      setAttendeeEmails([])
      setTeamsMeeting(false)
      setDetailLocation(null)
      setDetailOrganizer(null)
      return
    }
    let cancelled = false
    setDescLoading(true)
    setDescErr(null)
    void window.mailClient.calendar
      .getEvent({
        accountId: ev.accountId,
        graphEventId: eventId,
        graphCalendarId: ev.graphCalendarId ?? null,
        forceRefresh: true
      })
      .then((d) => {
        if (cancelled) return
        const raw = d.bodyHtml?.trim() ? d.bodyHtml.trim() : ''
        setDescHtml(raw ? sanitizeComposeHtmlFragment(raw) : '')
        setAttendeeEmails(d.attendeeEmails)
        setTeamsMeeting(!!d.isOnlineMeeting && !ev.isAllDay)
        setDetailLocation(d.location?.trim() || null)
        setDetailOrganizer(d.organizer?.trim() || null)
        setDescErr(null)
      })
      .catch((e) => {
        if (cancelled) return
        setDescHtml('')
        setAttendeeEmails([])
        setTeamsMeeting(false)
        setDetailLocation(null)
        setDetailOrganizer(null)
        setDescErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setDescLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [ev.accountId, ev.graphCalendarId, ev.graphEventId, ev.isAllDay, ev.source])

  const cancelInlineEdit = useCallback((): void => {
    setEditingField(null)
    setInlineError(null)
  }, [])

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
        bodyHtml: descHtml || null,
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
    ev,
    onSaved,
    t,
    titleDraft
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
    showResizableNotePane && noteTarget ? (
      <EntityContextBlock
        anchor={{
          kind: 'calendar_event',
          accountId: ev.accountId,
          graphEventId: ev.graphEventId!
        }}
        noteTarget={noteTarget}
        noteEditorFillHeight
        contentPaddingClass="px-4"
        sectionCollapsedDefault
        className={cn('min-h-0 flex-1', previewSectionDividerClass)}
      />
    ) : null

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col bg-background',
        showResizableNotePane ? 'overflow-hidden' : 'overflow-y-auto',
        className
      )}
    >
      <div className={cn(showResizableNotePane && 'min-h-0 flex-1 overflow-y-auto')}>
      <div
        className={cn(
          'shrink-0 space-y-2 border-b px-4 py-3',
          previewSectionDividerClass
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ev.source === 'google'
                ? t('calendar.eventPreview.sourceGoogle')
                : t('calendar.eventPreview.sourceMicrosoft')}
            </p>
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
                      <input
                        type="datetime-local"
                        disabled={inlineSaving}
                        value={format(rangeStart, "yyyy-MM-dd'T'HH:mm")}
                        onChange={(e): void => {
                          const v = e.target.value
                          if (!v) return
                          const d = new Date(v)
                          if (Number.isNaN(d.getTime())) return
                          setRangeStart(d)
                          if (rangeEnd.getTime() <= d.getTime()) {
                            setRangeEnd(new Date(d.getTime() + 30 * 60 * 1000))
                          }
                        }}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
                      />
                    </label>
                    <label className="block space-y-0.5">
                      <span className="text-2xs text-muted-foreground">
                        {t('calendar.eventDialog.labelEnd')}
                      </span>
                      <input
                        type="datetime-local"
                        disabled={inlineSaving}
                        value={format(rangeEnd, "yyyy-MM-dd'T'HH:mm")}
                        onChange={(e): void => {
                          const v = e.target.value
                          if (!v) return
                          const d = new Date(v)
                          if (Number.isNaN(d.getTime())) return
                          setRangeEnd(d)
                          if (d.getTime() <= rangeStart.getTime()) {
                            setRangeStart(new Date(d.getTime() - 30 * 60 * 1000))
                          }
                        }}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
                      />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <p
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
                className={cn('text-sm text-muted-foreground', clickableClass, canEdit && '-mx-1 px-1')}
              >
                {rangeLabel}
              </p>
            )}
            {durationLabel ? (
              <p className="text-xs text-muted-foreground">{durationLabel}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">{ev.accountEmail}</p>
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

        <div className="flex flex-wrap gap-2">
          {ev.joinUrl?.trim() ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              onClick={(): void => {
                setErr(null)
                void openExternalUrl(ev.joinUrl!.trim()).catch((e) =>
                  setErr(e instanceof Error ? e.message : String(e))
                )
              }}
            >
              <Video className="h-3.5 w-3.5" />
              {t('calendar.eventPreview.joinTeams')}
            </button>
          ) : null}
          {ev.webLink?.trim() ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              onClick={(): void => {
                setErr(null)
                void openExternalUrl(ev.webLink!.trim()).catch((e) =>
                  setErr(e instanceof Error ? e.message : String(e))
                )
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('calendar.eventPreview.openInCalendar')}
            </button>
          ) : null}
        </div>
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
      </div>

      <div className="px-4 py-3 text-sm">
        {calendarLabel ||
        locationLabel ||
        organizerLabel ||
        attendeeEmails.length > 0 ||
        (ev.categories && ev.categories.length > 0) ||
        teamsMeeting ? (
          <div className={cn('mb-3 px-3', previewDetailPanelClass)}>
            {calendarLabel ? (
              <PreviewDetailRow icon={CalendarDays} label={t('calendar.eventPreview.calendarLabel')}>
                {calendarLabel}
              </PreviewDetailRow>
            ) : null}
            {locationLabel ? (
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
            {organizerLabel ? (
              <PreviewDetailRow icon={User} label={t('calendar.eventPreview.organizerLabel')}>
                {organizerLabel}
              </PreviewDetailRow>
            ) : null}
            {attendeeEmails.length > 0 ? (
              <PreviewDetailRow icon={Users} label={t('calendar.eventPreview.attendeesLabel')}>
                <ul className="space-y-1">
                  {attendeeEmails.map((email) => (
                    <li key={email} className="truncate">
                      {email}
                    </li>
                  ))}
                </ul>
              </PreviewDetailRow>
            ) : null}
            {teamsMeeting && !ev.joinUrl?.trim() ? (
              <PreviewDetailRow icon={Video} label={t('calendar.eventPreview.meetingLabel')}>
                {t('calendar.eventPreview.teamsMeetingScheduled')}
              </PreviewDetailRow>
            ) : null}
            {ev.categories && ev.categories.length > 0 ? (
              <PreviewDetailRow icon={Tag} label={t('calendar.eventPreview.categories')}>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {ev.categories.map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-white/[0.06] bg-secondary/[0.06] px-2 py-0.5 text-xs text-foreground dark:border-white/[0.06]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </PreviewDetailRow>
            ) : null}
          </div>
        ) : descLoading && ev.graphEventId?.trim() ? (
          <p className="mb-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('calendar.eventDialog.loadingEventDetails')}
          </p>
        ) : null}

        {ev.graphEventId?.trim() ? (
          <div className={cn('min-h-0 border-t pt-3', previewSectionDividerClass)}>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('calendar.eventDialog.description')}
            </p>
            {ev.source === 'google' && !ev.graphCalendarId?.trim() ? (
              <p className="text-xs text-muted-foreground">{t('calendar.eventDialog.googleCalendarIdMissing')}</p>
            ) : descLoading ? (
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('calendar.eventDialog.loadingEventDetails')}
              </p>
            ) : descErr ? (
              <p className="text-xs text-destructive" role="alert">
                {descErr}
              </p>
            ) : (
              <CalendarEventDescriptionPreview
                html={descHtml}
                viewerTheme={viewerTheme}
                className="w-full"
              />
            )}
          </div>
        ) : null}

        {ev.graphEventId?.trim() && hideEntityContext ? (
          <EntityContextBlock
            anchor={{
              kind: 'calendar_event',
              accountId: ev.accountId,
              graphEventId: ev.graphEventId
            }}
            noteTarget={noteTarget}
            contentPaddingClass="px-0"
            sectionCollapsedDefault
            className={cn('mt-3 border-t', previewSectionDividerClass)}
          />
        ) : null}
      </div>
      </div>

      {showResizableNotePane ? (
        <>
          <HorizontalSplitter
            variant="subtle"
            ariaLabel={t('calendar.eventPreview.contextSplitterAria')}
            onDrag={(deltaY): void => {
              setNotePaneHeight((h) => {
                const max = calendarPreviewNotePaneHeightMax()
                return Math.min(
                  max,
                  Math.max(CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN, h - deltaY)
                )
              })
            }}
          />
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-border/40 bg-secondary/[0.02]"
            style={{ height: Math.min(notePaneHeight, notePaneHeightMax) }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{entityContextBlock}</div>
          </div>
        </>
      ) : null}
    </div>
  )
}