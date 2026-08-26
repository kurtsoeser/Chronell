import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType
} from 'react'
import {
  addDays,
  addHours,
  addMonths,
  format,
  parseISO
} from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  AlignLeft,
  Bell,
  Calendar as CalendarIcon,
  CheckSquare,
  ExternalLink,
  Globe,
  LayoutPanelLeft,
  LayoutTemplate,
  Loader2,
  MapPin,
  Repeat2,
  Send,
  SquareArrowOutUpRight,
  UserPlus,
  Video,
  X
} from 'lucide-react'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type {
  CalendarEventView,
  CalendarGraphCalendarRow,
  CalendarRecurrenceFrequency,
  CalendarRecurrenceRangeEndMode,
  CalendarSaveEventRecurrence,
  ComposeAttachment,
  ConnectedAccount,
  MailMasterCategory,
  TaskListRow
} from '@shared/types'
import { CALENDAR_TIMEZONE_UI_OPTIONS } from '@shared/microsoft-timezones'
import { dueIsoFromClientInput } from '@shared/calendar-datetime'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import { CalendarEventRecurrenceSection } from '@/app/calendar/CalendarEventRecurrenceSection'
import { CalendarEventDialogDayPicker } from '@/app/calendar/CalendarEventDialogDayPicker'
import { CalendarEventCategoryPopover } from '@/app/calendar/CalendarEventCategoryPopover'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { loadUseOsFloatingPanelsDefault } from '@/lib/floating-panels-prefs'
import { openCalendarEventDialogOsPopout } from '@/lib/open-calendar-event-popout'
import {
  CAL_EVENT_DIALOG_DEFAULT_DOCK_W,
  CAL_EVENT_DIALOG_DAY_COLUMN_WIDTH_KEY,
  CAL_EVENT_DIALOG_DEFAULT_DAY_COLUMN_W,
  CAL_EVENT_DIALOG_FLOAT_SIZE_KEY,
  persistCalendarEventDialogModalSize,
  persistCalendarEventDialogPlacement,
  readCalendarEventDialogModalSize,
  readCalendarEventDialogPlacement,
  type CalendarEventDialogPlacement
} from '@/app/calendar/calendar-event-dialog-storage'
import {
  buildTaskSaveRecurrence,
  defaultWeekdayFromDueYmd,
  validateTaskRecurrenceForm
} from '@/lib/task-recurrence-form'
import { isWritableCalendarTarget } from '@/app/calendar/calendar-create-destination'
import {
  scheduleFromCalendarCreateRange,
  type CalendarCreateRange
} from '@/app/tasks/tasks-calendar-create-range'
import {
  persistTasksCalendarCreateAccountId,
  readTasksCalendarCreateAccountId
} from '@/app/tasks/tasks-calendar-create-storage'
import {
  datetimeLocalValueToIso,
  isoToDatetimeLocalValue
} from '@/app/work-items/work-item-datetime'
import { cloudTaskAccountOptionLabel } from '@/lib/cloud-task-accounts'
import { CalendarEventAttachmentsPanel } from '@/app/calendar/CalendarEventAttachmentsPanel'
import { useCalendarEventAttachments } from '@/app/calendar/useCalendarEventAttachments'
import { cn } from '@/lib/utils'
import { useCollatorLocale } from '@/lib/date-fns-locale'
import {
  eventDialogPanelSelectClass,
  eventDialogSectionHeadingClass
} from '@/lib/chronell-ui-classes'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { openExternalUrl, voidOpenExternalUrl } from '@/lib/open-external'
import { useAccountsStore } from '@/stores/accounts'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import { TipTapBody } from '@/components/TipTapBody'
import { EditorAttachmentActionBar } from '@/components/EditorAttachmentActionBar'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import { useUndoStore } from '@/stores/undo'
import {
  readCalendarEventTemplates,
  type CalendarEventTemplate
} from '@/lib/calendar-event-templates-storage'
import { prepareCalendarEventDescriptionFromEditorHtml } from '@shared/calendar-event-body-html'
import { CalendarEventDescriptionPreview } from '@/app/calendar/CalendarEventDescriptionPreview'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { LocationAutocompleteInput } from '@/components/LocationAutocompleteInput'
import { ChronellDateField } from '@/components/ChronellDateField'
import { ChronellTimeField } from '@/components/ChronellTimeField'
import { useResizableWidth, VerticalSplitter } from '@/components/ResizableSplitter'
import {
  RecipientTokenField,
  type RecipientTokenFieldHandle
} from '@/components/RecipientTokenField'
import { formatRecipientsWithTail, parseRecipients } from '@/lib/compose-helpers'
import { calendarEventIconIsExplicit } from '@/lib/calendar-event-icons'
import { useThemeStore } from '@/stores/theme'
import { OneDriveExplorerDialog } from '@/components/OneDriveExplorerDialog'
import {
  CAL_EVENT_REMINDER_DEFAULT_MINUTES,
  calendarEventReminderKey,
  readCalendarEventReminder,
  writeCalendarEventReminder
} from '@/lib/calendar-event-reminders'
import {
  formatOutlookReminderMinutes,
  OUTLOOK_REMINDER_MINUTES_OPTIONS
} from '@/lib/calendar-event-reminder-options'
import {
  addMinutesInEventZone,
  convertEventDatetimeLocalBetweenZones,
  eventDatetimeLocalToMs,
  eventDatetimeLocalToUtcIso,
  formatEventDatetimeLocal,
  mergeTimeIntoEventEnd,
  mergeTimeIntoEventStart,
  mergeYmdIntoEventDatetimeLocal,
  normalizeEventTimeZoneHint,
  parseEventDatetimeLocal,
  resolveDefaultEventTimeZone,
  utcIsoToEventDatetimeLocal
} from '@/lib/calendar-event-timezone'

function isEffectivelyEmptyEditorHtml(html: string): boolean {
  const t = html.replace(/<[^>]+>/gi, '').replace(/\u00a0/g, ' ').trim()
  return t.length === 0
}

function attendeeEmailsFromField(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of parseRecipients(raw)) {
    const a = r.address.trim().toLowerCase()
    if (!a || seen.has(a)) continue
    seen.add(a)
    out.push(a)
    if (out.length >= 40) break
  }
  return out
}

/** Ein `<option>`-Wert: Konto + Graph-Kalender (leer = Standardkalender). */
function calendarDestinationKey(accountId: string, graphCalendarId: string): string {
  return JSON.stringify({ accountId, graphCalendarId })
}

function parseCalendarDestinationKey(
  key: string
): { accountId: string; graphCalendarId: string } | null {
  try {
    const o = JSON.parse(key) as { accountId?: unknown; graphCalendarId?: unknown }
    if (typeof o.accountId !== 'string') return null
    const graphCalendarId = typeof o.graphCalendarId === 'string' ? o.graphCalendarId : ''
    return { accountId: o.accountId, graphCalendarId }
  } catch {
    return null
  }
}

type RecurrenceUiFrequency = 'none' | CalendarRecurrenceFrequency

/** Optgroup im Zielkalender-Dropdown: Name + E-Mail zur eindeutigen Zuordnung. */
type CalendarEventDialogCreateKind = 'event' | 'task'

function pickDefaultTaskListId(rows: TaskListRow[]): string | null {
  if (rows.length === 0) return null
  return rows.find((r) => r.isDefault)?.id ?? rows[0]!.id
}

function resolvePreferredTaskAccountId(
  taskAccounts: ConnectedAccount[],
  preferredAccountId?: string
): string {
  if (preferredAccountId && taskAccounts.some((a) => a.id === preferredAccountId)) {
    return preferredAccountId
  }
  const stored = readTasksCalendarCreateAccountId()
  if (stored && taskAccounts.some((a) => a.id === stored)) return stored
  return taskAccounts[0]?.id ?? ''
}

function destinationAccountOptgroupLabel(account: ConnectedAccount): string {
  const name = account.displayName.trim()
  const email = account.email.trim()
  if (!name) return email || account.id
  if (!email || name.toLowerCase() === email.toLowerCase()) return name
  return `${name} · ${email}`
}

function formatDurationMs(
  ms: number,
  tr: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!Number.isFinite(ms) || ms <= 0) return tr('calendar.eventDialog.summaryDash')
  const h = Math.floor(ms / 3600000)
  const m = Math.round((ms % 3600000) / 60000)
  if (h > 0 && m > 0) return tr('calendar.eventDialog.durationHMin', { hours: h, minutes: m })
  if (h > 0) return tr('calendar.eventDialog.durationH', { hours: h })
  return tr('calendar.eventDialog.durationMin', { minutes: m })
}

function taskDatetimeLocalToMs(dtLocal: string): number {
  const iso = datetimeLocalValueToIso(dtLocal)
  if (!iso) return Number.NaN
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? Number.NaN : ms
}

function addMinutesToTaskDatetimeLocal(dtLocal: string, minutes: number): string {
  const ms = taskDatetimeLocalToMs(dtLocal)
  if (Number.isNaN(ms)) return dtLocal
  return isoToDatetimeLocalValue(new Date(ms + minutes * 60_000).toISOString())
}

function mergeTimeIntoTaskEnd(
  taskPlannedStart: string,
  taskPlannedEnd: string,
  hhmm: string
): string {
  const p = parseEventDatetimeLocal(taskPlannedEnd)
  if (!p) return taskPlannedEnd
  const [hh, mm] = hhmm.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return taskPlannedEnd
  const next = formatEventDatetimeLocal(p.ymd, hh, mm)
  const startMs = taskDatetimeLocalToMs(taskPlannedStart)
  const endMs = taskDatetimeLocalToMs(next)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return next
  if (endMs <= startMs) return addMinutesToTaskDatetimeLocal(taskPlannedStart, 15)
  return next
}

function graphReminderPayload(
  provider: string | undefined,
  enabled: boolean,
  minutesBefore: number
): { reminderMinutesBeforeStart?: number | null } {
  if (provider !== 'microsoft') return {}
  return { reminderMinutesBeforeStart: enabled ? minutesBefore : null }
}

export interface CalendarEventDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  accounts: ConnectedAccount[]
  defaultAccountId?: string
  initialRange?: { start: Date; end: Date; allDay: boolean } | null
  /** Optional: Vorausfuellung beim Anlegen (z. B. «Mit Besprechung antworten»). */
  createPrefill?: {
    subject?: string
    location?: string
    attendeeInput?: string
    descriptionHtml?: string
    teamsMeeting?: boolean
    attachments?: ComposeAttachment[]
  } | null
  initialCreateKind?: CalendarEventDialogCreateKind
  initialGraphCalendarId?: string
  initialTaskListId?: string
  initialEvent?: CalendarEventView | null
  taskAccounts?: ConnectedAccount[]
  loadListsForAccount?: (accountId: string) => Promise<TaskListRow[]>
  onTaskCreated?: () => void
  /** Nach erfolgreichem Anlegen (Termin oder Aufgabe im Dialog). */
  onEntityCreated?: (payload: { ref: ChronellEntityRef; title: string }) => void
  onClose: () => void
  onSaved: (created?: CalendarEventView) => void
  /** Eigenes OS-Fenster (Panel-Popout); kein Modal/Float/Dock in der Haupt-App. */
  surface?: 'modal' | 'dock' | 'float' | 'osWindow'
}

function PropertyRow({
  icon: Icon,
  label,
  children,
  onClick,
  onIconClick,
  iconActionLabel
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  onClick?: () => void
  onIconClick?: () => void
  iconActionLabel?: string
}): JSX.Element {
  const iconNode = onIconClick ? (
    <button
      type="button"
      title={iconActionLabel}
      aria-label={iconActionLabel}
      onClick={onIconClick}
      className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
    </button>
  ) : (
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
  )
  const inner = (
    <>
      {iconNode}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-xs text-foreground">{children}</div>
      </div>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-secondary/60"
      >
        {inner}
      </button>
    )
  }
  return <div className="flex items-start gap-3 px-1 py-2">{inner}</div>
}

export function CalendarEventDialog({
  open,
  mode,
  accounts,
  defaultAccountId,
  initialRange,
  createPrefill,
  initialCreateKind,
  initialGraphCalendarId,
  initialTaskListId,
  initialEvent,
  taskAccounts = [],
  loadListsForAccount,
  onTaskCreated,
  onEntityCreated,
  onClose,
  onSaved,
  surface
}: CalendarEventDialogProps): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const collatorLocale = useCollatorLocale()
  const systemTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    []
  )

  /** Konten mit Kalender-Anbindung (Microsoft 365 + Google). */
  const calendarAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  /** Nur Konto-IDs: verhindert Formular-Reset bei Profilfoto/Store-Refresh mit gleichen Konten. */
  const calendarAccountIdsKey = useMemo(
    () =>
      calendarAccounts
        .map((a) => a.id)
        .sort()
        .join('|'),
    [calendarAccounts]
  )
  const calendarTzConfig = useAccountsStore((s) => s.config?.calendarTimeZone)
  const defaultEventTimeZone = useMemo(
    () => resolveDefaultEventTimeZone(calendarTzConfig),
    [calendarTzConfig]
  )

  const viewerTheme = useThemeStore((s) => s.effective)

  const [accountId, setAccountId] = useState('')
  const [subject, setSubject] = useState('')
  const [eventIconId, setEventIconId] = useState<string | undefined>(undefined)
  const [location, setLocation] = useState('')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [isAllDay, setIsAllDay] = useState(false)
  const [dayStart, setDayStart] = useState('')
  const [dayEnd, setDayEnd] = useState('')
  const [dtStart, setDtStart] = useState('')
  const [dtEnd, setDtEnd] = useState('')
  const [eventTimeZone, setEventTimeZone] = useState(defaultEventTimeZone)
  const [secondaryTimeZone, setSecondaryTimeZone] = useState<string>(
    () => (systemTimeZone !== defaultEventTimeZone ? systemTimeZone : '')
  )
  const [templates, setTemplates] = useState<CalendarEventTemplate[]>([])
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [driveOpen, setDriveOpen] = useState(false)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [placement, setPlacement] = useState<CalendarEventDialogPlacement>(readCalendarEventDialogPlacement)
  const [modalSize, setModalSize] = useState(readCalendarEventDialogModalSize)
  const [dockWidth, setDockWidth] = useResizableWidth({
    storageKey: 'mailclient.calendar.eventDialog.dockWidth',
    defaultWidth: CAL_EVENT_DIALOG_DEFAULT_DOCK_W,
    minWidth: 360,
    maxWidth: 900
  })
  const [dayColumnWidth, setDayColumnWidth] = useResizableWidth({
    storageKey: CAL_EVENT_DIALOG_DAY_COLUMN_WIDTH_KEY,
    defaultWidth: CAL_EVENT_DIALOG_DEFAULT_DAY_COLUMN_W,
    minWidth: 200,
    maxWidth: 420
  })
  /** Pro Konto die Kalender von Graph (Anlegen: ein gemeinsames Auswahlfeld). */
  const [calendarsByAccount, setCalendarsByAccount] = useState<
    { account: ConnectedAccount; calendars: CalendarGraphCalendarRow[] }[]
  >([])
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  /** Graph-Kalender-ID; leer = `POST /me/events` (Standardkalender). */
  const [graphCalendarId, setGraphCalendarId] = useState('')
  /** Wert des kombinierten Zielkalender-`<select>` (JSON). */
  const [destinationSelectValue, setDestinationSelectValue] = useState('')

  const [masterCategories, setMasterCategories] = useState<MailMasterCategory[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)
  const [eventCategories, setEventCategories] = useState<string[]>([])

  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(
    CAL_EVENT_REMINDER_DEFAULT_MINUTES
  )

  const [teamsMeeting, setTeamsMeeting] = useState(false)
  const [attendeeInput, setAttendeeInput] = useState('')
  const attendeeFieldRef = useRef<RecipientTokenFieldHandle>(null)
  const [msEventDetailsLoading, setMsEventDetailsLoading] = useState(false)
  const [msEventDetailsError, setMsEventDetailsError] = useState<string | null>(null)

  const [recurFreq, setRecurFreq] = useState<RecurrenceUiFrequency>('none')
  const [recurEnd, setRecurEnd] = useState<CalendarRecurrenceRangeEndMode>('never')
  const [recurUntilDate, setRecurUntilDate] = useState('')
  const [recurCount, setRecurCount] = useState('10')
  const [recurWeekdays, setRecurWeekdays] = useState<
    Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>
  >([])

  const [createKind, setCreateKind] = useState<CalendarEventDialogCreateKind>('event')
  const [taskAccountId, setTaskAccountId] = useState('')
  const [taskListId, setTaskListId] = useState('')
  const [taskLists, setTaskLists] = useState<TaskListRow[]>([])
  const [taskListsLoading, setTaskListsLoading] = useState(false)
  const [taskNotes, setTaskNotes] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [taskPlannedStart, setTaskPlannedStart] = useState('')
  const [taskPlannedEnd, setTaskPlannedEnd] = useState('')
  const taskTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const dragDepthRef = useRef(0)

  // Inhaltsbasierte Signatur der Eingangsdaten. Damit wird die Erstbefuellung
  // (inkl. setSubject) nur dann erneut ausgefuehrt, wenn sich der tatsaechliche
  // Inhalt aendert - und nicht, wenn die Eltern-Komponente nur neu rendert und
  // neue Objekt-/Array-Referenzen fuer Props wie createPrefill/initialRange
  // uebergibt. Andernfalls wuerde ein gerade eingegebener Titel geloescht.
  const initSignature = useMemo(() => {
    if (!open) return '__closed__'
    if (mode === 'edit') {
      return [
        'edit',
        initialEvent?.accountId ?? '',
        initialEvent?.graphEventId ?? '',
        initialEvent?.id ?? '',
        initialEvent?.startIso ?? ''
      ].join('|')
    }
    return [
      'create',
      initialCreateKind ?? 'event',
      initialGraphCalendarId ?? '',
      initialTaskListId ?? '',
      initialRange
        ? `${initialRange.start.getTime()}-${initialRange.end.getTime()}-${String(initialRange.allDay)}`
        : 'no-range',
      createPrefill ? JSON.stringify(createPrefill) : 'no-prefill'
    ].join('|')
  }, [
    open,
    mode,
    initialEvent,
    initialCreateKind,
    initialGraphCalendarId,
    initialTaskListId,
    initialRange,
    createPrefill
  ])
  const initAppliedSignatureRef = useRef<string | null>(null)

  function applyTaskScheduleFromRange(range: CalendarCreateRange | null | undefined): void {
    if (!range) {
      setTaskDue('')
      setTaskPlannedStart('')
      setTaskPlannedEnd('')
      return
    }
    const sched = scheduleFromCalendarCreateRange(range, taskTimeZone)
    setTaskDue(sched.dueDate)
    setTaskPlannedStart(isoToDatetimeLocalValue(sched.plannedStartIso))
    setTaskPlannedEnd(isoToDatetimeLocalValue(sched.plannedEndIso))
  }

  useEffect(() => {
    if (!open) {
      initAppliedSignatureRef.current = null
      return
    }
    if (mode === 'edit' && !initialEvent) return
    // Nur erneut befuellen, wenn sich der Inhalt (Signatur) wirklich geaendert
    // hat. Verhindert das Loeschen bereits eingegebener Felder bei Re-Renders.
    if (initAppliedSignatureRef.current === initSignature) return
    initAppliedSignatureRef.current = initSignature

    setLocalError(null)
    setBusy(false)
    setDescriptionHtml('')
    setCreateKind(initialCreateKind ?? 'event')
    setTaskNotes('')
    setReminderEnabled(false)
    setReminderMinutesBefore(CAL_EVENT_REMINDER_DEFAULT_MINUTES)
    setEventTimeZone(defaultEventTimeZone)
    setSecondaryTimeZone(systemTimeZone !== defaultEventTimeZone ? systemTimeZone : '')
    setTemplates(readCalendarEventTemplates())
    setTemplateDropdownOpen(false)

    if (mode === 'edit' && initialEvent) {
      setAccountId(initialEvent.accountId)
      setSubject(initialEvent.title ?? '')
      setEventIconId(initialEvent.icon?.trim() || undefined)
      setLocation(initialEvent.location ?? '')
      setIsAllDay(initialEvent.isAllDay)
      setEventCategories(
        initialEvent.categories?.filter((c) => c.trim().length > 0) ?? []
      )
      if (initialEvent.isAllDay) {
        setDayStart(initialEvent.startIso.slice(0, 10))
        setDayEnd(initialEvent.endIso.slice(0, 10))
        setDtStart('')
        setDtEnd('')
      } else {
        setDtStart(utcIsoToEventDatetimeLocal(initialEvent.startIso, defaultEventTimeZone))
        setDtEnd(utcIsoToEventDatetimeLocal(initialEvent.endIso, defaultEventTimeZone))
        setDayStart('')
        setDayEnd('')
      }
      setTeamsMeeting(false)
      setAttendeeInput('')
      setMsEventDetailsError(null)
      setRecurFreq('none')
      setRecurEnd('never')
      setRecurUntilDate('')
      setRecurCount('10')
      setRecurWeekdays([])
      const calId = initialEvent.graphCalendarId?.trim() ?? ''
      setGraphCalendarId(calId)
      setDestinationSelectValue(calendarDestinationKey(initialEvent.accountId, calId))
      if (initialEvent.graphEventId?.trim()) {
        const stored = readCalendarEventReminder(
          calendarEventReminderKey(initialEvent.accountId, initialEvent.graphEventId.trim())
        )
        if (stored?.enabled === true) {
          setReminderEnabled(true)
          setReminderMinutesBefore(stored.minutesBefore)
        } else {
          setReminderEnabled(false)
          setReminderMinutesBefore(CAL_EVENT_REMINDER_DEFAULT_MINUTES)
        }
      }
      // Details (Beschreibung, Teilnehmer, Teams) werden im getEvent-Effekt geladen.
      return
    }

    if (mode === 'create') {
      const preferAcc =
        defaultAccountId && calendarAccounts.some((a) => a.id === defaultAccountId)
          ? defaultAccountId
          : calendarAccounts[0]?.id ?? ''
      const acc =
        initialCreateKind === 'task' && defaultAccountId ? defaultAccountId : preferAcc
      setAccountId(acc)
      setSubject(createPrefill?.subject?.trim() ? createPrefill.subject : '')
      setEventIconId(undefined)
      setLocation(createPrefill?.location?.trim() ? createPrefill.location : '')
      setDescriptionHtml(createPrefill?.descriptionHtml?.trim() ? createPrefill.descriptionHtml : '')
      if (initialRange) {
        setIsAllDay(initialRange.allDay)
        if (initialRange.allDay) {
          setDayStart(format(initialRange.start, 'yyyy-MM-dd'))
          setDayEnd(format(initialRange.end, 'yyyy-MM-dd'))
          setDtStart('')
          setDtEnd('')
        } else {
          setDtStart(utcIsoToEventDatetimeLocal(initialRange.start.toISOString(), defaultEventTimeZone))
          setDtEnd(utcIsoToEventDatetimeLocal(initialRange.end.toISOString(), defaultEventTimeZone))
          setDayStart('')
          setDayEnd('')
        }
      } else {
        setIsAllDay(false)
        const start = new Date()
        start.setMinutes(0, 0, 0)
        start.setHours(start.getHours() + 1)
        const end = addHours(start, 1)
        setDtStart(utcIsoToEventDatetimeLocal(start.toISOString(), defaultEventTimeZone))
        setDtEnd(utcIsoToEventDatetimeLocal(end.toISOString(), defaultEventTimeZone))
        setDayStart('')
        setDayEnd('')
      }
      setEventCategories([])
      setGraphCalendarId(initialGraphCalendarId?.trim() ?? '')
      setDestinationSelectValue(
        initialGraphCalendarId != null && acc
          ? calendarDestinationKey(acc, initialGraphCalendarId.trim())
          : ''
      )
      setTeamsMeeting(createPrefill?.teamsMeeting === true)
      setAttendeeInput(createPrefill?.attendeeInput?.trim() ? createPrefill.attendeeInput : '')
      setMsEventDetailsError(null)
      setMsEventDetailsLoading(false)
      setRecurFreq('none')
      setRecurEnd('never')
      const anchorForUntil = initialRange
        ? initialRange.start
        : ((): Date => {
            const start = new Date()
            start.setMinutes(0, 0, 0)
            start.setHours(start.getHours() + 1)
            return start
          })()
      setRecurUntilDate(format(addMonths(anchorForUntil, 6), 'yyyy-MM-dd'))
      setRecurCount('10')
      const preferTaskAcc = resolvePreferredTaskAccountId(
        taskAccounts,
        defaultAccountId && taskAccounts.some((a) => a.id === defaultAccountId)
          ? defaultAccountId
          : undefined
      )
      setTaskAccountId(
        initialCreateKind === 'task' && defaultAccountId ? defaultAccountId : preferTaskAcc
      )
      setTaskListId(initialTaskListId?.trim() ?? '')
      setTaskLists([])
      applyTaskScheduleFromRange(initialRange ?? null)
    }
  }, [
    open,
    mode,
    initialEvent,
    initialRange,
    createPrefill,
    initialCreateKind,
    initialGraphCalendarId,
    initialTaskListId,
    defaultAccountId,
    calendarAccountIdsKey,
    taskAccounts,
    defaultEventTimeZone,
    initSignature
  ])

  useEffect(() => {
    if (!open || calendarAccounts.length === 0) {
      if (mode !== 'edit') {
        setCalendarsByAccount([])
        setCalendarsLoading(false)
        setDestinationSelectValue('')
      }
      return
    }
    if (mode !== 'create' && mode !== 'edit') {
      setCalendarsByAccount([])
      setCalendarsLoading(false)
      return
    }
    let cancelled = false
    setCalendarsLoading(true)
    if (mode === 'create') {
      setDestinationSelectValue('')
    }
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
        if (mode === 'edit' && initialEvent) {
          const calId = initialEvent.graphCalendarId?.trim() ?? ''
          setDestinationSelectValue(calendarDestinationKey(initialEvent.accountId, calId))
          setAccountId(initialEvent.accountId)
          setGraphCalendarId(calId)
          return
        }
        const preferAcc =
          defaultAccountId && calendarAccounts.some((a) => a.id === defaultAccountId)
            ? defaultAccountId
            : (calendarAccounts[0]?.id ?? '')
        if (
          mode === 'create' &&
          initialGraphCalendarId != null &&
          defaultAccountId &&
          calendarAccounts.some((a) => a.id === defaultAccountId)
        ) {
          const calId = initialGraphCalendarId.trim()
          setDestinationSelectValue(calendarDestinationKey(defaultAccountId, calId))
          setAccountId(defaultAccountId)
          setGraphCalendarId(calId)
          return
        }
        const bundle = bundles.find((b) => b.account.id === preferAcc) ?? bundles[0]
        if (!bundle) {
          setDestinationSelectValue('')
          setGraphCalendarId('')
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
        const key = calendarDestinationKey(bundle.account.id, calId)
        setDestinationSelectValue(key)
        setAccountId(bundle.account.id)
        setGraphCalendarId(calId)
      })
      .finally(() => {
        if (!cancelled) setCalendarsLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [open, mode, calendarAccountIdsKey, defaultAccountId, initialGraphCalendarId, initialEvent])

  useEffect(() => {
    if (!open || mode !== 'create' || createKind !== 'task' || !taskAccountId || !loadListsForAccount) {
      setTaskLists([])
      setTaskListId('')
      return
    }
    let cancelled = false
    setTaskListsLoading(true)
    void loadListsForAccount(taskAccountId)
      .then((rows) => {
        if (cancelled) return
        setTaskLists(rows)
        const preferred =
          initialTaskListId && rows.some((r) => r.id === initialTaskListId)
            ? initialTaskListId
            : (pickDefaultTaskListId(rows) ?? '')
        setTaskListId(preferred)
      })
      .catch(() => {
        if (cancelled) return
        setTaskLists([])
        setTaskListId('')
      })
      .finally(() => {
        if (!cancelled) setTaskListsLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [open, mode, createKind, taskAccountId, loadListsForAccount, initialTaskListId])

  const timedDisplay = useMemo(() => {
    if (isAllDay || !dtStart || !dtEnd) return null
    const sp = parseEventDatetimeLocal(dtStart)
    const ep = parseEventDatetimeLocal(dtEnd)
    if (!sp || !ep) return null
    const startMs = eventDatetimeLocalToMs(dtStart, eventTimeZone)
    const endMs = eventDatetimeLocalToMs(dtEnd, eventTimeZone)
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
    const ms = endMs - startMs
    return {
      startHm: `${String(sp.hour).padStart(2, '0')}:${String(sp.minute).padStart(2, '0')}`,
      endHm: `${String(ep.hour).padStart(2, '0')}:${String(ep.minute).padStart(2, '0')}`,
      duration: formatDurationMs(ms, t),
      startYmd: sp.ymd,
      endYmd: ep.ymd
    }
  }, [isAllDay, dtStart, dtEnd, eventTimeZone, t])

  /** Formularfelder gesperrt (Busy oder Kalender nur lesbar). */
  const eventFieldsLocked = useMemo(
    () => busy || (mode === 'edit' && initialEvent?.calendarCanEdit === false),
    [busy, mode, initialEvent?.calendarCanEdit]
  )

  const isTaskCreate = mode === 'create' && createKind === 'task'

  const taskTimedDisplay = useMemo(() => {
    if (!isTaskCreate || !taskPlannedStart || !taskPlannedEnd) return null
    const sp = parseEventDatetimeLocal(taskPlannedStart)
    const ep = parseEventDatetimeLocal(taskPlannedEnd)
    if (!sp || !ep) return null
    const startMs = taskDatetimeLocalToMs(taskPlannedStart)
    const endMs = taskDatetimeLocalToMs(taskPlannedEnd)
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
    return {
      startHm: `${String(sp.hour).padStart(2, '0')}:${String(sp.minute).padStart(2, '0')}`,
      endHm: `${String(ep.hour).padStart(2, '0')}:${String(ep.minute).padStart(2, '0')}`,
      duration: formatDurationMs(endMs - startMs, t),
      startYmd: sp.ymd,
      endYmd: ep.ymd
    }
  }, [isTaskCreate, taskPlannedStart, taskPlannedEnd, t])

  const showEventDayColumn = mode === 'create' || mode === 'edit'

  const handleDayPickerTimedRangeChange = useCallback((startLocal: string, endLocal: string): void => {
    setDtStart(startLocal)
    setDtEnd(endLocal)
  }, [])

  const handleTaskDayPickerTimedRangeChange = useCallback((startLocal: string, endLocal: string): void => {
    setTaskPlannedStart(startLocal)
    setTaskPlannedEnd(endLocal)
    const sp = parseEventDatetimeLocal(startLocal)
    if (sp) setTaskDue(sp.ymd)
  }, [])

  const handleDayPickerAllDayRangeChange = useCallback(
    (nextDayStart: string, nextDayEndExcl: string): void => {
      setDayStart(nextDayStart)
      setDayEnd(nextDayEndExcl)
    },
    []
  )

  const selectedAccount = useMemo(
    () => calendarAccounts.find((a) => a.id === accountId),
    [calendarAccounts, accountId]
  )
  const selectedTaskAccount = useMemo(
    () => taskAccounts.find((a) => a.id === taskAccountId),
    [taskAccounts, taskAccountId]
  )
  const cloudLinkAccount = selectedAccount?.provider === 'microsoft' ? selectedAccount : null

  const eventAttachmentsApi = useCalendarEventAttachments({
    account: selectedAccount,
    graphEventId: mode === 'edit' ? initialEvent?.graphEventId : null,
    graphCalendarId:
      mode === 'edit' ? (initialEvent?.graphCalendarId ?? null) : graphCalendarId.trim() || null,
    enabled: open && createKind === 'event'
  })

  function hasDraggedFiles(e: React.DragEvent<HTMLElement>): boolean {
    const types = e.dataTransfer?.types
    if (!types) return false
    return Array.from(types).includes('Files')
  }

  const handleEditorDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setDraggingFiles(false)
    void eventAttachmentsApi.addFiles(Array.from(e.dataTransfer.files))
  }

  const handleEditorDragEnter = (e: React.DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current += 1
    setDraggingFiles(true)
  }

  const handleEditorDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleEditorDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDraggingFiles(false)
  }

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>): void => {
    const items = Array.from(e.clipboardData?.items ?? [])
    if (items.length === 0) return
    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((f): f is File => Boolean(f))
    if (files.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    void eventAttachmentsApi.addFiles(files)
  }

  const createPrefillAttachments = createPrefill?.attachments

  useEffect(() => {
    if (!open) return
    eventAttachmentsApi.reset(
      mode === 'create' && createPrefillAttachments?.length ? createPrefillAttachments : undefined
    )
  }, [open, mode, createPrefillAttachments, eventAttachmentsApi.reset])

  /** Outlook-Masterkategorien fuer Microsoft-Termine und -Aufgaben. */
  const useOutlookCategories =
    (isTaskCreate && selectedTaskAccount?.provider === 'microsoft') ||
    (!isTaskCreate &&
      (selectedAccount?.provider === 'microsoft' ||
        (mode === 'edit' && initialEvent?.source === 'microsoft')))

  const categoryAccountId = isTaskCreate ? taskAccountId : accountId

  useEffect(() => {
    if (!open || !useOutlookCategories || !categoryAccountId) {
      setMasterCategories([])
      setMastersLoading(false)
      return
    }
    let cancelled = false
    setMastersLoading(true)
    void window.mailClient.mail
      .listMasterCategories(categoryAccountId)
      .then((rows) => {
        if (!cancelled) setMasterCategories(rows)
      })
      .catch(() => {
        if (!cancelled) setMasterCategories([])
      })
      .finally(() => {
        if (!cancelled) setMastersLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [open, useOutlookCategories, categoryAccountId])

  useEffect(() => {
    if (!isTaskCreate || selectedTaskAccount?.provider === 'microsoft') return
    setEventCategories([])
  }, [isTaskCreate, selectedTaskAccount?.provider])

  const categoryColorByName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of masterCategories) {
      m.set(c.displayName, c.color)
    }
    return m
  }, [masterCategories])

  const categoryChoiceNames = useMemo(() => {
    const fromMasters = masterCategories.map((c) => c.displayName)
    const extra = eventCategories.filter((n) => !fromMasters.includes(n))
    return [...new Set([...fromMasters, ...extra])].sort((a, b) => a.localeCompare(b, collatorLocale))
  }, [masterCategories, eventCategories, collatorLocale])

  const panelRef = useRef<HTMLElement>(null)
  const modalResizeDragRef = useRef<{
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)
  const modalSizeRef = useRef(modalSize)
  modalSizeRef.current = modalSize

  const setPlacementPersisted = useCallback((next: CalendarEventDialogPlacement): void => {
    setPlacement(next)
    persistCalendarEventDialogPlacement(next)
  }, [])

  useEffect(() => {
    if (open) setPlacement(readCalendarEventDialogPlacement())
  }, [open])

  useEffect(() => {
    if (isAllDay) setTeamsMeeting(false)
  }, [isAllDay])

  useEffect(() => {
    if (!open || mode !== 'edit' || !initialEvent) return
    const eventId = initialEvent.graphEventId?.trim()
    if (!eventId) {
      setMsEventDetailsLoading(false)
      setMsEventDetailsError(null)
      return
    }
    if (initialEvent.source === 'google' && !initialEvent.graphCalendarId?.trim()) {
      setMsEventDetailsLoading(false)
      setMsEventDetailsError(t('calendar.eventDialog.googleCalendarIdMissing'))
      setAttendeeInput('')
      return
    }

    let cancelled = false
    setMsEventDetailsLoading(true)
    setMsEventDetailsError(null)
    setTeamsMeeting(!!initialEvent.joinUrl && !initialEvent.isAllDay)
    void window.mailClient.calendar
      .getEvent({
        accountId: initialEvent.accountId,
        graphEventId: eventId,
        graphCalendarId: initialEvent.graphCalendarId ?? null
      })
      .then((d) => {
        if (cancelled) return
        setTeamsMeeting(!!d.isOnlineMeeting && !initialEvent.isAllDay)
        setAttendeeInput(
          formatRecipientsWithTail(
            d.attendeeEmails.map((email) => ({ address: email })),
            ''
          )
        )
        if (initialEvent.source === 'microsoft') {
          setReminderEnabled(!!d.isReminderOn)
          setReminderMinutesBefore(
            typeof d.reminderMinutesBeforeStart === 'number'
              ? d.reminderMinutesBeforeStart
              : CAL_EVENT_REMINDER_DEFAULT_MINUTES
          )
        }
        const loadedTimeZone = normalizeEventTimeZoneHint(d.timeZone)
        if (!initialEvent.isAllDay && loadedTimeZone) {
          setEventTimeZone(loadedTimeZone)
          setDtStart(utcIsoToEventDatetimeLocal(initialEvent.startIso, loadedTimeZone))
          setDtEnd(utcIsoToEventDatetimeLocal(initialEvent.endIso, loadedTimeZone))
        }
        const raw = d.bodyHtml?.trim() ? d.bodyHtml.trim() : ''
        setDescriptionHtml(raw ? sanitizeComposeHtmlFragment(raw) : '')
      })
      .catch((err) => {
        if (cancelled) return
        setMsEventDetailsError(err instanceof Error ? err.message : String(err))
        setAttendeeInput('')
        setDescriptionHtml('')
      })
      .finally(() => {
        if (!cancelled) setMsEventDetailsLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [open, mode, initialEvent, t])

  const eventTimeZoneOptions = useMemo(() => {
    const opts = [...CALENDAR_TIMEZONE_UI_OPTIONS]
    const seen = new Set(opts.map((o) => o.iana))
    for (const tz of [eventTimeZone, defaultEventTimeZone, secondaryTimeZone, systemTimeZone]) {
      if (tz && !seen.has(tz)) {
        opts.push({ iana: tz, label: tz })
        seen.add(tz)
      }
    }
    return opts
  }, [eventTimeZone, defaultEventTimeZone, secondaryTimeZone, systemTimeZone])

  const secondaryTimeZonePreview = useMemo(() => {
    if (isTaskCreate || isAllDay || !secondaryTimeZone || secondaryTimeZone === eventTimeZone) return null
    if (!dtStart.trim() || !dtEnd.trim()) return null
    try {
      const invalid = t('calendar.eventDialog.invalidDate')
      const startIso = eventDatetimeLocalToUtcIso(dtStart, eventTimeZone, invalid)
      const endIso = eventDatetimeLocalToUtcIso(dtEnd, eventTimeZone, invalid)
      const formatter = new Intl.DateTimeFormat(i18n.language, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: secondaryTimeZone
      })
      const label =
        eventTimeZoneOptions.find((opt) => opt.iana === secondaryTimeZone)?.label ?? secondaryTimeZone
      return {
        label,
        startText: formatter.format(new Date(startIso)),
        endText: formatter.format(new Date(endIso))
      }
    } catch {
      return null
    }
  }, [
    dtEnd,
    dtStart,
    eventTimeZone,
    eventTimeZoneOptions,
    i18n.language,
    isAllDay,
    isTaskCreate,
    secondaryTimeZone,
    t
  ])

  const handleEventTimeZoneChange = useCallback(
    (nextTz: string): void => {
      if (!nextTz || nextTz === eventTimeZone) return
      if (!isAllDay) {
        if (dtStart) {
          setDtStart(convertEventDatetimeLocalBetweenZones(dtStart, eventTimeZone, nextTz))
        }
        if (dtEnd) {
          setDtEnd(convertEventDatetimeLocalBetweenZones(dtEnd, eventTimeZone, nextTz))
        }
      }
      setEventTimeZone(nextTz)
    },
    [dtEnd, dtStart, eventTimeZone, isAllDay]
  )

  const handleTeamsMeetingChange = useCallback((checked: boolean): void => {
    setTeamsMeeting(checked)
    if (!checked && location.trim().toLowerCase() === 'online') {
      setLocation('')
    }
  }, [location])

  useEffect(() => {
    if (!templateDropdownOpen) return
    function close(): void { setTemplateDropdownOpen(false) }
    document.addEventListener('mousedown', close)
    return (): void => document.removeEventListener('mousedown', close)
  }, [templateDropdownOpen])

  const applyTemplate = useCallback((tpl: CalendarEventTemplate): void => {
    if (tpl.defaultSubject.trim()) setSubject(tpl.defaultSubject.trim())
    if (tpl.defaultLocation.trim()) setLocation(tpl.defaultLocation.trim())
    if (tpl.descriptionHtml.trim()) setDescriptionHtml(tpl.descriptionHtml)
    if (tpl.teamsMeeting && !isAllDay) setTeamsMeeting(true)
    if (tpl.reminderMinutes >= 0) {
      setReminderEnabled(true)
      setReminderMinutesBefore(tpl.reminderMinutes)
    }
    if (tpl.durationMinutes > 0 && dtStart.trim()) {
      setDtEnd(addMinutesInEventZone(dtStart, tpl.durationMinutes, eventTimeZone))
    }
    setTemplateDropdownOpen(false)
  }, [dtStart, eventTimeZone, isAllDay])

  const msTeamsUiLocked = useMemo(
    () =>
      eventFieldsLocked ||
      (mode === 'edit' && initialEvent?.source === 'microsoft' && msEventDetailsLoading),
    [eventFieldsLocked, mode, initialEvent?.source, msEventDetailsLoading]
  )

  const onModalResizeMove = useCallback((e: PointerEvent): void => {
    const d = modalResizeDragRef.current
    if (!d) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 24
    const maxW = Math.min(1200, vw - margin)
    const maxH = Math.min(vh - margin, vh - margin)
    const w = Math.min(maxW, Math.max(640, d.startW + (e.clientX - d.startX)))
    const h = Math.min(maxH, Math.max(480, d.startH + (e.clientY - d.startY)))
    setModalSize({ w, h })
  }, [])

  const endModalResize = useCallback((): void => {
    modalResizeDragRef.current = null
    window.removeEventListener('pointermove', onModalResizeMove)
    window.removeEventListener('pointerup', endModalResize)
    window.removeEventListener('pointercancel', endModalResize)
    persistCalendarEventDialogModalSize(modalSizeRef.current.w, modalSizeRef.current.h)
  }, [onModalResizeMove])

  const onModalResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      modalResizeDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: modalSizeRef.current.w,
        startH: modalSizeRef.current.h
      }
      window.addEventListener('pointermove', onModalResizeMove)
      window.addEventListener('pointerup', endModalResize)
      window.addEventListener('pointercancel', endModalResize)
    },
    [onModalResizeMove, endModalResize]
  )

  useEffect(() => {
    return (): void => {
      window.removeEventListener('pointermove', onModalResizeMove)
      window.removeEventListener('pointerup', endModalResize)
      window.removeEventListener('pointercancel', endModalResize)
    }
  }, [onModalResizeMove, endModalResize])

  const floatDefaultPos = useMemo(() => {
    const w = Math.min(modalSize.w, window.innerWidth - 24)
    return { x: Math.max(12, window.innerWidth - w - 16), y: 48 }
  }, [modalSize.w])

  if (!open) return null

  function toggleEventCategory(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    setEventCategories((prev) => {
      const next = new Set(prev)
      if (next.has(trimmed)) next.delete(trimmed)
      else next.add(trimmed)
      return Array.from(next).sort((a, b) => a.localeCompare(b, collatorLocale))
    })
  }

  function handleCreateKindChange(next: CalendarEventDialogCreateKind): void {
    if (next === createKind) return
    if (next === 'task') {
      if (accountId && taskAccounts.some((a) => a.id === accountId)) {
        setTaskAccountId(accountId)
      }
      if (dtStart && dtEnd && !isAllDay) {
        setTaskPlannedStart(dtStart)
        setTaskPlannedEnd(dtEnd)
        setTaskDue(dtStart.slice(0, 10))
      } else if (isAllDay && dayStart) {
        setTaskDue(dayStart)
        setTaskPlannedStart('')
        setTaskPlannedEnd('')
      } else {
        applyTaskScheduleFromRange(initialRange ?? null)
      }
    }
    setCreateKind(next)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLocalError(null)

    if (mode === 'create' && createKind === 'task') {
      if (taskAccounts.length === 0) {
        setLocalError(t('tasks.create.noAccounts'))
        return
      }
      if (!taskAccountId) {
        setLocalError(t('calendar.eventDialog.selectAccount'))
        return
      }
      if (!taskListId) {
        setLocalError(t('calendar.eventDialog.selectTaskList'))
        return
      }
      if (!subject.trim()) {
        setLocalError(t('calendar.eventDialog.enterTitle'))
        return
      }
      const taskDueYmd = taskDue.trim()
      const taskRecurErr = validateTaskRecurrenceForm(
        { recurFreq, recurEnd, recurUntilDate, recurCount, recurWeekdays },
        taskDueYmd
      )
      if (taskRecurErr === 'dueRequired') {
        setLocalError(t('tasks.create.recurrenceDueRequired'))
        return
      }
      if (taskRecurErr === 'untilInvalid') {
        setLocalError(t('tasks.create.recurrenceUntilInvalid'))
        return
      }
      if (taskRecurErr === 'untilBeforeDue') {
        setLocalError(t('tasks.create.recurrenceUntilBeforeDue'))
        return
      }
      if (taskRecurErr === 'countInvalid') {
        setLocalError(t('tasks.create.recurrenceCountInvalid'))
        return
      }
      const taskRecurrence = buildTaskSaveRecurrence({
        recurFreq,
        recurEnd,
        recurUntilDate,
        recurCount,
        recurWeekdays
      })
      setBusy(true)
      try {
        const dueIso = dueIsoFromClientInput(taskDueYmd || null)
        const plannedStartIso = datetimeLocalValueToIso(taskPlannedStart)
        const plannedEndIso = datetimeLocalValueToIso(taskPlannedEnd)
        const row = await window.mailClient.tasks.createTask({
          accountId: taskAccountId,
          listId: taskListId,
          title: subject.trim(),
          notes: taskNotes.trim() || null,
          dueIso,
          completed: false,
          ...(taskRecurrence ? { recurrence: taskRecurrence } : {}),
          ...(selectedTaskAccount?.provider === 'microsoft' && eventCategories.length > 0
            ? { categories: eventCategories }
            : {})
        })
        if (plannedStartIso && plannedEndIso) {
          const taskKey = cloudTaskStableKey(taskAccountId, taskListId, row.id)
          await applyCloudTaskPersistTarget(
            {
              kind: 'planned',
              taskKey,
              plannedStartIso,
              plannedEndIso
            },
            { accountId: taskAccountId, listId: taskListId, id: row.id },
            taskTimeZone
          )
        }
        persistTasksCalendarCreateAccountId(taskAccountId)
        onEntityCreated?.({
          ref: { kind: 'cloud_task', accountId: taskAccountId, listId: taskListId, taskId: row.id },
          title: subject.trim()
        })
        onTaskCreated?.()
        onSaved()
        onClose()
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
      return
    }

    if (mode === 'create') {
      if (!parseCalendarDestinationKey(destinationSelectValue)) {
        setLocalError(t('calendar.eventDialog.selectTargetCalendar'))
        return
      }
    }
    if (!accountId) {
      setLocalError(t('calendar.eventDialog.selectAccount'))
      return
    }
    if (!subject.trim()) {
      setLocalError(t('calendar.eventDialog.enterTitle'))
      return
    }

    if (mode === 'edit' && initialEvent?.calendarCanEdit === false) {
      setLocalError(t('calendar.eventDialog.calendarReadOnly'))
      return
    }

    let startIso: string
    let endIso: string
    try {
      if (isAllDay) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dayStart) || !/^\d{4}-\d{2}-\d{2}$/.test(dayEnd)) {
          setLocalError(t('calendar.eventDialog.allDayNeedDates'))
          return
        }
        if (dayEnd <= dayStart) {
          setLocalError(t('calendar.eventDialog.endAfterStartExclusive'))
          return
        }
        startIso = dayStart
        endIso = dayEnd
      } else {
        const invalid = t('calendar.eventDialog.invalidDate')
        startIso = eventDatetimeLocalToUtcIso(dtStart, eventTimeZone, invalid)
        endIso = eventDatetimeLocalToUtcIso(dtEnd, eventTimeZone, invalid)
        if (new Date(endIso) <= new Date(startIso)) {
          setLocalError(t('calendar.eventDialog.endAfterStart'))
          return
        }
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
      return
    }

    const bodyHtml = isEffectivelyEmptyEditorHtml(descriptionHtml)
      ? null
      : prepareCalendarEventDescriptionFromEditorHtml(
          descriptionHtml,
          sanitizeComposeHtmlFragment
        )

    const parsedAttendees = attendeeEmailsFromField(attendeeInput)

    let recurrence: CalendarSaveEventRecurrence | undefined
    if (mode === 'create' && recurFreq !== 'none') {
      const startYmd = isAllDay ? dayStart : dtStart.slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) {
        setLocalError(t('calendar.eventDialog.invalidDate'))
        return
      }
      if (recurEnd === 'until') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(recurUntilDate)) {
          setLocalError(t('calendar.eventDialog.recurrenceUntilInvalid'))
          return
        }
        if (recurUntilDate < startYmd) {
          setLocalError(t('calendar.eventDialog.recurrenceUntilBeforeStart'))
          return
        }
      }
      if (recurEnd === 'count') {
        const n = parseInt(recurCount, 10)
        if (!Number.isFinite(n) || n < 1 || n > 999) {
          setLocalError(t('calendar.eventDialog.recurrenceCountInvalid'))
          return
        }
      }
      recurrence = {
        frequency: recurFreq,
        rangeEnd: recurEnd,
        ...((recurFreq === 'weekly' || recurFreq === 'biweekly') && recurWeekdays.length > 0
          ? { weekdays: recurWeekdays }
          : {}),
        ...(recurEnd === 'until' ? { untilDate: recurUntilDate } : {}),
        ...(recurEnd === 'count' ? { count: parseInt(recurCount, 10) } : {})
      }
    }

    setBusy(true)
    try {
      let createdForSaved: CalendarEventView | undefined
      if (mode === 'create') {
        const created = await window.mailClient.calendar.createEvent({
          accountId,
          graphCalendarId: graphCalendarId.trim() || null,
          subject: subject.trim(),
          startIso,
          endIso,
          isAllDay,
          location: location.trim() || null,
          bodyHtml,
          categories: eventCategories,
          ...(parsedAttendees.length > 0 || selectedAccount?.provider === 'microsoft'
            ? {
                attendeeEmails: parsedAttendees,
                ...(selectedAccount?.provider === 'microsoft'
                  ? { teamsMeeting: !isAllDay && teamsMeeting }
                  : {})
              }
            : {}),
          ...eventAttachmentsApi.buildSavePayload(),
          ...(recurrence ? { recurrence } : {}),
          ...graphReminderPayload(selectedAccount?.provider, reminderEnabled, reminderMinutesBefore),
          ...(!isAllDay ? { timeZone: eventTimeZone } : {})
        })
        const createdId = created.id?.trim()
        if (createdId) {
          writeCalendarEventReminder(
            calendarEventReminderKey(accountId, createdId),
            reminderEnabled ? { enabled: true, minutesBefore: reminderMinutesBefore } : { enabled: false }
          )
        }
        createdForSaved = created.event
        if (calendarEventIconIsExplicit(eventIconId) && created.id?.trim()) {
          await window.mailClient.calendar.patchEventIcon({
            accountId,
            graphEventId: created.id.trim(),
            iconId: eventIconId
          })
          if (createdForSaved) {
            createdForSaved = { ...createdForSaved, icon: eventIconId!.trim() }
          }
        }
        const graphEventId = createdId
        if (graphEventId) {
          onEntityCreated?.({
            ref: { kind: 'calendar_event', accountId, graphEventId },
            title: subject.trim() || t('calendar.eventDialog.untitled')
          })
        }
      } else {
        const gid = initialEvent?.graphEventId
        if (!gid) {
          setLocalError(t('calendar.eventDialog.missingEventId'))
          setBusy(false)
          return
        }
        const parsedDest = parseCalendarDestinationKey(destinationSelectValue)
        const initialCalId = initialEvent.graphCalendarId?.trim() ?? ''
        const initialDestKey = calendarDestinationKey(initialEvent.accountId, initialCalId)
        const destinationChanged =
          parsedDest != null &&
          destinationSelectValue !== initialDestKey &&
          (parsedDest.accountId !== initialEvent.accountId ||
            parsedDest.graphCalendarId !== initialCalId)

        const payloadOverride = {
          subject: subject.trim(),
          startIso,
          endIso,
          isAllDay,
          location: location.trim() || null,
          bodyHtml,
          categories: eventCategories,
          ...(parsedAttendees.length > 0 ||
          initialEvent.source === 'microsoft' ||
          initialEvent.source === 'google'
            ? {
                attendeeEmails: parsedAttendees,
                ...(initialEvent.source === 'microsoft'
                  ? { teamsMeeting: !isAllDay && teamsMeeting }
                  : {})
              }
            : {})
          ,
          ...eventAttachmentsApi.buildSavePayload(),
          ...graphReminderPayload(initialEvent.source, reminderEnabled, reminderMinutesBefore),
          ...(!isAllDay ? { timeZone: eventTimeZone } : {})
        }

        if (destinationChanged && parsedDest) {
          await window.mailClient.calendar.transferEvent({
            source: {
              accountId: initialEvent.accountId,
              graphEventId: gid,
              graphCalendarId: initialEvent.graphCalendarId ?? null,
              title: initialEvent.title,
              startIso: initialEvent.startIso,
              endIso: initialEvent.endIso,
              isAllDay: initialEvent.isAllDay,
              location: initialEvent.location ?? null,
              categories: initialEvent.categories ?? null
            },
            targetAccountId: parsedDest.accountId,
            targetGraphCalendarId: parsedDest.graphCalendarId,
            mode: 'move',
            payloadOverride
          })
        } else {
          await window.mailClient.calendar.updateEvent({
            accountId,
            graphEventId: gid,
            graphCalendarId: initialEvent.graphCalendarId ?? null,
            ...payloadOverride
          })
        }
        writeCalendarEventReminder(
          calendarEventReminderKey(initialEvent.accountId, gid),
          reminderEnabled ? { enabled: true, minutesBefore: reminderMinutesBefore } : { enabled: false }
        )
        const prevIcon = initialEvent.icon?.trim() || null
        const nextIcon = eventIconId?.trim() || null
        if ((prevIcon ?? '') !== (nextIcon ?? '')) {
          await window.mailClient.calendar.patchEventIcon({
            accountId: initialEvent.accountId,
            graphEventId: gid,
            iconId: nextIcon
          })
        }
      }
      const invitedCount = parsedAttendees.length
      if (invitedCount > 0) {
        const names = attendeeEmailsFromField(attendeeInput)
          .slice(0, 3)
          .join(', ')
        const moreCount = invitedCount > 3 ? invitedCount - 3 : 0
        const label = moreCount > 0
          ? t('calendar.eventDialog.invitationSentWithMore', { names, count: moreCount })
          : t('calendar.eventDialog.invitationSent', { names })
        useUndoStore.getState().pushToast({ label, variant: 'success', durationMs: 6000 })
      }
      onSaved(createdForSaved)
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const submitDisabled =
    busy ||
    (isTaskCreate
      ? taskAccounts.length === 0 ||
        !taskAccountId ||
        !taskListId ||
        !subject.trim() ||
        taskListsLoading
      : calendarAccounts.length === 0 ||
        ((mode === 'create' || mode === 'edit') && calendarsLoading) ||
        (mode === 'edit' && initialEvent?.calendarCanEdit === false) ||
        (mode === 'edit' && Boolean(initialEvent?.graphEventId) && msEventDetailsLoading))

  const hasInviteAttendees =
    !isTaskCreate && attendeeEmailsFromField(attendeeInput).length > 0
  const submitLabel = isTaskCreate
    ? t('tasks.create.submit')
    : hasInviteAttendees
      ? t('calendar.eventDialog.send')
      : t('calendar.eventDialog.save')

  const isMicrosoftEventAccount =
    selectedAccount?.provider === 'microsoft' ||
    initialEvent?.source === 'microsoft'

  const panelShellClass =
    'calendar-event-panel flex min-h-0 flex-1 flex-col overflow-hidden bg-card text-foreground'

  const headerDockButton = (
    <button
      type="button"
      title={
        placement === 'dock'
          ? t('calendar.eventDialog.undockTitle')
          : t('calendar.eventDialog.dockTitle')
      }
      aria-label={
        placement === 'dock'
          ? t('calendar.eventDialog.undockTitle')
          : t('calendar.eventDialog.dockTitle')
      }
      onClick={(e): void => {
        if (surface === 'osWindow') return
        if (loadUseOsFloatingPanelsDefault() && placement === 'dock' && !e.shiftKey) {
          void openCalendarEventDialogOsPopout({
            mode,
            defaultAccountId,
            initialRange: initialRange ?? null,
            createPrefill,
            initialCreateKind,
            initialGraphCalendarId,
            initialTaskListId,
            initialEvent,
            title: initialEvent?.title
          })
          onClose()
          return
        }
        if (placement === 'dock') setPlacementPersisted('float')
        else setPlacementPersisted('dock')
      }}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {placement === 'dock' ? (
        <SquareArrowOutUpRight className="h-4 w-4" />
      ) : (
        <LayoutPanelLeft className="h-4 w-4" />
      )}
    </button>
  )

  const panelInner = (
    <div ref={panelRef as React.RefObject<HTMLDivElement>} className={panelShellClass}>
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {mode === 'create' && taskAccounts.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="sr-only">{t('calendar.eventDialog.kindLabel')}</span>
                <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(): void => handleCreateKindChange('event')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                      createKind === 'event'
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    )}
                  >
                    {t('calendar.eventDialog.eventKindName')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(): void => handleCreateKindChange('task')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                      createKind === 'task'
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    )}
                  >
                    {t('calendar.eventDialog.taskKindName')}
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-base font-medium text-muted-foreground">
                {t('calendar.eventDialog.panelTitle')}
              </span>
            )}

            {mode === 'create' && createKind === 'task' && taskAccounts.length > 0 ? (
              <div className="flex min-w-0 items-center gap-2">
                <label className="min-w-0">
                  <span className="sr-only">{t('tasks.create.account')}</span>
                  <select
                    value={taskAccountId}
                    disabled={busy || taskListsLoading}
                    onChange={(e): void => setTaskAccountId(e.target.value)}
                    aria-label={t('tasks.create.account')}
                    className="h-9 max-w-[min(280px,32vw)] truncate rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {taskAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {cloudTaskAccountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="sr-only">{t('tasks.create.list')}</span>
                  <select
                    value={taskListId}
                    disabled={busy || taskListsLoading || taskLists.length === 0}
                    onChange={(e): void => setTaskListId(e.target.value)}
                    aria-label={t('tasks.create.list')}
                    className="h-9 max-w-[min(220px,28vw)] truncate rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {taskListsLoading ? (
                      <option value="">{t('calendar.eventDialog.loadingShort')}</option>
                    ) : (
                      taskLists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>
            ) : mode === 'create' && createKind === 'event' && calendarAccounts.length > 0 ? (
              <label className="min-w-0">
                <span className="sr-only">{t('calendar.eventDialog.targetCalendarAria')}</span>
                <select
                  value={destinationSelectValue}
                  disabled={calendarsLoading}
                  onChange={(e): void => {
                    const v = e.target.value
                    setDestinationSelectValue(v)
                    const parsed = parseCalendarDestinationKey(v)
                    if (parsed) {
                      setAccountId(parsed.accountId)
                      setGraphCalendarId(parsed.graphCalendarId)
                    }
                  }}
                  aria-label={t('calendar.eventDialog.targetCalendarAria')}
                  className="h-9 max-w-[min(420px,45vw)] truncate rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {calendarsLoading ? (
                    <option value="">{t('calendar.eventDialog.submitLoadingCalendars')}</option>
                  ) : (
                    calendarsByAccount.flatMap(({ account, calendars }) => {
                      const accLabel = destinationAccountOptgroupLabel(account)
                      const opts =
                        calendars.length === 0
                          ? [
                              <option key={`${account.id}:primary`} value={calendarDestinationKey(account.id, '')}>
                                {t('calendar.eventDialog.primaryCalendarStandard')}
                              </option>
                            ]
                          : calendars.map((c) => (
                              <option
                                key={`${account.id}:${c.id}`}
                                value={calendarDestinationKey(account.id, c.id)}
                              >
                                {c.name}
                                {c.isDefaultCalendar ? t('calendar.eventDialog.standardCalendarSuffix') : ''}
                              </option>
                            ))
                      return [<optgroup key={account.id} label={accLabel}>{opts}</optgroup>]
                    })
                  )}
                </select>
              </label>
            ) : null}
          </div>
          <div className="flex items-center gap-0.5">
            {/* Template-Auswahl – nur beim Erstellen von Events mit vorhandenen Templates */}
            {mode === 'create' && !isTaskCreate && templates.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  disabled={busy}
                  onClick={(): void => setTemplateDropdownOpen((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title={t('calendar.eventDialog.applyTemplateTitle')}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  {t('calendar.eventDialog.applyTemplateBtn')}
                </button>
                {templateDropdownOpen && (
                  <div className="absolute right-0 top-9 z-30 min-w-[200px] rounded-md border border-border bg-popover shadow-lg">
                    <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('calendar.eventDialog.applyTemplateTitle')}
                    </p>
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={(): void => applyTemplate(tpl)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <span className="shrink-0 text-base leading-none">{tpl.emoji || '📅'}</span>
                        <span className="min-w-0 flex-1 truncate">{tpl.name}</span>
                        {tpl.teamsMeeting && <Video className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {headerDockButton}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={t('calendar.eventDialog.closeAria')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <form
          className={cn('flex min-h-0 flex-1', showEventDayColumn && 'flex-row')}
          onSubmit={(ev): void => void handleSubmit(ev)}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-0 overflow-y-auto px-4 py-3">
            <div className="border-b border-border pb-3">
              <div className="flex items-stretch gap-2">
                {mode === 'create' && createKind === 'task' ? (
                  <CheckSquare className="my-auto h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CalendarEventIconPicker
                    layout="compact"
                    iconId={eventIconId}
                    title={subject}
                    disabled={eventFieldsLocked}
                    onIconChange={setEventIconId}
                    compactButtonClassName="h-[44px] w-[44px]"
                  />
                )}
                <input
                  type="text"
                  value={subject}
                  onChange={(e): void => setSubject(e.target.value)}
                  disabled={eventFieldsLocked}
                  placeholder={
                    mode === 'create' && createKind === 'task'
                      ? t('calendar.eventDialog.taskTitlePlaceholder')
                      : t('calendar.eventDialog.titlePlaceholder')
                  }
                  aria-label={t('calendar.eventDialog.titleAria')}
                  className="min-w-0 flex-1 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-2 text-[17px] font-semibold leading-snug text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              {useOutlookCategories ? (
                <div className="mt-2 pl-[52px]">
                  <CalendarEventCategoryPopover
                    categoryNames={categoryChoiceNames}
                    selected={eventCategories}
                    categoryColorByName={categoryColorByName}
                    mastersLoading={mastersLoading}
                    disabled={busy}
                    onToggle={toggleEventCategory}
                  />
                </div>
              ) : null}
            </div>

            {/* Teams-Meeting Toggle – prominent nach dem Titel für schnellen Webinar-Workflow */}
            {(mode !== 'create' || createKind === 'event') && isMicrosoftEventAccount ? (
              <div className={cn(
                'border-b border-border py-2',
                teamsMeeting && 'bg-blue-500/5'
              )}>
                <label className={cn(
                  'flex cursor-pointer items-center gap-3 px-1 py-1 rounded-md transition-colors',
                  teamsMeeting
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-muted-foreground hover:text-foreground'
                )}>
                  <Video className={cn('h-4 w-4 shrink-0', teamsMeeting && 'text-blue-500')} />
                  <input
                    type="checkbox"
                    checked={teamsMeeting}
                    disabled={isAllDay || msTeamsUiLocked || eventFieldsLocked}
                    onChange={(e): void => handleTeamsMeetingChange(e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-border accent-blue-500"
                  />
                  <span className="text-sm font-medium leading-snug">
                    {t('calendar.eventDialog.teamsMeetingToggle')}
                  </span>
                  {teamsMeeting && !isAllDay && (
                    <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                      {t('calendar.eventDialog.teamsMeetingActive')}
                    </span>
                  )}
                  {isAllDay && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t('calendar.eventDialog.teamsDisabledAllDay')}
                    </span>
                  )}
                </label>
                {msEventDetailsError ? (
                  <p className="mt-1 px-1 text-2xs text-destructive" role="status">
                    {msEventDetailsError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Zielkalender / Aufgabenliste ist im Header (Create). */}

            <div className="border-b border-border py-3">
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
                <div className="min-w-0 lg:col-span-2">
                  <div className={eventDialogSectionHeadingClass}>
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    {isTaskCreate
                      ? t('tasks.create.planned')
                      : t('calendar.eventDialog.appointmentHeading')}
                  </div>
                  <div className="space-y-2">
                    {isTaskCreate && taskTimedDisplay ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                            {t('calendar.eventDialog.labelBegin')}:
                          </span>
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                            <ChronellDateField
                              disabled={busy}
                              value={taskTimedDisplay.startYmd}
                              onChange={(v): void => {
                                if (!v) return
                                const nextStart = mergeYmdIntoEventDatetimeLocal(taskPlannedStart, v)
                                setTaskPlannedStart(nextStart)
                                setTaskDue(v)
                                if (taskDatetimeLocalToMs(taskPlannedEnd) <= taskDatetimeLocalToMs(nextStart)) {
                                  setTaskPlannedEnd(addMinutesToTaskDatetimeLocal(nextStart, 15))
                                }
                              }}
                              className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                            />
                            <ChronellTimeField
                              disabled={busy}
                              value={taskTimedDisplay.startHm}
                              aria-label={t('tasks.create.plannedStart')}
                              className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                              onChange={(hm): void => {
                                const nextStart = mergeTimeIntoEventStart(taskPlannedStart, hm)
                                setTaskPlannedStart(nextStart)
                                if (taskDatetimeLocalToMs(taskPlannedEnd) <= taskDatetimeLocalToMs(nextStart)) {
                                  setTaskPlannedEnd(addMinutesToTaskDatetimeLocal(nextStart, 15))
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                            {t('calendar.eventDialog.labelEnd')}:
                          </span>
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                            <ChronellDateField
                              disabled={busy}
                              value={taskTimedDisplay.endYmd}
                              min={taskTimedDisplay.startYmd}
                              onChange={(v): void => {
                                if (!v) return
                                const nextEnd = mergeYmdIntoEventDatetimeLocal(taskPlannedEnd, v)
                                if (taskDatetimeLocalToMs(nextEnd) <= taskDatetimeLocalToMs(taskPlannedStart)) {
                                  setTaskPlannedEnd(addMinutesToTaskDatetimeLocal(taskPlannedStart, 15))
                                } else {
                                  setTaskPlannedEnd(nextEnd)
                                }
                              }}
                              className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                            />
                            <ChronellTimeField
                              disabled={busy}
                              value={taskTimedDisplay.endHm}
                              aria-label={t('tasks.create.plannedEnd')}
                              className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                              onChange={(hm): void => {
                                setTaskPlannedEnd(
                                  mergeTimeIntoTaskEnd(taskPlannedStart, taskPlannedEnd, hm)
                                )
                              }}
                            />
                          </div>
                        </div>
                        <p className="pl-14 text-xs tabular-nums text-muted-foreground">
                          {taskTimedDisplay.duration}
                        </p>
                      </div>
                    ) : isTaskCreate ? (
                      <p className="text-xs text-muted-foreground">{t('calendar.eventDialog.summaryDash')}</p>
                    ) : !isAllDay && timedDisplay ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                            {t('calendar.eventDialog.labelBegin')}:
                          </span>
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                            <ChronellDateField
                              disabled={eventFieldsLocked}
                              value={timedDisplay.startYmd}
                              onChange={(v): void => {
                                if (!v) return
                                const nextStart = mergeYmdIntoEventDatetimeLocal(dtStart, v)
                                setDtStart(nextStart)
                                if (
                                  eventDatetimeLocalToMs(dtEnd, eventTimeZone) <=
                                  eventDatetimeLocalToMs(nextStart, eventTimeZone)
                                ) {
                                  setDtEnd(addMinutesInEventZone(nextStart, 15, eventTimeZone))
                                }
                              }}
                              className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                            />
                            <ChronellTimeField
                              disabled={eventFieldsLocked}
                              value={timedDisplay.startHm}
                              aria-label={t('calendar.eventDialog.editStartTimeAria')}
                              className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                              onChange={(hm): void => {
                                const nextStart = mergeTimeIntoEventStart(dtStart, hm)
                                setDtStart(nextStart)
                                if (
                                  eventDatetimeLocalToMs(dtEnd, eventTimeZone) <=
                                  eventDatetimeLocalToMs(nextStart, eventTimeZone)
                                ) {
                                  setDtEnd(addMinutesInEventZone(nextStart, 15, eventTimeZone))
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                            {t('calendar.eventDialog.labelEnd')}:
                          </span>
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                            <ChronellDateField
                              disabled={eventFieldsLocked}
                              value={timedDisplay.endYmd}
                              min={timedDisplay.startYmd}
                              onChange={(v): void => {
                                if (!v) return
                                const nextEnd = mergeYmdIntoEventDatetimeLocal(dtEnd, v)
                                if (
                                  eventDatetimeLocalToMs(nextEnd, eventTimeZone) <=
                                  eventDatetimeLocalToMs(dtStart, eventTimeZone)
                                ) {
                                  setDtEnd(addMinutesInEventZone(dtStart, 15, eventTimeZone))
                                } else {
                                  setDtEnd(nextEnd)
                                }
                              }}
                              className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                            />
                            <ChronellTimeField
                              disabled={eventFieldsLocked}
                              value={timedDisplay.endHm}
                              aria-label={t('calendar.eventDialog.editEndTimeAria')}
                              className={cn(eventDialogPanelSelectClass, 'min-w-0 tabular-nums')}
                              onChange={(hm): void => {
                                setDtEnd(mergeTimeIntoEventEnd(dtStart, dtEnd, hm, eventTimeZone))
                              }}
                            />
                          </div>
                        </div>
                        <p className="pl-14 text-xs tabular-nums text-muted-foreground">
                          {timedDisplay.duration}
                        </p>
                      </div>
                    ) : isAllDay && dayStart && dayEnd ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                            {t('calendar.eventDialog.labelBegin')}:
                          </span>
                          <ChronellDateField
                            disabled={eventFieldsLocked}
                            value={dayStart}
                            onChange={(v): void => {
                              if (!v) return
                              setDayStart(v)
                              if (dayEnd <= v) {
                                setDayEnd(format(addDays(parseISO(`${v}T12:00:00`), 1), 'yyyy-MM-dd'))
                              }
                            }}
                            className={cn(eventDialogPanelSelectClass, 'min-w-0 flex-1 tabular-nums')}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                            {t('calendar.eventDialog.labelEnd')}:
                          </span>
                          <ChronellDateField
                            disabled={eventFieldsLocked}
                            min={dayStart}
                            value={format(addDays(parseISO(`${dayEnd}T12:00:00`), -1), 'yyyy-MM-dd')}
                            onChange={(v): void => {
                              if (!v) return
                              const excl = format(addDays(parseISO(`${v}T12:00:00`), 1), 'yyyy-MM-dd')
                              if (excl <= dayStart) {
                                setDayEnd(format(addDays(parseISO(`${dayStart}T12:00:00`), 1), 'yyyy-MM-dd'))
                              } else {
                                setDayEnd(excl)
                              }
                            }}
                            className={cn(eventDialogPanelSelectClass, 'min-w-0 flex-1 tabular-nums')}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('calendar.eventDialog.summaryDash')}</p>
                    )}
                    {!isTaskCreate ? (
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 text-xs font-medium',
                        eventFieldsLocked && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isAllDay}
                        disabled={eventFieldsLocked}
                        onChange={(e): void => {
                          const nextAllDay = e.target.checked
                          if (nextAllDay) {
                            if (dtStart && dtEnd) {
                              const sp = parseEventDatetimeLocal(dtStart)
                              const ep = parseEventDatetimeLocal(dtEnd)
                              if (sp && ep) {
                                const startDay = sp.ymd
                                const endDay = ep.ymd
                                const lastInclusive = endDay >= startDay ? endDay : startDay
                                setDayStart(startDay)
                                setDayEnd(
                                  format(addDays(parseISO(`${lastInclusive}T12:00:00`), 1), 'yyyy-MM-dd')
                                )
                              }
                            }
                            setIsAllDay(true)
                          } else {
                            if (dayStart) {
                              setDtStart(`${dayStart}T09:00`)
                              setDtEnd(addMinutesInEventZone(`${dayStart}T09:00`, 60, eventTimeZone))
                            }
                            setIsAllDay(false)
                          }
                        }}
                        className="rounded border-border"
                      />
                      <span className={cn(isAllDay ? 'text-foreground' : 'text-muted-foreground')}>
                        {t('calendar.eventDialog.allDay')}
                      </span>
                    </label>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0">
                  {isTaskCreate ? (
                    <>
                      <div className={eventDialogSectionHeadingClass}>
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        {t('tasks.create.due')}
                      </div>
                      <ChronellDateField
                        disabled={busy}
                        value={taskDue}
                        onChange={(v): void => {
                          setTaskDue(v)
                          if (
                            v &&
                            recurWeekdays.length === 0 &&
                            (recurFreq === 'weekly' || recurFreq === 'biweekly')
                          ) {
                            setRecurWeekdays(defaultWeekdayFromDueYmd(v))
                          }
                        }}
                        className={cn(eventDialogPanelSelectClass, 'tabular-nums')}
                      />
                    </>
                  ) : (
                    <>
                  <div className={eventDialogSectionHeadingClass}>
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    {t('calendar.eventDialog.timezoneHeading')}
                  </div>
                  <select
                    value={eventTimeZone}
                    disabled={eventFieldsLocked || isAllDay}
                    onChange={(e): void => handleEventTimeZoneChange(e.target.value)}
                    aria-label={t('calendar.eventDialog.timezoneSelectAria')}
                    title={t('calendar.eventDialog.timezoneTitle')}
                    className={eventDialogPanelSelectClass}
                  >
                    {eventTimeZoneOptions.map((opt) => (
                      <option key={opt.iana} value={opt.iana}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 space-y-2">
                    <select
                      value={secondaryTimeZone}
                      disabled={eventFieldsLocked || isAllDay}
                      onChange={(e): void => setSecondaryTimeZone(e.target.value)}
                      aria-label={t('calendar.eventDialog.secondaryTimezoneSelectAria')}
                      title={t('calendar.eventDialog.secondaryTimezoneTitle')}
                      className={eventDialogPanelSelectClass}
                    >
                      <option value="">{t('calendar.eventDialog.secondaryTimezoneNone')}</option>
                      {eventTimeZoneOptions
                        .filter((opt) => opt.iana !== eventTimeZone)
                        .map((opt) => (
                          <option key={opt.iana} value={opt.iana}>
                            {opt.label}
                          </option>
                        ))}
                    </select>
                    {secondaryTimeZonePreview ? (
                      <p className="text-2xs leading-snug text-muted-foreground">
                        {t('calendar.eventDialog.secondaryTimezonePreview', {
                          zone: secondaryTimeZonePreview.label,
                          start: secondaryTimeZonePreview.startText,
                          end: secondaryTimeZonePreview.endText
                        })}
                      </p>
                    ) : !isAllDay && secondaryTimeZone ? (
                      <p className="text-2xs leading-snug text-muted-foreground">
                        {t('calendar.eventDialog.secondaryTimezoneHint')}
                      </p>
                    ) : null}
                  </div>
                    </>
                  )}
                </div>

                {isTaskCreate ? (
                  <div className="min-w-0">
                    <CalendarEventRecurrenceSection
                      i18nPrefix="tasks.create"
                      recurFreq={recurFreq}
                      setRecurFreq={(v): void => {
                        setRecurFreq(v)
                        if (
                          (v === 'weekly' || v === 'biweekly') &&
                          recurWeekdays.length === 0 &&
                          taskDue.trim()
                        ) {
                          setRecurWeekdays(defaultWeekdayFromDueYmd(taskDue.trim()))
                        }
                      }}
                      recurEnd={recurEnd}
                      setRecurEnd={setRecurEnd}
                      recurUntilDate={recurUntilDate}
                      setRecurUntilDate={setRecurUntilDate}
                      recurCount={recurCount}
                      setRecurCount={setRecurCount}
                      recurWeekdays={recurWeekdays}
                      setRecurWeekdays={setRecurWeekdays}
                      eventFieldsLocked={busy}
                      embedded
                    />
                  </div>
                ) : mode === 'create' && createKind === 'event' ? (
                  <div className="min-w-0">
                    <CalendarEventRecurrenceSection
                      recurFreq={recurFreq}
                      setRecurFreq={setRecurFreq}
                      recurEnd={recurEnd}
                      setRecurEnd={setRecurEnd}
                      recurUntilDate={recurUntilDate}
                      setRecurUntilDate={setRecurUntilDate}
                      recurCount={recurCount}
                      setRecurCount={setRecurCount}
                      recurWeekdays={recurWeekdays}
                      setRecurWeekdays={setRecurWeekdays}
                      eventFieldsLocked={eventFieldsLocked}
                      embedded
                    />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className={eventDialogSectionHeadingClass}>
                      <Repeat2 className="h-3.5 w-3.5 shrink-0" />
                      {t('calendar.eventDialog.recurrenceHeading')}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('calendar.eventDialog.summaryDash')}</p>
                  </div>
                )}

                <div className="min-w-0">
                  <div className={eventDialogSectionHeadingClass}>
                    <Bell className="h-3.5 w-3.5 shrink-0" />
                    {t('calendar.eventDialog.reminderHeading')}
                  </div>
                  {isTaskCreate ? (
                    <p className={cn(eventDialogPanelSelectClass, 'flex items-center text-muted-foreground')}>
                      {t('calendar.eventDialog.summaryDash')}
                    </p>
                  ) : (
                    <>
                  <select
                    aria-label={t('calendar.eventDialog.reminderHeading')}
                    value={reminderEnabled ? String(reminderMinutesBefore) : 'none'}
                    disabled={eventFieldsLocked || (isAllDay && !isMicrosoftEventAccount)}
                    onChange={(e): void => {
                      const v = e.target.value
                      if (v === 'none') {
                        setReminderEnabled(false)
                        return
                      }
                      setReminderEnabled(true)
                      setReminderMinutesBefore(Math.max(0, Math.round(Number(v) || 0)))
                    }}
                    className={eventDialogPanelSelectClass}
                  >
                    <option value="none">{t('calendar.eventDialog.reminderNone')}</option>
                    {OUTLOOK_REMINDER_MINUTES_OPTIONS.map((m) => (
                      <option key={m} value={String(m)}>
                        {formatOutlookReminderMinutes(m, t)}
                      </option>
                    ))}
                  </select>
                  {isMicrosoftEventAccount && reminderEnabled ? (
                    <p className="mt-2 text-2xs text-muted-foreground">
                      {t('calendar.eventDialog.reminderDesktopHint')}
                    </p>
                  ) : null}
                  {isAllDay && !isMicrosoftEventAccount ? (
                    <p className="mt-2 text-2xs text-muted-foreground">{t('calendar.eventDialog.reminderDisabledAllDay')}</p>
                  ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>


            {(mode !== 'create' || createKind === 'event') &&
            (selectedAccount?.provider === 'google' ? (
              <div className="border-b border-border py-1">
                <PropertyRow
                  icon={UserPlus}
                  label={t('calendar.eventDialog.attendeesRowLabel')}
                  onIconClick={(): void => attendeeFieldRef.current?.openContactPicker()}
                  iconActionLabel={t('calendar.eventDialog.attendeesPickContacts')}
                >
                  <div className="mt-1 rounded-md border border-border bg-background px-2 py-1.5">
                    <RecipientTokenField
                      ref={attendeeFieldRef}
                      hideLabelColumn
                      label={t('calendar.eventDialog.attendeesRowLabel')}
                      value={attendeeInput}
                      onChange={setAttendeeInput}
                      accountId={accountId}
                      className="border-0 px-0 py-0"
                    />
                  </div>
                </PropertyRow>
              </div>
            ) : selectedAccount?.provider === 'microsoft' ? (
              <div className="border-b border-border py-1">
                <PropertyRow
                  icon={UserPlus}
                  label={t('calendar.eventDialog.attendeesRowLabel')}
                  onIconClick={(): void => attendeeFieldRef.current?.openContactPicker()}
                  iconActionLabel={t('calendar.eventDialog.attendeesPickContacts')}
                >
                  <div className="mt-1 rounded-md border border-border bg-background px-2 py-1.5">
                    <RecipientTokenField
                      ref={attendeeFieldRef}
                      hideLabelColumn
                      label={t('calendar.eventDialog.attendeesRowLabel')}
                      value={attendeeInput}
                      onChange={setAttendeeInput}
                      accountId={accountId}
                      className="border-0 px-0 py-0"
                    />
                  </div>
                </PropertyRow>
              </div>
            ) : null)}

            {mode === 'edit' && calendarAccounts.length > 0 ? (
              <div className="border-b border-border py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('calendar.eventDialog.destinationHeadingShort')}
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {t('calendar.eventDialog.destinationMoveHelp')}
                </p>
                <select
                  value={destinationSelectValue}
                  disabled={busy || calendarsLoading || initialEvent?.calendarCanEdit === false}
                  onChange={(e): void => {
                    const v = e.target.value
                    setDestinationSelectValue(v)
                    const parsed = parseCalendarDestinationKey(v)
                    if (parsed) {
                      setAccountId(parsed.accountId)
                      setGraphCalendarId(parsed.graphCalendarId)
                    }
                  }}
                  aria-label={t('calendar.eventDialog.targetCalendarAria')}
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {calendarsLoading ? (
                    <option value="">{t('calendar.eventDialog.submitLoadingCalendars')}</option>
                  ) : (
                    calendarsByAccount.map(({ account, calendars }) => {
                      const accLabel = destinationAccountOptgroupLabel(account)
                      return (
                        <optgroup key={account.id} label={accLabel}>
                          {calendars.length === 0 ? (
                            <option value={calendarDestinationKey(account.id, '')}>
                              {t('calendar.eventDialog.primaryCalendarStandard')}
                            </option>
                          ) : (
                            calendars.map((c) => (
                              <option
                                key={`${account.id}:${c.id}`}
                                value={calendarDestinationKey(account.id, c.id)}
                              >
                                {c.name}
                                {c.isDefaultCalendar ? t('calendar.eventDialog.standardCalendarSuffix') : ''}
                              </option>
                            ))
                          )}
                        </optgroup>
                      )
                    })
                  )}
                </select>
              </div>
            ) : null}

            {(mode !== 'create' || createKind === 'event') ? (
            <div className="border-b border-border py-1">
              <div
                className={cn(
                  'grid grid-cols-1 gap-x-6 gap-y-3',
                  isMicrosoftEventAccount && 'md:grid-cols-2'
                )}
              >
                <PropertyRow icon={MapPin} label={t('calendar.eventDialog.locationRowLabel')}>
                  <LocationAutocompleteInput
                    value={location}
                    onChange={setLocation}
                    disabled={eventFieldsLocked}
                    inputClassName={eventDialogPanelSelectClass}
                  />
                </PropertyRow>
                {/* Teams-Toggle wurde nach oben (unter Titel) verschoben */}
              </div>
              <PropertyRow icon={AlignLeft} label={t('calendar.eventDialog.description')}>
                <div className="mt-1 min-w-0 space-y-2">
                  {mode === 'edit' && Boolean(initialEvent?.graphEventId) && msEventDetailsLoading ? (
                    <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('calendar.eventDialog.loadingEventDetails')}
                    </p>
                  ) : null}
                  {msEventDetailsError && mode === 'edit' && initialEvent?.graphEventId ? (
                    <p className="text-2xs text-destructive" role="alert">
                      {msEventDetailsError}
                    </p>
                  ) : null}
                  {eventFieldsLocked ? (
                    <CalendarEventDescriptionPreview
                      html={descriptionHtml}
                      viewerTheme={viewerTheme}
                      className="w-full"
                    />
                  ) : (
                    <div
                      className={cn(
                        'rounded-md transition-colors',
                        draggingFiles && 'bg-primary/10 ring-1 ring-primary/35'
                      )}
                      onDragEnter={handleEditorDragEnter}
                      onDragOver={handleEditorDragOver}
                      onDragLeave={handleEditorDragLeave}
                      onDrop={handleEditorDrop}
                      onPasteCapture={handleEditorPaste}
                    >
                      {!eventFieldsLocked &&
                      (eventAttachmentsApi.supportsFileAttachments ||
                        eventAttachmentsApi.supportsCloudAttachments) ? (
                        <EditorAttachmentActionBar
                          compact
                          disabled={busy}
                          onError={eventAttachmentsApi.setAttachmentError}
                          onAddFiles={(files): void => {
                            void eventAttachmentsApi.addFiles(files)
                          }}
                          showMediaActions={eventAttachmentsApi.supportsFileAttachments}
                          enableFileAttach={eventAttachmentsApi.supportsFileAttachments}
                          onCloudAttach={
                            eventAttachmentsApi.supportsCloudAttachments
                              ? (): void => setDriveOpen(true)
                              : undefined
                          }
                          attachmentCount={eventAttachmentsApi.newFiles.length}
                          cloudAttachmentCount={eventAttachmentsApi.newReferences.length}
                          className="rounded-t-md border border-b-0 border-border"
                        />
                      ) : null}
                      <TipTapBody
                        valueHtml={descriptionHtml}
                        onChangeHtml={setDescriptionHtml}
                        placeholder={t('calendar.eventDialog.descriptionEditorPlaceholder')}
                        editorMinHeightClass="min-h-[220px]"
                        className={cn(
                          'min-h-[260px] rounded-md border border-border bg-background !border-t-0',
                          !eventFieldsLocked &&
                            (eventAttachmentsApi.supportsFileAttachments ||
                              eventAttachmentsApi.supportsCloudAttachments) &&
                            'rounded-t-none border-t-0'
                        )}
                      />
                      <CalendarEventAttachmentsPanel
                        attachments={eventAttachmentsApi}
                        disabled={eventFieldsLocked}
                        showDropHint={draggingFiles}
                        className="px-2 pb-2"
                      />
                    </div>
                  )}
                </div>
              </PropertyRow>
            </div>
            ) : null}

            {isTaskCreate ? (
            <div className="border-b border-border py-1">
              <PropertyRow icon={AlignLeft} label={t('tasks.create.notes')}>
                <textarea
                  value={taskNotes}
                  onChange={(e): void => setTaskNotes(e.target.value)}
                  disabled={busy}
                  rows={6}
                  className={cn(
                    eventDialogPanelSelectClass,
                    'mt-1 min-h-[220px] resize-y py-2'
                  )}
                />
              </PropertyRow>
            </div>
            ) : null}

            {mode === 'edit' && initialEvent?.graphEventId ? (
              <EntityContextBlock
                anchor={{
                  kind: 'calendar_event',
                  accountId: initialEvent.accountId,
                  graphEventId: initialEvent.graphEventId
                }}
                noteTarget={{
                  kind: 'calendar',
                  accountId: initialEvent.accountId,
                  calendarSource: initialEvent.source,
                  calendarRemoteId: initialEvent.graphCalendarId?.trim() || 'default',
                  eventRemoteId: initialEvent.graphEventId,
                  title: subject.trim() || initialEvent.title,
                  eventTitleSnapshot: subject.trim() || initialEvent.title,
                  eventStartIsoSnapshot: initialEvent.startIso
                }}
                contentPaddingClass="px-4"
                sectionCollapsedDefault
                className="border-b border-border"
              />
            ) : null}

            {mode === 'edit' && initialEvent && (initialEvent.webLink || initialEvent.joinUrl) && (
              <div className="flex flex-wrap gap-2 border-b border-border py-3">
                {initialEvent.webLink && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={(): void => {
                      voidOpenExternalUrl(initialEvent.webLink!)
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('calendar.eventDialog.openInOutlook')}
                  </button>
                )}
                {initialEvent.joinUrl && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={(): void => {
                      voidOpenExternalUrl(initialEvent.joinUrl!)
                    }}
                  >
                    <Video className="h-3.5 w-3.5" />
                    {t('calendar.eventDialog.joinTeamsShort')}
                  </button>
                )}
              </div>
            )}

            {localError && (
              <p className="py-2 text-xs text-destructive" role="alert">
                {localError}
              </p>
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 shadow-[0_-8px_24px_-4px_hsl(0_0%_0%/0.25)]">
            <button
              type="button"
              onClick={onClose}
              className="text-base font-medium text-muted-foreground hover:text-foreground"
            >
              {t('calendar.eventDialog.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              title={
                isTaskCreate
                  ? taskAccounts.length === 0
                    ? t('tasks.create.noAccounts')
                    : taskListsLoading
                      ? t('calendar.eventDialog.loadingShort')
                      : undefined
                  : calendarAccounts.length === 0
                    ? t('calendar.eventDialog.submitNoAccount')
                    : mode === 'create' && calendarsLoading
                      ? t('calendar.eventDialog.submitLoadingCalendars')
                      : mode === 'edit' && initialEvent?.calendarCanEdit === false
                        ? t('calendar.eventDialog.submitReadOnly')
                        : mode === 'edit' && Boolean(initialEvent?.graphEventId) && msEventDetailsLoading
                          ? t('calendar.eventDialog.loadingEventDetails')
                          : undefined
              }
              className={cn(
                'inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/90',
                submitDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : hasInviteAttendees ? (
                <Send className="h-4 w-4" aria-hidden />
              ) : null}
              {submitLabel}
            </button>
          </footer>
          </div>

          {showEventDayColumn ? (
            <>
              <VerticalSplitter
                ariaLabel={t('calendar.eventDialog.dayColumnResizeAria')}
                onDrag={(delta): void => setDayColumnWidth((w) => w - delta)}
              />
              <aside
                className="flex min-h-0 shrink-0 flex-col border-l border-border bg-card"
                style={{ width: dayColumnWidth }}
              >
                <CalendarEventDialogDayPicker
                  accountId={isTaskCreate ? taskAccountId : accountId}
                  accounts={isTaskCreate ? taskAccounts : calendarAccounts}
                  eventTimeZone={isTaskCreate ? taskTimeZone : eventTimeZone}
                  isAllDay={isTaskCreate ? false : isAllDay}
                  disabled={isTaskCreate ? busy : eventFieldsLocked}
                  editingEventId={mode === 'edit' ? initialEvent?.id : null}
                  dtStart={isTaskCreate ? taskPlannedStart : dtStart}
                  dtEnd={isTaskCreate ? taskPlannedEnd : dtEnd}
                  dayStart={dayStart}
                  dayEnd={dayEnd}
                  onTimedRangeChange={
                    isTaskCreate
                      ? handleTaskDayPickerTimedRangeChange
                      : handleDayPickerTimedRangeChange
                  }
                  onAllDayRangeChange={handleDayPickerAllDayRangeChange}
                />
              </aside>
            </>
          ) : null}
        </form>
    </div>
  )

  const drivePortal = cloudLinkAccount ? (
    <OneDriveExplorerDialog
      open={driveOpen}
      accountId={cloudLinkAccount.id}
      configureSharingLink={false}
      onClose={(): void => setDriveOpen(false)}
      onPickFile={(file): void => {
        eventAttachmentsApi.addCloudReference(file)
        setDriveOpen(false)
      }}
    />
  ) : null

  if (!open) return null

  if (surface === 'osWindow') {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{panelInner}</div>
        {drivePortal}
      </>
    )
  }

  if (placement === 'dock') {
    return (
      <>
        <div className="fixed inset-0 z-[95] flex justify-end bg-black/25" onClick={onClose} role="presentation" />
        <div className="fixed inset-y-0 right-0 z-[100] flex">
          <VerticalSplitter
            ariaLabel={t('calendar.eventDialog.modalResizeAria')}
            onDrag={(delta): void => setDockWidth((w) => w - delta)}
          />
          <aside
            className="flex h-full min-h-0 flex-col border-l border-border bg-card shadow-2xl"
            style={{ width: dockWidth }}
            onClick={(e): void => e.stopPropagation()}
          >
            {panelInner}
          </aside>
        </div>
        {drivePortal}
      </>
    )
  }

  if (placement === 'float') {
    return (
      <>
        <CalendarFloatingPanel
          open
          title={t('calendar.eventDialog.dockPanelTitle')}
          widthPx={modalSize.w}
          initialHeightPx={modalSize.h}
          minHeightPx={480}
          minResizeWidthPx={640}
          maxResizeWidthPx={1200}
          maxResizeHeightPx={Math.min(1000, window.innerHeight - 24)}
          persistSizeKey={CAL_EVENT_DIALOG_FLOAT_SIZE_KEY}
          defaultPosition={floatDefaultPos}
          zIndex={100}
          hideHeaderActions
          onClose={onClose}
          onDock={(): void => setPlacementPersisted('dock')}
        >
          {panelInner}
        </CalendarFloatingPanel>
        {drivePortal}
      </>
    )
  }

  return (
    <ModalRoot
      open={open}
      zIndex={100}
      centerClassName="justify-center bg-black/45 backdrop-blur-[2px] p-3 sm:p-6"
      onBackdropClick={onClose}
    >
      <ModalPanel
        variant="center"
        className="!max-h-none !max-w-none overflow-visible border-0 bg-transparent p-0 shadow-none"
      >
        <div
          className="calendar-event-panel relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
          style={{
            width: modalSize.w,
            height: modalSize.h,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'calc(100dvh - 24px)'
          }}
        >
          {panelInner}
          <div
            role="separator"
            aria-label={t('calendar.eventDialog.modalResizeAria')}
            title={t('calendar.eventDialog.modalResizeAria')}
            onPointerDown={onModalResizePointerDown}
            className="absolute bottom-0 right-0 z-[2] h-5 w-5 cursor-se-resize rounded-br-[10px] border-l border-t border-border/70 bg-muted/60 hover:bg-muted"
          />
        </div>
      </ModalPanel>
      {drivePortal}
    </ModalRoot>
  )
}
