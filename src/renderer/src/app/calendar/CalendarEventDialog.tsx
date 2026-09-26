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
  CircleDot,
  EyeOff,
  Globe,
  LayoutPanelLeft,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  Repeat2,
  Send,
  SquareArrowOutUpRight,
  Trash2,
  UserPlus,
  Users,
  ListChecks,
  Video,
  X,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type {
  CalendarEventShowAs,
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
import {
  CALENDAR_EVENT_SHOW_AS_OPTIONS,
  DEFAULT_CALENDAR_EVENT_SHOW_AS,
  calendarEventSensitivityFromPrivate,
  calendarEventSensitivityIsPrivate
} from '@shared/calendar-event-status'
import { CALENDAR_TIMEZONE_UI_OPTIONS } from '@shared/microsoft-timezones'
import { dueIsoFromClientInput } from '@shared/calendar-datetime'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import { CalendarEventRecurrenceSection } from '@/app/calendar/CalendarEventRecurrenceSection'
import { CalendarEventDialogDayPicker } from '@/app/calendar/CalendarEventDialogDayPicker'
import { CalendarEventDialogSubjectRow } from '@/app/calendar/CalendarEventDialogSubjectRow'
import { CalendarEventDialogAttendeeField } from '@/app/calendar/CalendarEventDialogAttendeeField'
import { CalendarEventDialogTeamsJoinLink } from '@/app/calendar/CalendarEventDialogTeamsJoinLink'
import { CalendarEventDialogWebinarContentForm, type WebinarContentFormValues } from '@/app/calendar/CalendarEventDialogWebinarContentForm'
import { WebinarLayoutThemeSwatches } from '@/components/WebinarLayoutThemeSwatches'
import {
  buildWebinarInvitationHtml,
  patchWebinarInvitationScheduleLabel,
  patchWebinarInvitationTitle,
  type WebinarLayoutThemeId
} from '@/lib/build-webinar-invitation-html'
import {
  readWebinarInvitationDefaults,
  resolveDefaultWebinarLayoutTheme
} from '@/lib/webinar-invitation-defaults-storage'
import {
  getWebinarInvitationLayoutTemplateById,
  readWebinarInvitationLayoutTemplates,
  resolveWebinarLayoutTemplateHtml,
  WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
  type WebinarInvitationLayoutTemplate
} from '@/lib/webinar-invitation-layout-templates-storage'
import {
  prepareWebinarInvitationSaveBundle,
  mergeWebinarBodyWithTeamsProvision,
  resolveCalendarEventBodyForGraph
} from '@/lib/prepare-webinar-invitation-save'
import {
  isWebinarInvitationHtml,
  parseWebinarInvitationHtml
} from '@/lib/parse-webinar-invitation-html'
import { buildWebinarAttendeePreviewHtml, isWebinarInvitationHtmlLikelyGutted } from '@/lib/build-webinar-attendee-preview-html'
import { restoreWebinarTeamsSlotForEditor } from '@/lib/restore-webinar-invitation-for-editor'
import { WebinarInvitationPreview } from '@/app/calendar/WebinarInvitationPreview'
import { WebinarInvitationEditorPanel } from '@/app/calendar/WebinarInvitationEditorPanel'
import { createCalendarEventDialogJoinUrlStore } from '@/app/calendar/calendar-event-dialog-join-url-store'
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
import { blobToDataUrl } from '@/lib/blob-to-base64'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import {
  prepareCalendarEventBodyHtmlForAttendeeDisplay,
  prepareCalendarEventBodyHtmlForEditor,
  resolveCalendarEventInlineCidImages
} from '@/lib/prepare-calendar-event-body-html'
import { showAppChoice, showAppConfirm, showAppPrompt } from '@/stores/app-dialog'
import { useUndoStore } from '@/stores/undo'
import {
  createEmptyTemplate,
  readCalendarEventTemplates,
  saveCalendarEventTemplate,
  type CalendarEventTemplate
} from '@/lib/calendar-event-templates-storage'
import {
  cleanTeamsMeetingJoinInformationHtml,
  extractTeamsMeetingJoinBlockHtml,
  htmlAlreadyHasTeamsMeetingJoinBlock,
  prepareCalendarEventDescriptionFromEditorHtml
} from '@shared/calendar-event-body-html'
import { preferTeamsJoinUrl, isTeamsLongMeetupJoinUrl } from '@shared/teams-join-url'
import { CalendarEventDescriptionPreview } from '@/app/calendar/CalendarEventDescriptionPreview'
import { CalendarEventDialogRibbon } from '@/app/calendar/CalendarEventDialogRibbon'
import { CalendarEventDescriptionCopilotDialog } from '@/app/calendar/CalendarEventDescriptionCopilotDialog'
import { pickAndSendCalendarEventToNotion } from '@/lib/notion-ui'
import { listCopilotEngineOptions } from '@/lib/copilot-engine-options'
import { useAiConnectionsSettings } from '@/lib/use-ai-connections-settings'
import { useWorkIqAvailable } from '@/lib/use-workiq-available'
import { readTeamsMeetingTemplates } from '@/lib/teams-meeting-templates-storage'
import {
  calendarEventScheduleChanged,
  confirmEventDialogMeetingReschedule
} from '@/app/calendar/calendar-meeting-schedule-change'
import { LocationAutocompleteInput } from '@/components/LocationAutocompleteInput'
import { ChronellDateField } from '@/components/ChronellDateField'
import { ChronellTimeField } from '@/components/ChronellTimeField'
import { useResizableWidth, VerticalSplitter } from '@/components/ResizableSplitter'
import { type RecipientTokenFieldHandle } from '@/components/RecipientTokenField'
import { FilterTabs } from '@/components/FilterTabs'
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

function descriptionSnapshotKey(html: string): string {
  return isEffectivelyEmptyEditorHtml(html) ? '' : html.trim()
}

function calendarEventDetailsLookCached(
  d: {
    bodyHtml?: string | null
    joinUrl?: string | null
    attendeeEmails?: string[]
    optionalAttendeeEmails?: string[]
    subject?: string | null
    isOnlineMeeting?: boolean
  }
): boolean {
  return Boolean(
    d.bodyHtml?.trim() ||
      d.joinUrl?.trim() ||
      d.subject?.trim() ||
      d.isOnlineMeeting ||
      (d.attendeeEmails?.length ?? 0) > 0 ||
      (d.optionalAttendeeEmails?.length ?? 0) > 0
  )
}

const MAX_EVENT_DIALOG_ATTENDEES = 500

function attendeeEmailsFromField(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of parseRecipients(raw)) {
    const a = r.address.trim().toLowerCase()
    if (!a || seen.has(a)) continue
    seen.add(a)
    out.push(a)
    if (out.length >= MAX_EVENT_DIALOG_ATTENDEES) break
  }
  return out
}

/** Webinar-Standard: keine Antworten, keine Weiterleitung, Teilnehmerliste aus. */
function applyWebinarTrackingDefaults(setters: {
  setHideAttendees: (v: boolean) => void
  setResponseRequested: (v: boolean) => void
  setAllowForwarding: (v: boolean) => void
}): void {
  setters.setHideAttendees(true)
  setters.setResponseRequested(false)
  setters.setAllowForwarding(false)
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

/** Parst freie Dauer-Eingaben: `2h`, `2 h 30`, `90`, `1:30`, `120m`. Ergebnis in Minuten. */
function parseDurationInputToMinutes(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(',', '.').replace(/\s+/g, ' ')
  if (!s) return null
  const clock = s.match(/^(\d{1,3})\s*:\s*(\d{1,2})$/)
  if (clock) {
    const h = Number(clock[1])
    const m = Number(clock[2])
    if (!Number.isFinite(h) || !Number.isFinite(m) || m >= 60) return null
    const total = h * 60 + m
    return total > 0 ? total : null
  }
  const hThenM = s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|r)?(?:\s*(\d+)\s*m(?:in(?:utes?)?)?)?$/)
  if (hThenM) {
    const h = Number(hThenM[1])
    const m = hThenM[2] != null ? Number(hThenM[2]) : 0
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    const total = Math.round(h * 60) + m
    return total > 0 ? total : null
  }
  const minOnly = s.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/)
  if (minOnly) {
    const m = Number(minOnly[1])
    return Number.isFinite(m) && m > 0 ? m : null
  }
  const plain = s.match(/^(\d+(?:\.\d+)?)$/)
  if (plain) {
    const n = Number(plain[1])
    if (!Number.isFinite(n) || n <= 0) return null
    // Ganzzahlen ohne Einheit = Minuten; Dezimalzahl = Stunden (z. B. 1.5).
    if (s.includes('.')) return Math.round(n * 60)
    return Math.round(n)
  }
  return null
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
    /** 3-Schritt-Webinar-Assistent (Meeting → Text → Einladen). */
    webinarMode?: boolean
    webinarHeroImageSrc?: string | null
    webinarWebsiteUrl?: string
    webinarSupplementHtml?: string
    /** Notion-Seiten-ID (#kurtrocks Events) fuer Link-Writeback. */
    notionPageId?: string
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
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [driveOpen, setDriveOpen] = useState(false)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [placement, setPlacement] = useState<CalendarEventDialogPlacement>(readCalendarEventDialogPlacement)
  const [modalSize, setModalSize] = useState(readCalendarEventDialogModalSize)
  const [dockWidth, setDockWidth] = useResizableWidth({
    storageKey: 'mailclient.calendar.eventDialog.dockWidth',
    defaultWidth: CAL_EVENT_DIALOG_DEFAULT_DOCK_W,
    minWidth: 420,
    maxWidth: typeof window !== 'undefined' ? Math.max(420, window.innerWidth - 32) : 2400
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
  /** Join-URL im Store — Updates rendern nur Join-Link/Ribbon-Button, nicht den ganzen Dialog. */
  const joinUrlStoreRef = useRef(createCalendarEventDialogJoinUrlStore())
  const setDialogJoinUrl = useCallback((url: string | null): void => {
    joinUrlStoreRef.current.set(url)
  }, [])
  const getDialogJoinUrl = useCallback((): string | null => joinUrlStoreRef.current.getSnapshot(), [])
  const [teamsProvisioning, setTeamsProvisioning] = useState(false)
  /** Gemeinsame laufende Provision — Speichern wartet darauf statt parallel abzubrechen. */
  const teamsProvisionInflightRef = useRef<Promise<boolean> | null>(null)
  /** Webinar-Assistent: 1 Meeting, 2 Einladungstext, 3 Einladen. */
  const [webinarMode, setWebinarMode] = useState(false)
  const [chronellWebinarInvitation, setChronellWebinarInvitation] = useState(false)
  const [webinarTemplateDialogOpen, setWebinarTemplateDialogOpen] = useState(false)
  const [webinarLayoutTheme, setWebinarLayoutTheme] = useState<WebinarLayoutThemeId>(() =>
    resolveDefaultWebinarLayoutTheme(readWebinarInvitationDefaults())
  )
  const [webinarLayoutTemplateId, setWebinarLayoutTemplateId] = useState(
    () =>
      readWebinarInvitationDefaults().defaultLayoutTemplateId ?? WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
  )
  const [webinarImagesLoading, setWebinarImagesLoading] = useState(false)
  const [graphBodyForPreview, setGraphBodyForPreview] = useState<string | null>(null)
  const [attendeeDisplayHtml, setAttendeeDisplayHtml] = useState('')
  const [webinarContent, setWebinarContent] = useState<WebinarContentFormValues>({
    title: '',
    heroImageSrc: null,
    surveyUrl: '',
    surveyLabel: '',
    websiteUrl: '',
    websiteLabel: ''
  })
  /** Notion-Beschreibung → Supplement-Block (nur diese Session). */
  const [webinarSupplementHtml, setWebinarSupplementHtml] = useState<string | null>(null)
  /** Notion-Seiten-ID aus „Webinar aus Notion“ — Links zurueckschreiben. */
  const [notionSourcePageId, setNotionSourcePageId] = useState<string | null>(null)
  const webinarHtmlEditorFlushRef = useRef<(() => string) | null>(null)
  const pendingWebinarAutoRestoreRef = useRef(false)
  /** Notion-/Prefill-Import: Einladung anwenden, sobald Content im State ist. */
  const pendingWebinarPrefillApplyRef = useRef(false)
  /**
   * Create-Modus: Event-ID nach sofortigem Anlegen der Teams-Besprechung
   * (Speichern wird danach zum Update).
   */
  const [provisionedEventId, setProvisionedEventId] = useState<string | null>(null)
  /** Teams Premium: ausgewaehlte meetingTemplateId (Graph), leer = Standard. */
  const [teamsMeetingTemplateId, setTeamsMeetingTemplateId] = useState('')
  /** True wenn die aktuelle Teams-Besprechung ueber eine Premium-Vorlage lief. */
  const [teamsProvisionedWithTemplate, setTeamsProvisionedWithTemplate] = useState(false)
  const [teamsMeetingTemplates, setTeamsMeetingTemplates] = useState<
    import('@/lib/teams-meeting-templates-storage').TeamsMeetingTemplate[]
  >([])
  const autoProvisionTeamsRef = useRef(false)
  const [attendeeInput, setAttendeeInput] = useState('')
  const [optionalAttendeeInput, setOptionalAttendeeInput] = useState('')
  const [attendeesInviteTab, setAttendeesInviteTab] = useState<
    'required' | 'optional' | 'tracking'
  >('required')
  /** Termin-Dialog: Termin-Details vs. Ort/Teams. */
  const [eventScheduleTab, setEventScheduleTab] = useState<
    'appointment' | 'more' | 'location'
  >('appointment')
  const [descriptionCopilotOpen, setDescriptionCopilotOpen] = useState(false)
  const attendeeFieldRef = useRef<RecipientTokenFieldHandle>(null)
  const optionalAttendeeFieldRef = useRef<RecipientTokenFieldHandle>(null)
  const [msEventDetailsLoading, setMsEventDetailsLoading] = useState(false)
  const [msEventDetailsError, setMsEventDetailsError] = useState<string | null>(null)
  /** Nach getEvent: Einzeltermin → Serie möglich; Serie/Vorkommen → Muster bearbeiten. */
  const [editEventType, setEditEventType] = useState<
    'singleInstance' | 'occurrence' | 'exception' | 'seriesMaster' | null
  >(null)
  const [editEventTypeLoaded, setEditEventTypeLoaded] = useState(false)
  /** Bei Vorkommen/Ausnahme: Master-ID fuer Serien-PATCH. */
  const [editSeriesMasterId, setEditSeriesMasterId] = useState<string | null>(null)
  /** Geladenes Serienmuster (Dirty-Check beim Speichern). */
  const [loadedRecurrence, setLoadedRecurrence] = useState<CalendarSaveEventRecurrence | null>(null)

  const [recurFreq, setRecurFreq] = useState<RecurrenceUiFrequency>('none')
  const [recurEnd, setRecurEnd] = useState<CalendarRecurrenceRangeEndMode>('never')
  const [recurUntilDate, setRecurUntilDate] = useState('')
  const [recurCount, setRecurCount] = useState('10')
  const [recurWeekdays, setRecurWeekdays] = useState<
    Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>
  >([])
  const [eventShowAs, setEventShowAs] = useState<CalendarEventShowAs>(DEFAULT_CALENDAR_EVENT_SHOW_AS)
  const [eventIsPrivate, setEventIsPrivate] = useState(false)
  /** Microsoft 365: Graph `hideAttendees` (Teilnehmerliste ausblenden). */
  const [hideAttendees, setHideAttendees] = useState(false)
  /** Microsoft 365: Graph `responseRequested` (Antworten anfordern). */
  const [responseRequested, setResponseRequested] = useState(true)
  /** Microsoft 365: Weiterleitung zulassen (DoNotForward invertiert). */
  const [allowForwarding, setAllowForwarding] = useState(true)
  const [modalMaximized, setModalMaximized] = useState(false)
  const modalSizeBeforeMaximizeRef = useRef<{ w: number; h: number } | null>(null)

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
  const panelRef = useRef<HTMLElement>(null)
  const baselineFieldsRef = useRef<string | null>(null)
  const baselineDescriptionRef = useRef<string | null>(null)
  const armBaselineRef = useRef(false)
  /** Letzte aus Cache/Netz geladene Beschreibung — verhindert Force-Refresh-Overwrite beim Tippen. */
  const loadedDescriptionBaselineRef = useRef<string | null>(null)
  const calendarsWereLoadingRef = useRef(false)

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

    if (mode === 'edit' && initialEvent) {
      setAccountId(initialEvent.accountId)
      setSubject(initialEvent.title ?? '')
      setEventIconId(initialEvent.icon?.trim() || undefined)
      setLocation(initialEvent.location ?? '')
      setIsAllDay(initialEvent.isAllDay)
      setWebinarMode(false)
      setChronellWebinarInvitation(false)
      setWebinarSupplementHtml(null)
      setNotionSourcePageId(null)
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
      setDialogJoinUrl(null)
      setTeamsProvisioning(false)
      setProvisionedEventId(null)
      setTeamsMeetingTemplateId('')
      setTeamsProvisionedWithTemplate(false)
      setTeamsMeetingTemplates(readTeamsMeetingTemplates())
      autoProvisionTeamsRef.current = false
      setAttendeeInput('')
      setOptionalAttendeeInput('')
      setAttendeesInviteTab('required')
      setEventScheduleTab('appointment')
      setMsEventDetailsError(null)
      setEditEventType(null)
      setEditEventTypeLoaded(false)
      setEditSeriesMasterId(null)
      setLoadedRecurrence(null)
      setRecurFreq('none')
      setRecurEnd('never')
      setRecurUntilDate('')
      setRecurCount('10')
      setRecurWeekdays([])
      setEventShowAs(DEFAULT_CALENDAR_EVENT_SHOW_AS)
      setEventIsPrivate(false)
      setHideAttendees(false)
      setResponseRequested(true)
      setAllowForwarding(true)
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
      setTeamsMeeting(createPrefill?.teamsMeeting === true || createPrefill?.webinarMode === true)
      autoProvisionTeamsRef.current =
        createPrefill?.teamsMeeting === true || createPrefill?.webinarMode === true
      setDialogJoinUrl(null)
      setTeamsProvisioning(false)
      setProvisionedEventId(null)
      setTeamsMeetingTemplateId('')
      setTeamsProvisionedWithTemplate(false)
      setTeamsMeetingTemplates(readTeamsMeetingTemplates())
      const isWebinar = createPrefill?.webinarMode === true
      setWebinarMode(isWebinar)
      setChronellWebinarInvitation(false)
      setWebinarContent({
        title: createPrefill?.subject?.trim() || '',
        heroImageSrc: createPrefill?.webinarHeroImageSrc?.trim() || null,
        surveyUrl: '',
        surveyLabel: '',
        websiteUrl: createPrefill?.webinarWebsiteUrl?.trim() || '',
        websiteLabel: ''
      })
      setWebinarSupplementHtml(createPrefill?.webinarSupplementHtml?.trim() || null)
      setNotionSourcePageId(createPrefill?.notionPageId?.trim() || null)
      if (
        isWebinar &&
        (createPrefill?.webinarHeroImageSrc ||
          createPrefill?.webinarWebsiteUrl ||
          createPrefill?.webinarSupplementHtml ||
          createPrefill?.subject)
      ) {
        pendingWebinarPrefillApplyRef.current = true
      } else {
        pendingWebinarPrefillApplyRef.current = false
      }
      setAttendeeInput(createPrefill?.attendeeInput?.trim() ? createPrefill.attendeeInput : '')
      setOptionalAttendeeInput('')
      setAttendeesInviteTab('required')
      setEventScheduleTab('appointment')
      setMsEventDetailsError(null)
      setMsEventDetailsLoading(false)
      setEditEventType(null)
      setEditEventTypeLoaded(false)
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
      setRecurWeekdays([])
      setEventShowAs(DEFAULT_CALENDAR_EVENT_SHOW_AS)
      setEventIsPrivate(false)
      // Webinar: Teilnehmerliste aus, keine Antworten, keine Weiterleitung
      if (isWebinar) {
        applyWebinarTrackingDefaults({ setHideAttendees, setResponseRequested, setAllowForwarding })
      } else {
        setHideAttendees(false)
        setResponseRequested(true)
        setAllowForwarding(true)
      }
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

    const needsRemoteDetails =
      mode === 'edit' && Boolean(initialEvent?.graphEventId?.trim())
    if (!needsRemoteDetails) {
      armBaselineRef.current = true
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
    const durationMinutes = Math.max(0, Math.round(ms / 60000))
    return {
      startHm: `${String(sp.hour).padStart(2, '0')}:${String(sp.minute).padStart(2, '0')}`,
      endHm: `${String(ep.hour).padStart(2, '0')}:${String(ep.minute).padStart(2, '0')}`,
      duration: formatDurationMs(ms, t),
      durationMinutes,
      startYmd: sp.ymd,
      endYmd: ep.ymd
    }
  }, [isAllDay, dtStart, dtEnd, eventTimeZone, t])

  const [durationDraft, setDurationDraft] = useState<string | null>(null)

  useEffect(() => {
    setDurationDraft(null)
  }, [timedDisplay?.durationMinutes, isAllDay])

  const applyEventDurationMinutes = useCallback(
    (minutes: number): void => {
      if (!dtStart.trim() || !Number.isFinite(minutes) || minutes <= 0) return
      const capped = Math.min(Math.max(Math.round(minutes), 5), 24 * 60 * 14)
      setDtEnd(addMinutesInEventZone(dtStart, capped, eventTimeZone))
    },
    [dtStart, eventTimeZone]
  )

  const commitDurationDraft = useCallback((): void => {
    if (durationDraft == null) return
    const parsed = parseDurationInputToMinutes(durationDraft)
    setDurationDraft(null)
    if (parsed == null) return
    applyEventDurationMinutes(parsed)
  }, [applyEventDurationMinutes, durationDraft])

  /** Formularfelder gesperrt (Busy oder Kalender nur lesbar). */
  const eventFieldsLocked = useMemo(
    () => busy || (mode === 'edit' && initialEvent?.calendarCanEdit === false),
    [busy, mode, initialEvent?.calendarCanEdit]
  )

  const isTaskCreate = mode === 'create' && createKind === 'task'

  /** Einzeltermin → Serie, oder bestehende Serie/Vorkommen bearbeiten. */
  const canEditRecurrenceOnEvent =
    mode === 'edit' &&
    (!editEventTypeLoaded ||
      editEventType === 'singleInstance' ||
      editEventType === 'seriesMaster' ||
      editEventType === 'occurrence' ||
      editEventType === 'exception' ||
      editEventType == null)

  const showEventRecurrenceEditor =
    (mode === 'create' && createKind === 'event') || canEditRecurrenceOnEvent

  const isExistingSeriesEdit =
    mode === 'edit' &&
    editEventTypeLoaded &&
    (editEventType === 'seriesMaster' ||
      editEventType === 'occurrence' ||
      editEventType === 'exception')

  /** Speichern mit Serie: Anlegen, Einzel→Serie, oder bestehende Serie aktualisieren. */
  const canSaveRecurrence =
    mode === 'create' ||
    (mode === 'edit' &&
      editEventTypeLoaded &&
      (editEventType === 'singleInstance' ||
        editEventType === 'seriesMaster' ||
        editEventType === 'occurrence' ||
        editEventType === 'exception' ||
        editEventType == null))

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
    graphEventId:
      mode === 'edit'
        ? initialEvent?.graphEventId
        : provisionedEventId,
    graphCalendarId:
      mode === 'edit'
        ? (initialEvent?.graphCalendarId ?? null)
        : graphCalendarId.trim() || null,
    // Create + Teams-Eager: Attachments erst nach Provision-Ende (sonst Extra-Roundtrip).
    enabled: open && createKind === 'event' && !(mode === 'create' && teamsProvisioning)
  })

  function hasDraggedFiles(e: React.DragEvent<HTMLElement>): boolean {
    const types = e.dataTransfer?.types
    if (!types) return false
    return Array.from(types).includes('Files')
  }

  const handleEditorDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    const images = files.filter((f) => f.type.startsWith('image/'))
    const nonImages = files.filter((f) => !f.type.startsWith('image/'))
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setDraggingFiles(false)
    if (images.length > 0) {
      void (async (): Promise<void> => {
        const chunks: string[] = []
        for (const file of images) {
          try {
            const dataUrl = await blobToDataUrl(file)
            if (!dataUrl) continue
            const alt = file.name
              .replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/</g, '&lt;')
            chunks.push(
              `<p><img src="${dataUrl}" alt="${alt}" style="max-width:100%;height:auto;" /></p>`
            )
          } catch {
            /* einzelne Datei ueberspringen */
          }
        }
        if (chunks.length === 0) return
        setDescriptionHtml((prev) => `${prev.trim() ? prev : ''}${chunks.join('')}`)
      })()
    }
    if (nonImages.length > 0) {
      void eventAttachmentsApi.addFiles(nonImages)
    }
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
    // Reine Bild-Pastes → TipTap als Inline-`<img>` (base64), nicht nur Attachment-Chip.
    if (files.every((f) => f.type.startsWith('image/'))) return
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
      setEditEventType(null)
      setEditEventTypeLoaded(false)
      return
    }
    if (initialEvent.source === 'google' && !initialEvent.graphCalendarId?.trim()) {
      setMsEventDetailsLoading(false)
      setMsEventDetailsError(t('calendar.eventDialog.googleCalendarIdMissing'))
      setAttendeeInput('')
      setEditEventType(null)
      setEditEventTypeLoaded(false)
      return
    }

    let cancelled = false
    loadedDescriptionBaselineRef.current = null
    setMsEventDetailsLoading(true)
    setMsEventDetailsError(null)
    setEditEventType(null)
    setEditEventTypeLoaded(false)
    setTeamsMeeting(!!initialEvent.joinUrl && !initialEvent.isAllDay)
    setDialogJoinUrl(
      preferTeamsJoinUrl({
        joinUrl: initialEvent.joinUrl,
        bodyHtml: null
      })
    )

    const applyEventDetails = (
      d: Awaited<ReturnType<typeof window.mailClient.calendar.getEvent>>,
      opts: { allowOverwriteDescription: boolean; resolveInlineImages: boolean }
    ): void => {
      if (cancelled) return
      if (d.chronellWebinarInvitation) {
        setChronellWebinarInvitation(true)
        setWebinarMode(true)
      }
      setTeamsMeeting(!!d.isOnlineMeeting && !initialEvent.isAllDay)
      {
        const nextJoin = preferTeamsJoinUrl({
          joinUrl: d.joinUrl,
          bodyHtml: d.bodyHtml
        })
        // Stale Cache ohne Join-URL darf eine bereits bekannte URL nicht loeschen.
        if (nextJoin || !getDialogJoinUrl()?.trim()) {
          setDialogJoinUrl(nextJoin)
        }
      }
      setAttendeeInput(
        formatRecipientsWithTail(
          d.attendeeEmails.map((email) => ({ address: email })),
          ''
        )
      )
      setOptionalAttendeeInput(
        formatRecipientsWithTail(
          (d.optionalAttendeeEmails ?? []).map((email) => ({ address: email })),
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
        if (d.chronellWebinarInvitation) {
          applyWebinarTrackingDefaults({
            setHideAttendees,
            setResponseRequested,
            setAllowForwarding
          })
        } else {
          setHideAttendees(d.hideAttendees === true)
          setResponseRequested(d.responseRequested !== false)
          setAllowForwarding(d.allowForwarding !== false)
        }
      }
      const loadedTimeZone = normalizeEventTimeZoneHint(d.timeZone)
      if (!initialEvent.isAllDay && loadedTimeZone) {
        setEventTimeZone(loadedTimeZone)
        setDtStart(utcIsoToEventDatetimeLocal(initialEvent.startIso, loadedTimeZone))
        setDtEnd(utcIsoToEventDatetimeLocal(initialEvent.endIso, loadedTimeZone))
      }
      setEditEventType(d.eventType ?? 'singleInstance')
      setEditEventTypeLoaded(true)
      setEditSeriesMasterId(d.seriesMasterId?.trim() || null)
      setEventShowAs(d.showAs ?? DEFAULT_CALENDAR_EVENT_SHOW_AS)
      setEventIsPrivate(calendarEventSensitivityIsPrivate(d.sensitivity))
      if (initialEvent.source === 'google') {
        setHideAttendees(false)
        setResponseRequested(true)
        setAllowForwarding(true)
      }
      const rec = d.recurrence ?? null
      setLoadedRecurrence(rec)
      if (rec) {
        setRecurFreq(rec.frequency)
        setRecurEnd(rec.rangeEnd)
        setRecurUntilDate(rec.untilDate?.trim() || '')
        setRecurCount(rec.count != null ? String(rec.count) : '10')
        setRecurWeekdays(rec.weekdays?.length ? [...rec.weekdays] : [])
      } else {
        setRecurFreq('none')
        setRecurEnd('never')
        setRecurUntilDate('')
        setRecurCount('10')
        setRecurWeekdays([])
      }

      const raw = d.bodyHtml?.trim() ? d.bodyHtml.trim() : ''
      setGraphBodyForPreview(raw || null)
      if (
        d.chronellWebinarInvitation &&
        isWebinarInvitationHtmlLikelyGutted(raw, { chronellWebinarInvitation: true })
      ) {
        pendingWebinarAutoRestoreRef.current = true
      }
      const joinUrlForEditor = preferTeamsJoinUrl({
        joinUrl: d.joinUrl,
        bodyHtml: d.bodyHtml
      })
      const wantsInlineImages =
        initialEvent.source === 'microsoft' &&
        (d.chronellWebinarInvitation ||
          isWebinarInvitationHtml(raw) ||
          /cid:/i.test(raw))
      if (wantsInlineImages && /cid:/i.test(raw) && opts.resolveInlineImages !== false) {
        setWebinarImagesLoading(true)
      }
      void prepareCalendarEventBodyHtmlForAttendeeDisplay(raw, {
        accountId: initialEvent.accountId,
        graphEventId: eventId,
        graphCalendarId: initialEvent.graphCalendarId ?? null,
        resolveInlineImages: wantsInlineImages && opts.resolveInlineImages !== false
      })
        .then((displayHtml) => {
          if (!cancelled) setAttendeeDisplayHtml(displayHtml)
        })
        .catch((err) => {
          console.warn('[calendar] prepareCalendarEventBodyHtmlForAttendeeDisplay:', err)
        })
      void prepareCalendarEventBodyHtmlForEditor(raw, {
        accountId: initialEvent.accountId,
        graphEventId: eventId,
        graphCalendarId: initialEvent.graphCalendarId ?? null,
        resolveInlineImages: wantsInlineImages && opts.resolveInlineImages !== false,
        teamsJoinUrl: joinUrlForEditor
      })
        .then((prepared) => {
        if (cancelled) return
        setDescriptionHtml((prev) => {
          if (
            !opts.allowOverwriteDescription &&
            loadedDescriptionBaselineRef.current != null &&
            prev !== loadedDescriptionBaselineRef.current
          ) {
            return prev
          }
          // Force-Refresh darf Baseline nicht als „dirty“ markieren, wenn User noch nicht tippte.
          if (
            baselineDescriptionRef.current != null &&
            baselineDescriptionRef.current === descriptionSnapshotKey(prev)
          ) {
            baselineDescriptionRef.current = descriptionSnapshotKey(prepared)
            setDebouncedDescriptionKey(baselineDescriptionRef.current)
          }
          loadedDescriptionBaselineRef.current = prepared
          if (isWebinarInvitationHtml(prepared) || d.chronellWebinarInvitation) {
            setWebinarMode(true)
            setChronellWebinarInvitation(!!d.chronellWebinarInvitation)
            const parsed = parseWebinarInvitationHtml(prepared)
            if (parsed.parsed) {
              setWebinarContent({
                title: parsed.title,
                heroImageSrc: parsed.heroImageSrc,
                surveyUrl: parsed.surveyUrl,
                surveyLabel: parsed.surveyLabel,
                websiteUrl: parsed.websiteUrl,
                websiteLabel: parsed.websiteLabel
              })
              if (parsed.title.trim()) {
                setSubject((prev) => prev.trim() || parsed.title.trim())
              }
            }
          }
          return prepared
        })
        armBaselineRef.current = true
      })
        .catch((err) => {
          console.warn('[calendar] prepareCalendarEventBodyHtmlForEditor:', err)
        })
        .finally(() => {
          if (!cancelled) setWebinarImagesLoading(false)
        })
    }

    const loadArgs = {
      accountId: initialEvent.accountId,
      graphEventId: eventId,
      graphCalendarId: initialEvent.graphCalendarId ?? null
    }

    // Cache zuerst → UI schnell; Force-Refresh im Hintergrund.
    void window.mailClient.calendar
      .getEvent({ ...loadArgs, cacheOnly: true })
      .then((cached) => {
        if (cancelled || !calendarEventDetailsLookCached(cached)) return
        const cachedRaw = cached.bodyHtml?.trim() ?? ''
        applyEventDetails(cached, {
          allowOverwriteDescription: true,
          resolveInlineImages:
            cached.chronellWebinarInvitation ||
            isWebinarInvitationHtml(cachedRaw) ||
            /cid:/i.test(cachedRaw)
        })
        setMsEventDetailsLoading(false)
      })
      .catch(() => {
        /* Cache-Miss / Stub — Force-Refresh uebernimmt */
      })

    void window.mailClient.calendar
      .getEvent({ ...loadArgs, forceRefresh: false })
      .then(async (d) => {
        if (cancelled) return
        applyEventDetails(d, {
          allowOverwriteDescription: false,
          resolveInlineImages:
            isWebinarInvitationHtml(d.bodyHtml ?? '') || /cid:/i.test(d.bodyHtml ?? '')
        })
        // Teams-Meeting ohne Join-URL: oft stale Cache nach Speichern — Force-Refresh.
        if (
          d.isOnlineMeeting &&
          !preferTeamsJoinUrl({ joinUrl: d.joinUrl, bodyHtml: d.bodyHtml })?.trim()
        ) {
          for (let attempt = 0; attempt < 3; attempt++) {
            if (cancelled) return
            if (attempt > 0) {
              await new Promise<void>((resolve) => setTimeout(resolve, attempt === 1 ? 400 : 800))
            }
            try {
              const fresh = await window.mailClient.calendar.getEvent({
                ...loadArgs,
                forceRefresh: true
              })
              if (cancelled) return
              const join = preferTeamsJoinUrl({
                joinUrl: fresh.joinUrl,
                bodyHtml: fresh.bodyHtml
              })
              if (join) {
                applyEventDetails(fresh, {
                  allowOverwriteDescription: false,
                  resolveInlineImages: false
                })
                break
              }
            } catch {
              break
            }
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        setMsEventDetailsError(err instanceof Error ? err.message : String(err))
        if (loadedDescriptionBaselineRef.current == null) {
          setAttendeeInput('')
          setDescriptionHtml('')
          setEditEventType(null)
          setEditEventTypeLoaded(false)
          setEditSeriesMasterId(null)
          setLoadedRecurrence(null)
          armBaselineRef.current = true
        }
      })
      .finally(() => {
        if (!cancelled) setMsEventDetailsLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [open, mode, initialEvent, t])

  useEffect(() => {
    if (!open) return
    if (chronellWebinarInvitation) {
      setWebinarMode(true)
      return
    }
    if (
      isWebinarInvitationHtml(descriptionHtml) ||
      isWebinarInvitationHtml(graphBodyForPreview ?? '')
    ) {
      setWebinarMode(true)
    }
  }, [open, chronellWebinarInvitation, descriptionHtml, graphBodyForPreview])

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

  const resolveEventScheduleIsos = useCallback((): { startIso: string; endIso: string } | null => {
    try {
      if (isAllDay) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dayStart) || !/^\d{4}-\d{2}-\d{2}$/.test(dayEnd)) {
          return null
        }
        if (dayEnd <= dayStart) return null
        return { startIso: dayStart, endIso: dayEnd }
      }
      const invalid = t('calendar.eventDialog.invalidDate')
      const startIso = eventDatetimeLocalToUtcIso(dtStart, eventTimeZone, invalid)
      const endIso = eventDatetimeLocalToUtcIso(dtEnd, eventTimeZone, invalid)
      if (new Date(endIso) <= new Date(startIso)) return null
      return { startIso, endIso }
    } catch {
      return null
    }
  }, [isAllDay, dayStart, dayEnd, dtStart, dtEnd, eventTimeZone, t])

  const applyTeamsMeetingBodyFromServer = useCallback(
    async (input: {
      accountId: string
      graphEventId: string
      graphCalendarId: string | null
      joinUrl: string | null
      bodyHtml: string | null
    }): Promise<void> => {
      const joinUrl = preferTeamsJoinUrl({
        joinUrl: input.joinUrl,
        bodyHtml: input.bodyHtml
      })
      if (joinUrl) setDialogJoinUrl(joinUrl)

      const teamsBlockRaw = extractTeamsMeetingJoinBlockHtml(input.bodyHtml) || ''

      let appendHtml = ''
      if (teamsBlockRaw) {
        // Ohne Inline-Bilder — CID spaeter lazy, damit Tippen nicht blockiert.
        appendHtml = await prepareCalendarEventBodyHtmlForEditor(teamsBlockRaw, {
          accountId: input.accountId,
          graphEventId: input.graphEventId,
          graphCalendarId: input.graphCalendarId,
          resolveInlineImages: false
        })
      } else if (joinUrl) {
        const safeHref = joinUrl
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
        const linkLabel = t('calendar.eventDialog.teamsJoinLinkLabel')
        appendHtml = `<p><a href="${safeHref}">${linkLabel}</a></p>`
      }

      if (!appendHtml) return

      setDescriptionHtml((prev) => {
        if (isWebinarInvitationHtml(prev)) {
          // Idempotent: immer genau einen Slot, keine doppelten Platzhalter.
          return restoreWebinarTeamsSlotForEditor(prev, joinUrl)
        }
        if (htmlAlreadyHasTeamsMeetingJoinBlock(prev, joinUrl)) return prev
        if (isEffectivelyEmptyEditorHtml(prev)) return appendHtml
        return `${prev.trim()}${appendHtml}`
      })

      if (/cid:/i.test(appendHtml)) {
        void resolveCalendarEventInlineCidImages(appendHtml, {
          accountId: input.accountId,
          graphEventId: input.graphEventId,
          graphCalendarId: input.graphCalendarId
        }).then((withImages) => {
          if (withImages === appendHtml) return
          setDescriptionHtml((prev) => {
            if (!prev.includes(appendHtml)) return prev
            return prev.replace(appendHtml, withImages)
          })
        })
      }
    },
    [t]
  )

  /** Poll nur wenn noch keine Join-URL da ist — bricht bei erster brauchbarer URL ab (auch lang). */
  const loadTeamsMeetingDetailsAfterWrite = useCallback(
    async (input: {
      accountId: string
      graphEventId: string
      graphCalendarId: string | null
      /** Bereits bekannte URL — dann kein Poll. */
      seedJoinUrl?: string | null
    }): Promise<{ joinUrl: string | null; bodyHtml: string | null }> => {
      const seed = input.seedJoinUrl?.trim() || null
      if (seed) {
        return { joinUrl: seed, bodyHtml: null }
      }
      let joinUrl: string | null = null
      let bodyHtml: string | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, attempt === 1 ? 400 : 800))
        }
        const d = await window.mailClient.calendar.getEvent({
          accountId: input.accountId,
          graphEventId: input.graphEventId,
          graphCalendarId: input.graphCalendarId,
          forceRefresh: true
        })
        bodyHtml = d.bodyHtml?.trim() || null
        joinUrl = preferTeamsJoinUrl({
          joinUrl: d.joinUrl,
          bodyHtml
        })
        if (joinUrl) break
      }
      return { joinUrl, bodyHtml }
    },
    []
  )

  /**
   * Short-Link + Teams-Body nach Unlock: max. 1 Retry, blockiert die UI nicht.
   */
  const enrichTeamsMeetingInBackground = useCallback(
    (input: {
      accountId: string
      graphEventId: string
      graphCalendarId: string | null
      seedJoinUrl?: string | null
      seedBodyHtml?: string | null
    }): void => {
      void (async () => {
        try {
          let joinUrl = preferTeamsJoinUrl({
            joinUrl: input.seedJoinUrl,
            bodyHtml: input.seedBodyHtml
          })
          let bodyHtml = input.seedBodyHtml?.trim() || null

          const needsShortOrBody =
            !bodyHtml || !joinUrl || isTeamsLongMeetupJoinUrl(joinUrl)

          if (needsShortOrBody) {
            const d = await window.mailClient.calendar.getEvent({
              accountId: input.accountId,
              graphEventId: input.graphEventId,
              graphCalendarId: input.graphCalendarId,
              forceRefresh: true
            })
            bodyHtml = d.bodyHtml?.trim() || bodyHtml
            joinUrl = preferTeamsJoinUrl({
              joinUrl: d.joinUrl ?? joinUrl,
              bodyHtml
            })

            // Max. 1 Hintergrund-Retry nur wenn immer noch langer Link / kein Body.
            if (
              (!joinUrl || isTeamsLongMeetupJoinUrl(joinUrl) || !bodyHtml) &&
              d.isOnlineMeeting
            ) {
              await new Promise<void>((resolve) => setTimeout(resolve, 400))
              const d2 = await window.mailClient.calendar.getEvent({
                accountId: input.accountId,
                graphEventId: input.graphEventId,
                graphCalendarId: input.graphCalendarId,
                forceRefresh: true
              })
              bodyHtml = d2.bodyHtml?.trim() || bodyHtml
              joinUrl = preferTeamsJoinUrl({
                joinUrl: d2.joinUrl ?? joinUrl,
                bodyHtml
              })
            }
          }

          await applyTeamsMeetingBodyFromServer({
            accountId: input.accountId,
            graphEventId: input.graphEventId,
            graphCalendarId: input.graphCalendarId,
            joinUrl,
            bodyHtml
          })
        } catch (e) {
          console.warn('[calendar] Teams-Meeting Hintergrund-Anreicherung fehlgeschlagen:', e)
        }
      })()
    },
    [applyTeamsMeetingBodyFromServer]
  )

  const provisionTeamsMeetingNow = useCallback(async (opts?: {
    force?: boolean
    /** Explizite Vorlage (State kann beim setTimeout noch alt sein). */
    templateId?: string
  }): Promise<boolean> => {
    if (isAllDay) return false
    if (!accountId.startsWith('ms:')) return false

    const inflight = teamsProvisionInflightRef.current
    if (inflight) {
      // Parallel-Speichern wartet auf dieselbe Provision statt „Link fehlt“.
      if (!opts?.force) return inflight
      await inflight.catch(() => false)
    }
    if (getDialogJoinUrl()?.trim() && !opts?.force) return true

    const schedule = resolveEventScheduleIsos()
    if (!schedule) {
      setLocalError(t('calendar.eventDialog.teamsNeedValidSchedule'))
      setTeamsMeeting(false)
      return false
    }

    const run = (async (): Promise<boolean> => {

    const subjectForSave = subject.trim() || t('calendar.eventDialog.untitled')
    const descriptionForProvision =
      webinarHtmlEditorFlushRef.current?.() ?? descriptionHtml
    const isWebinarProvision =
      webinarMode ||
      chronellWebinarInvitation ||
      isWebinarInvitationHtml(descriptionForProvision)
    const resolvedBody = resolveCalendarEventBodyForGraph(descriptionForProvision, {
      isWebinar: isWebinarProvision
    })
    let bodyHtml = resolvedBody.bodyHtml
    let provisionInlineAttachments = resolvedBody.inlineAttachments
    // Wichtig: Provision OHNE Attendees — sonst sendet Graph sofort Einladungen.
    const calId = graphCalendarId.trim() || null
    const selectedTemplateId = (opts?.templateId ?? teamsMeetingTemplateId).trim()

    setTeamsProvisioning(true)
    setLocalError(null)
    setMsEventDetailsError(null)
    try {
      let graphEventId: string | null =
        (mode === 'edit' ? initialEvent?.graphEventId?.trim() : null) ||
        provisionedEventId?.trim() ||
        null

      // Teams Premium: OnlineMeeting mit Vorlage, Kalender ohne zweites isOnlineMeeting.
      if (selectedTemplateId) {
        const online = await window.mailClient.calendar.createOnlineMeetingWithTemplate({
          accountId: mode === 'edit' ? (initialEvent?.accountId ?? accountId) : accountId,
          subject: subjectForSave,
          startIso: schedule.startIso,
          endIso: schedule.endIso,
          meetingTemplateId: selectedTemplateId
        })
        const joinUrl = preferTeamsJoinUrl({
          joinUrl: online.joinUrl,
          joinInformationHtml: online.joinInformationHtml
        })
        if (joinUrl) setDialogJoinUrl(joinUrl)
        setTeamsProvisionedWithTemplate(true)

        let mergedBody = bodyHtml
        if (isWebinarProvision && !isEffectivelyEmptyEditorHtml(descriptionForProvision)) {
          const webinarMerged = mergeWebinarBodyWithTeamsProvision(
            descriptionForProvision,
            online.joinInformationHtml,
            joinUrl,
            t('calendar.eventDialog.teamsJoinLinkLabel')
          )
          mergedBody = webinarMerged.bodyHtml
          provisionInlineAttachments = webinarMerged.inlineAttachments
        } else {
          const joinHtml = cleanTeamsMeetingJoinInformationHtml(
            online.joinInformationHtml?.trim() || ''
          )
          if (joinHtml) {
            mergedBody = isEffectivelyEmptyEditorHtml(descriptionHtml)
              ? joinHtml
              : `${descriptionHtml.trim()}${joinHtml}`
          } else if (joinUrl && (!mergedBody || isEffectivelyEmptyEditorHtml(descriptionHtml))) {
            const safeHref = joinUrl
              .replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/</g, '&lt;')
            mergedBody = `<p><a href="${safeHref}">${t('calendar.eventDialog.teamsJoinLinkLabel')}</a></p>`
          }
        }

        const locationForSave =
          location.trim() || t('calendar.eventDialog.teamsMeetingToggle')

        if (graphEventId) {
          await window.mailClient.calendar.updateEvent({
            accountId: mode === 'edit' ? (initialEvent?.accountId ?? accountId) : accountId,
            graphEventId,
            graphCalendarId:
              mode === 'edit' ? (initialEvent?.graphCalendarId ?? calId) : calId,
            subject: subjectForSave,
            startIso: schedule.startIso,
            endIso: schedule.endIso,
            isAllDay: false,
            location: locationForSave,
            bodyHtml: mergedBody,
            ...(provisionInlineAttachments.length > 0
              ? { attachments: provisionInlineAttachments }
              : {}),
            categories: eventCategories,
            teamsMeeting: true,
            hideAttendees,
            responseRequested,
            allowForwarding,
            showAs: eventShowAs,
            sensitivity: calendarEventSensitivityFromPrivate(eventIsPrivate),
            ...graphReminderPayload('microsoft', reminderEnabled, reminderMinutesBefore),
            timeZone: eventTimeZone,
            ...(webinarMode ? { chronellWebinarInvitation: true } : {})
          })
        } else {
          const created = await window.mailClient.calendar.createEvent({
            accountId,
            graphCalendarId: calId,
            subject: subjectForSave,
            startIso: schedule.startIso,
            endIso: schedule.endIso,
            isAllDay: false,
            location: locationForSave,
            bodyHtml: mergedBody,
            ...(provisionInlineAttachments.length > 0
              ? { attachments: provisionInlineAttachments }
              : {}),
            categories: eventCategories,
            teamsMeeting: true,
            hideAttendees,
            responseRequested,
            allowForwarding,
            showAs: eventShowAs,
            sensitivity: calendarEventSensitivityFromPrivate(eventIsPrivate),
            ...graphReminderPayload('microsoft', reminderEnabled, reminderMinutesBefore),
            timeZone: eventTimeZone,
            ...(webinarMode ? { chronellWebinarInvitation: true } : {})
          })
          graphEventId = created.id?.trim() || null
          if (!graphEventId) {
            throw new Error(t('calendar.eventDialog.teamsProvisionFailed'))
          }
          setProvisionedEventId(graphEventId)
          if (!subject.trim()) setSubject(subjectForSave)
        }

        if (!location.trim()) setLocation(locationForSave)

        const detailAccountId =
          mode === 'edit' ? (initialEvent?.accountId ?? accountId) : accountId
        const detailCalId =
          mode === 'edit' ? (initialEvent?.graphCalendarId ?? calId) : calId
        // UI sofort freigeben; Short-Link/Body im Hintergrund.
        enrichTeamsMeetingInBackground({
          accountId: detailAccountId,
          graphEventId,
          graphCalendarId: detailCalId,
          seedJoinUrl: joinUrl,
          seedBodyHtml: mergedBody
        })

        useUndoStore.getState().pushToast({
          label: joinUrl
            ? t('calendar.eventDialog.teamsLinkReadyToast')
            : t('calendar.eventDialog.teamsLinkPendingToast'),
          variant: joinUrl ? 'success' : 'info',
          durationMs: 4000
        })
        armBaselineRef.current = true
        return Boolean(getDialogJoinUrl()?.trim() || joinUrl?.trim())
      }

      let seedJoinUrl: string | null = null

      if (graphEventId) {
        await window.mailClient.calendar.updateEvent({
          accountId: mode === 'edit' ? (initialEvent?.accountId ?? accountId) : accountId,
          graphEventId,
          graphCalendarId:
            mode === 'edit' ? (initialEvent?.graphCalendarId ?? calId) : calId,
          subject: subjectForSave,
          startIso: schedule.startIso,
          endIso: schedule.endIso,
          isAllDay: false,
          location: location.trim() || null,
          bodyHtml,
          ...(provisionInlineAttachments.length > 0
            ? { attachments: provisionInlineAttachments }
            : {}),
          categories: eventCategories,
          teamsMeeting: true,
          hideAttendees,
          responseRequested,
          allowForwarding,
          showAs: eventShowAs,
          sensitivity: calendarEventSensitivityFromPrivate(eventIsPrivate),
          ...graphReminderPayload('microsoft', reminderEnabled, reminderMinutesBefore),
          timeZone: eventTimeZone,
          ...(webinarMode ? { chronellWebinarInvitation: true } : {})
        })
        // Update + Main-Refresh: Join-URL oft schon im Cache — kein Force-Poll.
        const cached = await window.mailClient.calendar.getEvent({
          accountId: mode === 'edit' ? (initialEvent?.accountId ?? accountId) : accountId,
          graphEventId,
          graphCalendarId:
            mode === 'edit' ? (initialEvent?.graphCalendarId ?? calId) : calId,
          forceRefresh: false
        })
        seedJoinUrl = preferTeamsJoinUrl({
          joinUrl: cached.joinUrl,
          bodyHtml: cached.bodyHtml
        })
      } else {
        const created = await window.mailClient.calendar.createEvent({
          accountId,
          graphCalendarId: calId,
          subject: subjectForSave,
          startIso: schedule.startIso,
          endIso: schedule.endIso,
          isAllDay: false,
          location: location.trim() || null,
          bodyHtml,
          ...(provisionInlineAttachments.length > 0
            ? { attachments: provisionInlineAttachments }
            : {}),
          categories: eventCategories,
          teamsMeeting: true,
          hideAttendees,
          responseRequested,
          allowForwarding,
          showAs: eventShowAs,
          sensitivity: calendarEventSensitivityFromPrivate(eventIsPrivate),
          ...graphReminderPayload('microsoft', reminderEnabled, reminderMinutesBefore),
          timeZone: eventTimeZone,
          ...(webinarMode ? { chronellWebinarInvitation: true } : {})
        })
        graphEventId = created.id?.trim() || null
        if (!graphEventId) {
          throw new Error(t('calendar.eventDialog.teamsProvisionFailed'))
        }
        setProvisionedEventId(graphEventId)
        if (!subject.trim()) setSubject(subjectForSave)
        seedJoinUrl = preferTeamsJoinUrl({
          joinUrl: created.joinUrl
        })
      }

      setTeamsProvisionedWithTemplate(false)

      const detailAccountId =
        mode === 'edit' ? (initialEvent?.accountId ?? accountId) : accountId
      const detailCalId =
        mode === 'edit' ? (initialEvent?.graphCalendarId ?? calId) : calId

      // Poll nur wenn noch keine Join-URL — sonst UI sofort entsperren.
      if (!seedJoinUrl) {
        const details = await loadTeamsMeetingDetailsAfterWrite({
          accountId: detailAccountId,
          graphEventId,
          graphCalendarId: detailCalId
        })
        seedJoinUrl = details.joinUrl
      }

      if (seedJoinUrl) {
        setDialogJoinUrl(seedJoinUrl)
      }

      enrichTeamsMeetingInBackground({
        accountId: detailAccountId,
        graphEventId,
        graphCalendarId: detailCalId,
        seedJoinUrl
      })

      if (seedJoinUrl?.trim()) {
        useUndoStore.getState().pushToast({
          label: t('calendar.eventDialog.teamsLinkReadyToast'),
          variant: 'success',
          durationMs: 4000
        })
      } else {
        useUndoStore.getState().pushToast({
          label: t('calendar.eventDialog.teamsLinkPendingToast'),
          variant: 'info',
          durationMs: 5000
        })
      }
      armBaselineRef.current = true
      return Boolean(getDialogJoinUrl()?.trim())
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setLocalError(msg)
      setMsEventDetailsError(msg)
      setTeamsMeeting(false)
      return false
    } finally {
      setTeamsProvisioning(false)
    }
    })()

    teamsProvisionInflightRef.current = run
    void run.finally(() => {
      if (teamsProvisionInflightRef.current === run) {
        teamsProvisionInflightRef.current = null
      }
    })
    return run
  }, [
    isAllDay,
    accountId,
    getDialogJoinUrl,
    resolveEventScheduleIsos,
    t,
    subject,
    descriptionHtml,
    graphCalendarId,
    mode,
    initialEvent,
    provisionedEventId,
    location,
    eventCategories,
    hideAttendees,
    responseRequested,
    allowForwarding,
    eventShowAs,
    eventIsPrivate,
    reminderEnabled,
    reminderMinutesBefore,
    eventTimeZone,
    teamsMeetingTemplateId,
    loadTeamsMeetingDetailsAfterWrite,
    enrichTeamsMeetingInBackground,
    webinarMode,
    chronellWebinarInvitation
  ])

  const handleTeamsMeetingChange = useCallback(
    (checked: boolean): void => {
      if (!checked) {
        setTeamsMeeting(false)
        if (location.trim().toLowerCase() === 'online') {
          setLocation('')
        }
        return
      }
      setTeamsMeeting(true)
      // Bestehenden Link nicht neu erzwingen — nur anlegen wenn noch keiner da ist.
      void provisionTeamsMeetingNow({ force: false })
    },
    [location, provisionTeamsMeetingNow]
  )

  const handleTeamsTemplateChange = useCallback(
    (nextTemplateId: string): void => {
      setTeamsMeetingTemplateId(nextTemplateId)
      if (isAllDay || !accountId.startsWith('ms:')) return
      if (nextTemplateId.trim()) {
        setTeamsMeeting(true)
        window.setTimeout((): void => {
          void provisionTeamsMeetingNow({ force: true, templateId: nextTemplateId })
        }, 0)
        return
      }
      if (teamsMeeting) {
        window.setTimeout((): void => {
          void provisionTeamsMeetingNow({ force: true, templateId: '' })
        }, 0)
      }
    },
    [isAllDay, accountId, teamsMeeting, provisionTeamsMeetingNow]
  )

  // Vorlage / Prefill: Teams sofort anlegen, sobald Konto und Zeit stehen.
  useEffect(() => {
    if (!open || !autoProvisionTeamsRef.current) return
    if (isAllDay || !accountId.startsWith('ms:') || calendarsLoading) return
    if (teamsProvisioning || getDialogJoinUrl()?.trim()) {
      autoProvisionTeamsRef.current = false
      return
    }
    autoProvisionTeamsRef.current = false
    void provisionTeamsMeetingNow()
  }, [
    open,
    isAllDay,
    accountId,
    calendarsLoading,
    teamsProvisioning,
    getDialogJoinUrl,
    provisionTeamsMeetingNow
  ])

  useEffect(() => {
    if (!open) return
    const refresh = (): void => setTeamsMeetingTemplates(readTeamsMeetingTemplates())
    refresh()
    window.addEventListener('mailclient:teams-meeting-templates-changed', refresh)
    return (): void =>
      window.removeEventListener('mailclient:teams-meeting-templates-changed', refresh)
  }, [open])

  const applyTemplate = useCallback((tpl: CalendarEventTemplate): void => {
    if (tpl.defaultSubject.trim()) setSubject(tpl.defaultSubject.trim())
    if (tpl.defaultLocation.trim()) setLocation(tpl.defaultLocation.trim())
    if (tpl.descriptionHtml.trim()) setDescriptionHtml(tpl.descriptionHtml)
    const premiumId = tpl.teamsMeetingTemplateId?.trim() || ''
    if (premiumId) setTeamsMeetingTemplateId(premiumId)
    if ((tpl.teamsMeeting || premiumId) && !isAllDay) {
      setTeamsMeeting(true)
      window.setTimeout((): void => {
        void provisionTeamsMeetingNow({ force: true, templateId: premiumId })
      }, 0)
    }
    if (tpl.reminderMinutes >= 0) {
      setReminderEnabled(true)
      setReminderMinutesBefore(tpl.reminderMinutes)
    }
    if (tpl.durationMinutes > 0 && dtStart.trim()) {
      setDtEnd(addMinutesInEventZone(dtStart, tpl.durationMinutes, eventTimeZone))
    }
    if (tpl.hideAttendees === true || tpl.hideAttendees === false) {
      setHideAttendees(tpl.hideAttendees)
    }
    if (tpl.responseRequested === true || tpl.responseRequested === false) {
      setResponseRequested(tpl.responseRequested)
    }
    if (tpl.allowForwarding === true || tpl.allowForwarding === false) {
      setAllowForwarding(tpl.allowForwarding)
    }
  }, [dtStart, eventTimeZone, isAllDay, provisionTeamsMeetingNow])

  const applyTemplateById = useCallback(
    (id: string): void => {
      const fresh = readCalendarEventTemplates()
      setTemplates(fresh)
      const tpl = fresh.find((x) => x.id === id)
      if (tpl) applyTemplate(tpl)
    },
    [applyTemplate]
  )

  useEffect(() => {
    if (!open) return
    const refresh = (): void => setTemplates(readCalendarEventTemplates())
    refresh()
    window.addEventListener('mailclient:calendar-templates-changed', refresh)
    return (): void => window.removeEventListener('mailclient:calendar-templates-changed', refresh)
  }, [open])

  const saveCurrentAsTemplate = useCallback(async (): Promise<void> => {
    const name = await showAppPrompt(t('calendar.eventDialog.saveAsTemplatePrompt'), {
      title: t('calendar.eventDialog.saveAsTemplateTitle'),
      defaultValue: subject.trim() || t('calendar.eventDialog.untitled'),
      confirmLabel: t('common.save')
    })
    if (name == null || !name.trim()) return
    const tpl = createEmptyTemplate()
    tpl.name = name.trim().slice(0, 60)
    tpl.emoji = teamsMeeting ? '🎥' : '📅'
    tpl.defaultSubject = subject.trim()
    tpl.defaultLocation = location.trim()
    tpl.descriptionHtml = descriptionHtml
    tpl.teamsMeeting = teamsMeeting
    tpl.teamsMeetingTemplateId = teamsMeetingTemplateId.trim()
    tpl.durationMinutes = 0
    tpl.reminderMinutes = reminderEnabled ? reminderMinutesBefore : -1
    tpl.hideAttendees = hideAttendees
    tpl.responseRequested = responseRequested
    tpl.allowForwarding = allowForwarding
    saveCalendarEventTemplate(tpl)
    setTemplates(readCalendarEventTemplates())
  }, [
    t,
    subject,
    location,
    descriptionHtml,
    teamsMeeting,
    teamsMeetingTemplateId,
    reminderEnabled,
    reminderMinutesBefore,
    hideAttendees,
    responseRequested,
    allowForwarding
  ])

  const toggleModalMaximize = useCallback((): void => {
    if (modalMaximized) {
      const prev = modalSizeBeforeMaximizeRef.current
      if (prev) setModalSize(prev)
      setModalMaximized(false)
      return
    }
    modalSizeBeforeMaximizeRef.current = { ...modalSizeRef.current }
    const margin = 16
    setModalSize({
      w: Math.max(640, window.innerWidth - margin * 2),
      h: Math.max(480, window.innerHeight - margin * 2)
    })
    setModalMaximized(true)
  }, [modalMaximized])

  const msTeamsUiLocked = useMemo(
    () =>
      eventFieldsLocked ||
      teamsProvisioning ||
      (mode === 'edit' && initialEvent?.source === 'microsoft' && msEventDetailsLoading),
    [eventFieldsLocked, teamsProvisioning, mode, initialEvent?.source, msEventDetailsLoading]
  )

  const onModalResizeMove = useCallback((e: PointerEvent): void => {
    const d = modalResizeDragRef.current
    if (!d) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 24
    const maxW = Math.min(vw - margin, vw - margin)
    const maxH = Math.min(vh - margin, vh - margin)
    const w = Math.min(maxW, Math.max(640, d.startW + (e.clientX - d.startX)))
    const h = Math.min(maxH, Math.max(480, d.startH + (e.clientY - d.startY)))
    setModalMaximized(false)
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

  const { settings: aiSettings } = useAiConnectionsSettings()
  const workIqAvailable = useWorkIqAvailable(
    accountId.startsWith('ms:') ? accountId : null
  )
  const copilotAvailable =
    !isTaskCreate &&
    listCopilotEngineOptions({
      microsoftAccount: accountId.startsWith('ms:'),
      aiSettings,
      workIqAvailable
    }).length > 0

  const fieldsSnapshot = useMemo(
    () =>
      JSON.stringify({
        subject: subject.trim(),
        location: location.trim(),
        isAllDay,
        dayStart,
        dayEnd,
        dtStart,
        dtEnd,
        eventTimeZone,
        teamsMeeting,
        attendeeInput: attendeeInput.trim(),
        optionalAttendeeInput: optionalAttendeeInput.trim(),
        reminderEnabled,
        reminderMinutesBefore,
        eventShowAs,
        eventIsPrivate,
        eventCategories: [...eventCategories].sort((a, b) => a.localeCompare(b)).join('\u0001'),
        hideAttendees,
        responseRequested,
        allowForwarding,
        recurFreq,
        recurEnd,
        recurUntilDate,
        recurCount,
        recurWeekdays: [...recurWeekdays].sort().join(','),
        eventIconId: eventIconId ?? '',
        destinationSelectValue,
        createKind,
        taskAccountId,
        taskListId,
        taskDue,
        taskPlannedStart,
        taskPlannedEnd,
        taskNotes: taskNotes.trim()
      }),
    [
      subject,
      location,
      isAllDay,
      dayStart,
      dayEnd,
      dtStart,
      dtEnd,
      eventTimeZone,
      teamsMeeting,
      attendeeInput,
      optionalAttendeeInput,
      reminderEnabled,
      reminderMinutesBefore,
      eventShowAs,
      eventIsPrivate,
      eventCategories,
      hideAttendees,
      responseRequested,
      allowForwarding,
      recurFreq,
      recurEnd,
      recurUntilDate,
      recurCount,
      recurWeekdays,
      eventIconId,
      destinationSelectValue,
      createKind,
      taskAccountId,
      taskListId,
      taskDue,
      taskPlannedStart,
      taskPlannedEnd,
      taskNotes
    ]
  )

  /** Description erst nach kurzer Pause in den Dirty-Check — Tippen bleibt leicht. */
  const [debouncedDescriptionKey, setDebouncedDescriptionKey] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDescriptionKey(descriptionSnapshotKey(descriptionHtml))
    }, 280)
    return (): void => {
      window.clearTimeout(timer)
    }
  }, [descriptionHtml])

  useEffect(() => {
    if (!open) {
      baselineFieldsRef.current = null
      baselineDescriptionRef.current = null
      armBaselineRef.current = false
      calendarsWereLoadingRef.current = false
      loadedDescriptionBaselineRef.current = null
      setDebouncedDescriptionKey('')
    }
  }, [open])

  useEffect(() => {
    if (!open || !armBaselineRef.current) return
    armBaselineRef.current = false
    baselineFieldsRef.current = fieldsSnapshot
    baselineDescriptionRef.current = descriptionSnapshotKey(descriptionHtml)
    setDebouncedDescriptionKey(baselineDescriptionRef.current)
  }, [fieldsSnapshot, descriptionHtml, open])

  useEffect(() => {
    if (!open) return
    if (calendarsLoading) {
      calendarsWereLoadingRef.current = true
      return
    }
    if (calendarsWereLoadingRef.current && mode === 'create') {
      calendarsWereLoadingRef.current = false
      armBaselineRef.current = true
    }
  }, [open, calendarsLoading, mode])

  const requestClose = useCallback((): void => {
    if (busy) return
    const fieldsDirty =
      baselineFieldsRef.current != null && fieldsSnapshot !== baselineFieldsRef.current
    const descriptionDirty =
      baselineDescriptionRef.current != null &&
      debouncedDescriptionKey !== baselineDescriptionRef.current
    const dirty = fieldsDirty || descriptionDirty
    if (!dirty) {
      onClose()
      return
    }
    void (async (): Promise<void> => {
      const hasInvite =
        !isTaskCreate &&
        (attendeeEmailsFromField(attendeeInput).length > 0 ||
          attendeeEmailsFromField(optionalAttendeeInput).length > 0)
      const choice = await showAppChoice(t('calendar.eventDialog.unsavedBody'), {
        title: t('calendar.eventDialog.unsavedTitle'),
        cancelLabel: t('calendar.eventDialog.unsavedKeepEditing'),
        actions: [
          {
            id: 'save',
            label: hasInvite
              ? t('calendar.eventDialog.send')
              : t('calendar.eventDialog.save'),
            variant: 'primary'
          },
          {
            id: 'discard',
            label: t('calendar.eventDialog.unsavedDiscard'),
            variant: 'secondary'
          }
        ]
      })
      if (choice === 'discard') {
        onClose()
        return
      }
      if (choice === 'save') {
        const form = panelRef.current?.querySelector('form')
        if (form instanceof HTMLFormElement) {
          form.requestSubmit()
        }
      }
    })()
  }, [
    attendeeInput,
    busy,
    debouncedDescriptionKey,
    fieldsSnapshot,
    isTaskCreate,
    onClose,
    optionalAttendeeInput,
    t
  ])

  const formatWebinarScheduleLabel = useCallback((): string | null => {
    if (isAllDay) {
      if (!dayStart) return null
      try {
        return new Intl.DateTimeFormat(i18n.language, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }).format(parseISO(dayStart))
      } catch {
        return dayStart
      }
    }
    if (!dtStart.trim() || !dtEnd.trim()) return null
    try {
      const invalid = t('calendar.eventDialog.invalidDate')
      const startIso = eventDatetimeLocalToUtcIso(dtStart, eventTimeZone, invalid)
      const endIso = eventDatetimeLocalToUtcIso(dtEnd, eventTimeZone, invalid)
      const dayFmt = new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: eventTimeZone
      })
      const timeFmt = new Intl.DateTimeFormat(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: eventTimeZone
      })
      return `${dayFmt.format(new Date(startIso))} | ${timeFmt.format(new Date(startIso))} – ${timeFmt.format(new Date(endIso))}`
    } catch {
      return null
    }
  }, [dayStart, dtEnd, dtStart, eventTimeZone, i18n.language, isAllDay, t])

  const buildCurrentWebinarInvitationHtml = useCallback(
    (theme: WebinarLayoutThemeId = webinarLayoutTheme): string => {
      const defaults = readWebinarInvitationDefaults()
      const title = webinarContent.title.trim() || subject.trim()
      const layoutTpl = getWebinarInvitationLayoutTemplateById(webinarLayoutTemplateId)
      return buildWebinarInvitationHtml({
        title,
        heroImageSrc: webinarContent.heroImageSrc ?? defaults.defaultHeroImageSrc,
        surveyUrl: webinarContent.surveyUrl.trim() || defaults.defaultSurveyUrl,
        surveyLabel:
          webinarContent.surveyLabel.trim() ||
          defaults.surveyLabel ||
          t('calendar.eventDialog.webinarFieldSurveyLabelPlaceholder'),
        websiteUrl: webinarContent.websiteUrl.trim() || defaults.defaultWebsiteUrl,
        websiteLabel:
          webinarContent.websiteLabel.trim() ||
          defaults.websiteLabel ||
          t('calendar.eventDialog.webinarFieldWebsiteLabelPlaceholder'),
        scheduleLabel: formatWebinarScheduleLabel(),
        teamsJoinUrl: getDialogJoinUrl(),
        greetingHtml: defaults.greetingHtml,
        tipsHtml: defaults.tipsHtml,
        signOffHtml: defaults.signOffHtml,
        supplementHtml: webinarSupplementHtml,
        layoutHtmlTemplate: resolveWebinarLayoutTemplateHtml(layoutTpl),
        layoutTheme: theme,
        signatureHtml: defaults.signatureHtml
      })
    },
    [
      formatWebinarScheduleLabel,
      getDialogJoinUrl,
      subject,
      t,
      webinarContent,
      webinarLayoutTemplateId,
      webinarLayoutTheme,
      webinarSupplementHtml
    ]
  )

  const applyWebinarInvitationHtml = useCallback((): void => {
    const title = webinarContent.title.trim() || subject.trim()
    if (title && title !== subject.trim()) {
      setSubject(title)
    }
    const nextHtml = buildCurrentWebinarInvitationHtml()
    setDescriptionHtml(nextHtml)
    setAttendeeDisplayHtml('')
    useUndoStore.getState().pushToast({
      label: t('calendar.eventDialog.webinarLayoutRestoredToast'),
      variant: 'info',
      durationMs: 6000
    })
  }, [buildCurrentWebinarInvitationHtml, subject, t, webinarContent.title])

  const openWebinarTemplateDialog = useCallback((): void => {
    setWebinarContent((prev) => ({
      ...prev,
      title: subject.trim() || prev.title.trim()
    }))
    const defaults = readWebinarInvitationDefaults()
    setWebinarLayoutTheme(resolveDefaultWebinarLayoutTheme(defaults))
    setWebinarLayoutTemplateId(
      defaults.defaultLayoutTemplateId ?? WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
    )
    setWebinarTemplateDialogOpen(true)
  }, [subject])

  useEffect(() => {
    if (!webinarMode || !subject.trim()) return
    setWebinarContent((prev) => {
      if (prev.title.trim()) return prev
      return { ...prev, title: subject.trim() }
    })
  }, [subject, webinarMode])

  useEffect(() => {
    if (!open || !pendingWebinarAutoRestoreRef.current) return
    if (msEventDetailsLoading || webinarImagesLoading) return
    pendingWebinarAutoRestoreRef.current = false
    applyWebinarInvitationHtml()
  }, [
    applyWebinarInvitationHtml,
    msEventDetailsLoading,
    open,
    webinarImagesLoading
  ])

  useEffect(() => {
    if (!open || !pendingWebinarPrefillApplyRef.current) return
    if (!webinarMode) return
    // Warte auf State nach createPrefill (sonst leere Einladung).
    if (
      !webinarContent.title.trim() &&
      !webinarContent.heroImageSrc &&
      !webinarContent.websiteUrl.trim() &&
      !webinarSupplementHtml?.trim()
    ) {
      return
    }
    pendingWebinarPrefillApplyRef.current = false
    setChronellWebinarInvitation(true)
    applyWebinarInvitationHtml()
  }, [
    applyWebinarInvitationHtml,
    open,
    webinarContent.heroImageSrc,
    webinarContent.title,
    webinarContent.websiteUrl,
    webinarMode,
    webinarSupplementHtml
  ])

  const webinarScheduleLabel = useMemo(
    () => formatWebinarScheduleLabel(),
    [formatWebinarScheduleLabel]
  )

  useEffect(() => {
    if (!open) return
    if (!webinarScheduleLabel) return
    if (!webinarMode && !chronellWebinarInvitation) return
    setDescriptionHtml((prev) => {
      if (!isWebinarInvitationHtml(prev)) return prev
      const next = patchWebinarInvitationScheduleLabel(prev, webinarScheduleLabel)
      return next === prev ? prev : next
    })
  }, [chronellWebinarInvitation, open, webinarMode, webinarScheduleLabel])

  const webinarTitleLabel = useMemo(
    () => webinarContent.title.trim() || subject.trim(),
    [subject, webinarContent.title]
  )

  useEffect(() => {
    if (!open) return
    if (!webinarTitleLabel) return
    if (!webinarMode && !chronellWebinarInvitation) return
    setDescriptionHtml((prev) => {
      if (!isWebinarInvitationHtml(prev)) return prev
      const next = patchWebinarInvitationTitle(prev, webinarTitleLabel)
      return next === prev ? prev : next
    })
  }, [chronellWebinarInvitation, open, webinarMode, webinarTitleLabel])

  const handleRibbonReminderChange = useCallback((enabled: boolean, minutes: number): void => {
    setReminderEnabled(enabled)
    setReminderMinutesBefore(minutes)
  }, [])

  const handleOpenRecurrenceDetails = useCallback((): void => {
    setEventScheduleTab('more')
  }, [])

  const handleTemplatesMenuOpen = useCallback((): void => {
    setTemplates(readCalendarEventTemplates())
  }, [])

  const handleSaveAsTemplateClick = useCallback((): void => {
    void saveCurrentAsTemplate()
  }, [saveCurrentAsTemplate])

  const handleRibbonCopilot = useCallback((): void => {
    setDescriptionCopilotOpen(true)
  }, [])

  const pickEventCategory = useCallback(
    (name: string, multi: boolean): void => {
      const trimmed = name.trim()
      if (!trimmed) return
      setEventCategories((prev) => {
        if (multi) {
          const next = new Set(prev)
          if (next.has(trimmed)) next.delete(trimmed)
          else next.add(trimmed)
          return Array.from(next).sort((a, b) => a.localeCompare(b, collatorLocale))
        }
        if (prev.length === 1 && prev[0] === trimmed) return []
        return [trimmed]
      })
    },
    [collatorLocale]
  )

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

  const handleDeleteEvent = useCallback(async (): Promise<void> => {
    if (mode !== 'edit' || !initialEvent?.graphEventId?.trim()) return
    if (initialEvent.calendarCanEdit === false) return
    const ok = await showAppConfirm(t('calendar.confirm.deleteEventBody'), {
      title: t('calendar.confirm.deleteEventTitle'),
      variant: 'danger',
      confirmLabel: t('calendar.confirm.deleteEventConfirm')
    })
    if (!ok) return
    setBusy(true)
    setLocalError(null)
    try {
      await window.mailClient.calendar.deleteEvent({
        accountId: initialEvent.accountId,
        graphEventId: initialEvent.graphEventId.trim(),
        graphCalendarId: initialEvent.graphCalendarId ?? null
      })
      onSaved()
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [initialEvent, mode, onClose, onSaved, t])

  async function handleSubmit(
    e: React.FormEvent,
    opts?: { notifyAttendees?: boolean }
  ): Promise<void> {
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
    if (webinarMode && !teamsMeeting) {
      setLocalError(t('calendar.eventDialog.webinarNeedTeams'))
      return
    }
    const preflightRequired = attendeeEmailsFromField(attendeeInput)
    const preflightOptional = attendeeEmailsFromField(optionalAttendeeInput)
    const preflightTotal = preflightRequired.length + preflightOptional.length
    if (preflightTotal > MAX_EVENT_DIALOG_ATTENDEES) {
      setLocalError(
        t('calendar.eventDialog.tooManyAttendees', {
          count: preflightTotal,
          max: MAX_EVENT_DIALOG_ATTENDEES,
          defaultValue:
            'Zu viele Teilnehmer ({{count}}, max. {{max}}). Bitte kürzen oder eine Verteilerliste nutzen.'
        })
      )
      return
    }
    if (webinarMode || chronellWebinarInvitation) {
      const defaults = readWebinarInvitationDefaults()
      const survey = (webinarContent.surveyUrl.trim() || defaults.defaultSurveyUrl).trim()
      const website = (webinarContent.websiteUrl.trim() || defaults.defaultWebsiteUrl).trim()
      const badUrl = (u: string): boolean =>
        !!u && !/^https?:\/\//i.test(u) && !/^www\./i.test(u) && !/^mailto:/i.test(u)
      if (badUrl(survey) || badUrl(website)) {
        setLocalError(
          t('calendar.eventDialog.webinarUrlNeedsHttps', {
            defaultValue:
              'Umfrage- und Veranstaltungs-Links müssen mit https:// beginnen (z. B. https://forms.office.com/…).'
          })
        )
        return
      }
    }
    if (
      !isAllDay &&
      teamsMeeting &&
      accountId.startsWith('ms:') &&
      !getDialogJoinUrl()?.trim()
    ) {
      const fromBody = preferTeamsJoinUrl({
        joinUrl: null,
        bodyHtml: webinarHtmlEditorFlushRef.current?.() ?? descriptionHtml
      })
      if (fromBody) setDialogJoinUrl(fromBody)

      // Laufende Provision mitnehmen (nicht parallel abbrechen).
      const inflight = teamsProvisionInflightRef.current
      if (inflight && !getDialogJoinUrl()?.trim()) {
        await inflight.catch(() => false)
      }

      const sendingInvites = opts?.notifyAttendees === true

      if (sendingInvites && !getDialogJoinUrl()?.trim()) {
        const graphEventId =
          (mode === 'edit' ? initialEvent?.graphEventId?.trim() : null) ||
          provisionedEventId?.trim() ||
          null
        if (graphEventId) {
          try {
            const fresh = await window.mailClient.calendar.getEvent({
              accountId: mode === 'edit' ? (initialEvent?.accountId ?? accountId) : accountId,
              graphEventId,
              graphCalendarId:
                mode === 'edit'
                  ? (initialEvent?.graphCalendarId ?? (graphCalendarId.trim() || null))
                  : graphCalendarId.trim() || null,
              forceRefresh: true
            })
            const fromGraph = preferTeamsJoinUrl({
              joinUrl: fresh.joinUrl,
              bodyHtml: fresh.bodyHtml
            })
            if (fromGraph) setDialogJoinUrl(fromGraph)
          } catch {
            /* weiter: ggf. neu provisionieren */
          }
        }

        if (!getDialogJoinUrl()?.trim()) {
          await provisionTeamsMeetingNow({ force: false })
          for (let i = 0; i < 10 && !getDialogJoinUrl()?.trim(); i++) {
            await new Promise<void>((resolve) => setTimeout(resolve, 400))
          }
        }

        if (!getDialogJoinUrl()?.trim()) {
          await provisionTeamsMeetingNow({ force: true })
          for (let i = 0; i < 8 && !getDialogJoinUrl()?.trim(); i++) {
            await new Promise<void>((resolve) => setTimeout(resolve, 400))
          }
        }

        if (!getDialogJoinUrl()?.trim()) {
          setLocalError(t('calendar.eventDialog.teamsNeedJoinUrlBeforeSend'))
          return
        }
      }

      if (getDialogJoinUrl()?.trim()) setLocalError(null)
    }
    if (usesWebinarDescriptionUi && webinarMode) {
      const flushed = webinarHtmlEditorFlushRef.current?.()
      if (flushed != null && !flushed.trim() && !descriptionHtml.trim()) {
        setLocalError(t('calendar.eventDialog.webinarPreviewEmpty'))
        return
      }
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

    const isWebinarSave =
      webinarMode ||
      chronellWebinarInvitation ||
      isWebinarInvitationHtml(descriptionHtml)
    const descriptionForSave = (() => {
      if (!isWebinarSave) return descriptionHtml
      // Kanonische Quelle: Formularfelder + Standardlayout.
      // Editor-Flush kann Sektionen verlieren; Outlook bricht an Teams-Blob leicht ab —
      // deshalb beim Speichern immer frisch aus dem Formular bauen.
      return buildCurrentWebinarInvitationHtml()
    })()

    const bodyPrepared = isEffectivelyEmptyEditorHtml(descriptionForSave)
      ? null
      : prepareCalendarEventDescriptionFromEditorHtml(
          descriptionForSave,
          sanitizeComposeHtmlFragment
        )
    const webinarSaveBundle =
      isWebinarSave && !isEffectivelyEmptyEditorHtml(descriptionForSave)
        ? prepareWebinarInvitationSaveBundle(descriptionForSave)
        : null
    const bodyHtml = webinarSaveBundle?.bodyHtml ?? bodyPrepared
    const attachmentPayload = eventAttachmentsApi.buildSavePayload()
    const mergedAttachments = [
      ...(attachmentPayload.attachments ?? []),
      ...(webinarSaveBundle?.inlineAttachments ?? [])
    ]
    const saveAttachments = {
      ...attachmentPayload,
      ...(mergedAttachments.length > 0 ? { attachments: mergedAttachments } : {})
    }

    const parsedAttendees = attendeeEmailsFromField(attendeeInput)
    const parsedOptionalAttendees = attendeeEmailsFromField(optionalAttendeeInput)
    // Nur bei explizitem Senden Einladungen rausschicken — Speichern = Entwurf.
    const notifyAttendees = opts?.notifyAttendees === true

    let didRescheduleMeeting = false
    if (mode === 'edit' && initialEvent) {
      const previous = {
        startIso: initialEvent.startIso,
        endIso: initialEvent.endIso,
        isAllDay: initialEvent.isAllDay
      }
      const next = { startIso, endIso, isAllDay }
      didRescheduleMeeting = calendarEventScheduleChanged(previous, next)
      const proceed = await confirmEventDialogMeetingReschedule({
        t,
        source: initialEvent.source,
        previous,
        next,
        attendeeEmails: parsedAttendees,
        teamsMeeting: !isAllDay && teamsMeeting,
        joinUrl: getDialogJoinUrl() ?? initialEvent.joinUrl
      })
      if (!proceed) return
    }

    let recurrence: CalendarSaveEventRecurrence | undefined
    if (canSaveRecurrence && recurFreq !== 'none') {
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
    } else if (isExistingSeriesEdit && recurFreq === 'none' && loadedRecurrence) {
      setLocalError(t('calendar.eventDialog.recurrenceSeriesClearUnsupported'))
      return
    }

    const recurrenceDirty =
      recurrence != null &&
      (loadedRecurrence == null ||
        loadedRecurrence.frequency !== recurrence.frequency ||
        loadedRecurrence.rangeEnd !== recurrence.rangeEnd ||
        (loadedRecurrence.untilDate ?? '') !== (recurrence.untilDate ?? '') ||
        (loadedRecurrence.count ?? null) !== (recurrence.count ?? null) ||
        (loadedRecurrence.weekdays ?? []).join(',') !== (recurrence.weekdays ?? []).join(','))

    setBusy(true)
    try {
      const webinarTracking = isWebinarSave
        ? ({ hideAttendees: true, responseRequested: false, allowForwarding: false } as const)
        : ({ hideAttendees, responseRequested, allowForwarding } as const)
      const msWebinarMeta =
        accountId.startsWith('ms:') && isWebinarSave
          ? { chronellWebinarInvitation: true }
          : {}
      let createdForSaved: CalendarEventView | undefined
      if (mode === 'create' && provisionedEventId) {
        await window.mailClient.calendar.updateEvent({
          accountId,
          graphEventId: provisionedEventId,
          graphCalendarId: graphCalendarId.trim() || null,
          subject: subject.trim(),
          startIso,
          endIso,
          isAllDay,
          location: location.trim() || null,
          bodyHtml,
          categories: eventCategories,
          attendeeEmails: parsedAttendees,
          optionalAttendeeEmails: parsedOptionalAttendees,
          teamsMeeting: !isAllDay && teamsMeeting,
          ...webinarTracking,
          notifyAttendees,
          ...saveAttachments,
          ...(recurrence ? { recurrence } : {}),
          showAs: eventShowAs,
          sensitivity: calendarEventSensitivityFromPrivate(eventIsPrivate),
          ...graphReminderPayload(selectedAccount?.provider, reminderEnabled, reminderMinutesBefore),
          ...(!isAllDay ? { timeZone: eventTimeZone } : {}),
          ...msWebinarMeta
        })
        writeCalendarEventReminder(
          calendarEventReminderKey(accountId, provisionedEventId),
          reminderEnabled ? { enabled: true, minutesBefore: reminderMinutesBefore } : { enabled: false }
        )
        if (calendarEventIconIsExplicit(eventIconId)) {
          await window.mailClient.calendar.patchEventIcon({
            accountId,
            graphEventId: provisionedEventId,
            iconId: eventIconId
          })
        }
        onEntityCreated?.({
          ref: { kind: 'calendar_event', accountId, graphEventId: provisionedEventId },
          title: subject.trim() || t('calendar.eventDialog.untitled')
        })
      } else if (mode === 'create') {
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
          ...(parsedAttendees.length > 0 ||
          parsedOptionalAttendees.length > 0 ||
          selectedAccount?.provider === 'microsoft' ||
          selectedAccount?.provider === 'google'
            ? {
                attendeeEmails: parsedAttendees,
                optionalAttendeeEmails: parsedOptionalAttendees,
                ...(selectedAccount?.provider === 'microsoft'
                  ? {
                      teamsMeeting: !isAllDay && teamsMeeting,
                      ...webinarTracking
                    }
                  : {}),
                notifyAttendees
              }
            : { notifyAttendees }),
          ...saveAttachments,
          ...(recurrence ? { recurrence } : {}),
          showAs: eventShowAs,
          sensitivity: calendarEventSensitivityFromPrivate(eventIsPrivate),
          ...graphReminderPayload(selectedAccount?.provider, reminderEnabled, reminderMinutesBefore),
          ...(!isAllDay ? { timeZone: eventTimeZone } : {}),
          ...msWebinarMeta
        })
        const createdId = created.id?.trim()
        if (createdId) {
          writeCalendarEventReminder(
            calendarEventReminderKey(accountId, createdId),
            reminderEnabled ? { enabled: true, minutesBefore: reminderMinutesBefore } : { enabled: false }
          )
        }
        createdForSaved = created.event
        if (created.joinUrl?.trim()) {
          setDialogJoinUrl(
            preferTeamsJoinUrl({
              joinUrl: created.joinUrl,
              bodyHtml: descriptionHtml
            })
          )
        }
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
          parsedOptionalAttendees.length > 0 ||
          initialEvent.source === 'microsoft' ||
          initialEvent.source === 'google'
            ? {
                attendeeEmails: parsedAttendees,
                optionalAttendeeEmails: parsedOptionalAttendees,
                ...(initialEvent.source === 'microsoft'
                  ? {
                      teamsMeeting: !isAllDay && teamsMeeting,
                      ...webinarTracking
                    }
                  : {}),
                notifyAttendees
              }
            : { notifyAttendees }),
          ...saveAttachments,
          showAs: eventShowAs,
          sensitivity: calendarEventSensitivityFromPrivate(eventIsPrivate),
          ...graphReminderPayload(initialEvent.source, reminderEnabled, reminderMinutesBefore),
          ...(!isAllDay ? { timeZone: eventTimeZone } : {}),
          ...(initialEvent.source === 'microsoft' ? msWebinarMeta : {})
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
            payloadOverride: {
              ...payloadOverride,
              ...(recurrence ? { recurrence } : {})
            }
          })
        } else {
          const masterId = editSeriesMasterId?.trim() || null
          const patchRecurrenceOntoSeries =
            recurrence != null &&
            (editEventType === 'singleInstance' ||
              editEventType === 'seriesMaster' ||
              (recurrenceDirty &&
                (editEventType === 'occurrence' || editEventType === 'exception') &&
                Boolean(masterId)))
          const updateTargetId =
            patchRecurrenceOntoSeries &&
            (editEventType === 'occurrence' || editEventType === 'exception') &&
            masterId
              ? masterId
              : gid
          await window.mailClient.calendar.updateEvent({
            accountId,
            graphEventId: updateTargetId,
            graphCalendarId: initialEvent.graphCalendarId ?? null,
            ...payloadOverride,
            ...(patchRecurrenceOntoSeries && recurrence ? { recurrence } : {})
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
      const invitedCount = parsedAttendees.length + parsedOptionalAttendees.length
      if (notifyAttendees !== false && invitedCount > 0) {
        const names = [...parsedAttendees, ...parsedOptionalAttendees]
          .slice(0, 3)
          .join(', ')
        const moreCount = invitedCount > 3 ? invitedCount - 3 : 0
        const label =
          didRescheduleMeeting && mode === 'edit'
            ? moreCount > 0
              ? t('calendar.eventDialog.rescheduleUpdateSentWithMore', { names, count: moreCount })
              : t('calendar.eventDialog.rescheduleUpdateSent', { names })
            : moreCount > 0
              ? t('calendar.eventDialog.invitationSentWithMore', { names, count: moreCount })
              : t('calendar.eventDialog.invitationSent', { names })
        useUndoStore.getState().pushToast({ label, variant: 'success', durationMs: 6000 })
      } else if (
        notifyAttendees === false &&
        (parsedAttendees.length > 0 || parsedOptionalAttendees.length > 0)
      ) {
        useUndoStore.getState().pushToast({
          label: t('calendar.eventDialog.draftSaved'),
          variant: 'success',
          durationMs: 6000
        })
      }

      // Notion-Writeback: Forms + Teams-Join in #kurtrocks Events (best effort)
      const notionPageId = notionSourcePageId?.trim()
      if (isWebinarSave && notionPageId) {
        const surveyForNotion = (
          webinarContent.surveyUrl.trim() ||
          readWebinarInvitationDefaults().defaultSurveyUrl
        ).trim()
        const meetingForNotion = (
          getDialogJoinUrl()?.trim() ||
          createdForSaved?.joinUrl?.trim() ||
          ''
        ).trim()
        if (surveyForNotion || meetingForNotion) {
          void window.mailClient.notion
            .updateKurtrocksEventLinks({
              pageId: notionPageId,
              surveyUrl: surveyForNotion || null,
              meetingUrl: meetingForNotion || null
            })
            .then((res) => {
              if (res.updatedSurvey || res.updatedMeeting) {
                useUndoStore.getState().pushToast({
                  label: t('calendar.eventDialog.notionLinksWrittenToast'),
                  variant: 'success',
                  durationMs: 5000
                })
              } else if (res.missingSurveyProperty || res.missingMeetingProperty) {
                useUndoStore.getState().pushToast({
                  label: t('calendar.eventDialog.notionLinksMissingPropsToast'),
                  variant: 'info',
                  durationMs: 7000
                })
              }
            })
            .catch((e) => {
              useUndoStore.getState().pushToast({
                label:
                  e instanceof Error
                    ? e.message
                    : t('calendar.eventDialog.notionLinksWriteFailedToast'),
                variant: 'error',
                durationMs: 7000
              })
            })
        }
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
    teamsProvisioning ||
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
    !isTaskCreate &&
    (attendeeEmailsFromField(attendeeInput).length > 0 ||
      attendeeEmailsFromField(optionalAttendeeInput).length > 0)
  const requiredAttendeeCount = attendeeEmailsFromField(attendeeInput).length
  const optionalAttendeeCount = attendeeEmailsFromField(optionalAttendeeInput).length
  const trackingActiveCount =
    (responseRequested ? 0 : 1) + (allowForwarding ? 0 : 1) + (hideAttendees ? 1 : 0)
  const submitLabel = isTaskCreate
    ? t('tasks.create.submit')
    : hasInviteAttendees
      ? t('calendar.eventDialog.send')
      : t('calendar.eventDialog.save')

  /** Webinar-HTML im HtmlDocumentWysiwygEditor — TipTap wuerde Tabellen/Styles zerstoeren. */
  const usesWebinarDescriptionUi =
    webinarMode ||
    chronellWebinarInvitation ||
    isWebinarInvitationHtml(descriptionHtml) ||
    isWebinarInvitationHtml(graphBodyForPreview ?? '')
  /** Webinar mit Teilnehmern: Speichern (Entwurf) + Senden getrennt. */
  const showWebinarSaveAndSend =
    !isTaskCreate && usesWebinarDescriptionUi && hasInviteAttendees
  const webinarAttendeePreviewHtml = useMemo(() => {
    const graphForPreview = attendeeDisplayHtml.trim() || graphBodyForPreview?.trim() || ''
    return buildWebinarAttendeePreviewHtml(descriptionHtml, graphForPreview || null)
  }, [attendeeDisplayHtml, descriptionHtml, graphBodyForPreview])

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
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {mode === 'create' && taskAccounts.length > 0 ? (
              <div className="flex shrink-0 items-center gap-2">
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
              <span className="shrink-0 text-sm font-medium text-muted-foreground">
                {t('calendar.eventDialog.panelTitle')}
              </span>
            )}

            {!isTaskCreate ? (
              <CalendarEventDialogRibbon
                embedded
                disabled={busy}
                eventFieldsLocked={eventFieldsLocked}
                showRecurrence={showEventRecurrenceEditor || mode === 'create'}
                recurFreq={recurFreq}
                onRecurFreqChange={setRecurFreq}
                onOpenRecurrenceDetails={handleOpenRecurrenceDetails}
                eventShowAs={eventShowAs}
                onShowAsChange={setEventShowAs}
                reminderEnabled={reminderEnabled}
                reminderMinutesBefore={reminderMinutesBefore}
                onReminderChange={handleRibbonReminderChange}
                eventIsPrivate={eventIsPrivate}
                onPrivateChange={setEventIsPrivate}
                categoryNames={useOutlookCategories ? categoryChoiceNames : undefined}
                selectedCategories={useOutlookCategories ? eventCategories : undefined}
                categoryColorByName={useOutlookCategories ? categoryColorByName : undefined}
                categoriesLoading={useOutlookCategories ? mastersLoading : undefined}
                onCategoryPick={useOutlookCategories ? pickEventCategory : undefined}
                templates={templates}
                onApplyTemplate={applyTemplateById}
                onTemplatesMenuOpen={handleTemplatesMenuOpen}
                onSaveAsTemplate={handleSaveAsTemplateClick}
                onNotion={
                  mode === 'edit' && initialEvent
                    ? (): void => {
                        void pickAndSendCalendarEventToNotion(
                          {
                            ...initialEvent,
                            title: subject.trim() || initialEvent.title,
                            location: location.trim() || initialEvent.location
                          },
                          i18n.language.startsWith('de') ? 'de' : 'en'
                        )
                      }
                    : undefined
                }
                notionDisabled={busy || !(initialEvent?.graphEventId || provisionedEventId)}
                onOpenInOutlook={
                  mode === 'edit' && initialEvent?.webLink
                    ? (): void => {
                        voidOpenExternalUrl(initialEvent.webLink!)
                      }
                    : undefined
                }
                joinUrlStore={joinUrlStoreRef.current}
                onCopilot={handleRibbonCopilot}
                copilotAvailable={copilotAvailable}
              />
            ) : null}

            {mode === 'create' && createKind === 'task' && taskAccounts.length > 0 ? (
              <div className="flex min-w-0 items-center gap-2">
                <label className="min-w-0">
                  <span className="sr-only">{t('tasks.create.account')}</span>
                  <select
                    value={taskAccountId}
                    disabled={busy || taskListsLoading}
                    onChange={(e): void => setTaskAccountId(e.target.value)}
                    aria-label={t('tasks.create.account')}
                    className="h-8 max-w-[min(280px,32vw)] truncate rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="h-8 max-w-[min(220px,28vw)] truncate rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
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
              <label className="min-w-0 shrink">
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
                  className="h-8 max-w-[min(280px,28vw)] truncate rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="flex shrink-0 items-center gap-0.5">
            {(placement === 'modal' || placement === 'float') && surface !== 'osWindow' ? (
              <button
                type="button"
                disabled={busy}
                onClick={toggleModalMaximize}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                title={
                  modalMaximized
                    ? t('calendar.eventDialog.restoreSizeTitle')
                    : t('calendar.eventDialog.maximizeTitle')
                }
                aria-label={
                  modalMaximized
                    ? t('calendar.eventDialog.restoreSizeTitle')
                    : t('calendar.eventDialog.maximizeTitle')
                }
              >
                {modalMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            ) : null}
            {headerDockButton}
            <button
              type="button"
              onClick={requestClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={t('calendar.eventDialog.closeAria')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <form
          className={cn('flex min-h-0 flex-1', showEventDayColumn && 'flex-row')}
          onSubmit={(ev): void => {
            void handleSubmit(ev, {
              notifyAttendees: showWebinarSaveAndSend ? false : hasInviteAttendees
            })
          }}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-0 overflow-y-auto px-4 py-3">
            {(mode === 'create' || (mode === 'edit' && initialEvent?.source === 'microsoft')) &&
            createKind === 'event' &&
            accountId.startsWith('ms:') ? (
              <div className="mb-3 space-y-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={webinarMode}
                    disabled={busy || eventFieldsLocked}
                    onChange={(e): void => {
                      const on = e.target.checked
                      setWebinarMode(on)
                      if (on) {
                        applyWebinarTrackingDefaults({
                          setHideAttendees,
                          setResponseRequested,
                          setAllowForwarding
                        })
                        setTeamsMeeting(true)
                        setWebinarContent((prev) => ({
                          ...prev,
                          title: prev.title.trim() || subject.trim()
                        }))
                        void provisionTeamsMeetingNow()
                      } else {
                        setChronellWebinarInvitation(false)
                      }
                    }}
                  />
                  {t('calendar.eventDialog.webinarModeToggle')}
                </label>
                {webinarMode ? (
                  <p className="text-2xs text-muted-foreground">
                    {t('calendar.eventDialog.webinarSinglePageHint')}
                  </p>
                ) : null}
                {webinarMode && mode === 'edit' ? (
                  <p className="text-2xs text-muted-foreground">
                    {t('calendar.eventDialog.webinarEditCancelHint')}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="border-b border-border pb-3">
              <CalendarEventDialogSubjectRow
                mode={mode}
                isTaskCreate={isTaskCreate}
                subject={subject}
                eventIconId={eventIconId}
                eventFieldsLocked={eventFieldsLocked}
                onSubjectChange={setSubject}
                onIconChange={setEventIconId}
              />
              {isTaskCreate && useOutlookCategories ? (
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

            {/* Zielkalender / Aufgabenliste ist im Header (Create). */}

            {!isTaskCreate ? (
              <div className="pt-2">
                <FilterTabs
                  size="compact"
                  ariaLabel={t('calendar.eventDialog.scheduleTabsAria')}
                  value={eventScheduleTab}
                  onChange={setEventScheduleTab}
                  options={[
                    {
                      id: 'appointment' as const,
                      label: t('calendar.eventDialog.appointmentHeading'),
                      icon: <CalendarIcon className="h-3.5 w-3.5" />
                    },
                    {
                      id: 'location' as const,
                      label: t('calendar.eventDialog.locationRowLabel'),
                      icon: <MapPin className="h-3.5 w-3.5" />
                    },
                    {
                      id: 'more' as const,
                      label: t('calendar.eventDialog.moreTab'),
                      icon: <SlidersHorizontal className="h-3.5 w-3.5" />
                    }
                  ]}
                />
              </div>
            ) : null}

            {isTaskCreate ||
            webinarMode ||
            eventScheduleTab === 'appointment' ||
            eventScheduleTab === 'more' ? (
            <div className="border-b border-border py-3">
              <div
                className={cn(
                  'grid grid-cols-1 items-start gap-4',
                  !isTaskCreate && eventScheduleTab === 'more' && 'lg:grid-cols-2',
                  isTaskCreate && 'lg:grid-cols-6',
                  !isTaskCreate && eventScheduleTab === 'appointment' && 'max-w-2xl'
                )}
              >
                {isTaskCreate || eventScheduleTab === 'appointment' || eventScheduleTab === 'more' || webinarMode ? (
                <div className={cn('min-w-0', isTaskCreate && 'lg:col-span-2')}>
                  {isTaskCreate ? (
                  <div className={eventDialogSectionHeadingClass}>
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    {t('tasks.create.planned')}
                  </div>
                  ) : null}
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
                      <div className="flex items-stretch gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
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
                                  const keepMin =
                                    timedDisplay.durationMinutes > 0
                                      ? timedDisplay.durationMinutes
                                      : 60
                                  setDtStart(nextStart)
                                  setDtEnd(
                                    addMinutesInEventZone(nextStart, keepMin, eventTimeZone)
                                  )
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
                                  const keepMin =
                                    timedDisplay.durationMinutes > 0
                                      ? timedDisplay.durationMinutes
                                      : 60
                                  setDtStart(nextStart)
                                  setDtEnd(
                                    addMinutesInEventZone(nextStart, keepMin, eventTimeZone)
                                  )
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
                                  setDtEnd(
                                    mergeTimeIntoEventEnd(dtStart, dtEnd, hm, eventTimeZone)
                                  )
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex shrink-0 flex-col justify-center self-stretch py-0.5"
                          aria-hidden
                        >
                          <div className="h-full min-h-[2.5rem] w-2 rounded-r-md border border-l-0 border-border/70" />
                        </div>

                        <div className="flex shrink-0 flex-col items-stretch justify-center gap-2">
                          <label className="flex flex-col gap-0.5">
                            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t('calendar.eventDialog.durationLabel')}
                            </span>
                            <input
                              type="text"
                              disabled={eventFieldsLocked}
                              value={durationDraft ?? timedDisplay.duration}
                              aria-label={t('calendar.eventDialog.durationAria')}
                              title={t('calendar.eventDialog.durationHint')}
                              placeholder={t('calendar.eventDialog.durationPlaceholder')}
                              onChange={(e): void => setDurationDraft(e.target.value)}
                              onBlur={(): void => commitDurationDraft()}
                              onKeyDown={(e): void => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  commitDurationDraft()
                                  ;(e.target as HTMLInputElement).blur()
                                } else if (e.key === 'Escape') {
                                  setDurationDraft(null)
                                  ;(e.target as HTMLInputElement).blur()
                                }
                              }}
                              className={cn(
                                eventDialogPanelSelectClass,
                                'w-[5.5rem] px-1.5 text-center text-xs tabular-nums'
                              )}
                            />
                          </label>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-1.5 text-xs font-medium',
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
                                        format(
                                          addDays(parseISO(`${lastInclusive}T12:00:00`), 1),
                                          'yyyy-MM-dd'
                                        )
                                      )
                                    }
                                  }
                                  setIsAllDay(true)
                                } else {
                                  if (dayStart) {
                                    setDtStart(`${dayStart}T09:00`)
                                    setDtEnd(
                                      addMinutesInEventZone(
                                        `${dayStart}T09:00`,
                                        60,
                                        eventTimeZone
                                      )
                                    )
                                  }
                                  setIsAllDay(false)
                                }
                              }}
                              className="rounded border-border"
                            />
                            <span
                              className={cn(
                                isAllDay ? 'text-foreground' : 'text-muted-foreground'
                              )}
                            >
                              {t('calendar.eventDialog.allDay')}
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : isAllDay && dayStart && dayEnd ? (
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1 space-y-1.5">
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
                                  setDayEnd(
                                    format(addDays(parseISO(`${v}T12:00:00`), 1), 'yyyy-MM-dd')
                                  )
                                }
                              }}
                              className={cn(
                                eventDialogPanelSelectClass,
                                'min-w-0 flex-1 tabular-nums'
                              )}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                              {t('calendar.eventDialog.labelEnd')}:
                            </span>
                            <ChronellDateField
                              disabled={eventFieldsLocked}
                              min={dayStart}
                              value={format(
                                addDays(parseISO(`${dayEnd}T12:00:00`), -1),
                                'yyyy-MM-dd'
                              )}
                              onChange={(v): void => {
                                if (!v) return
                                const excl = format(
                                  addDays(parseISO(`${v}T12:00:00`), 1),
                                  'yyyy-MM-dd'
                                )
                                if (excl <= dayStart) {
                                  setDayEnd(
                                    format(
                                      addDays(parseISO(`${dayStart}T12:00:00`), 1),
                                      'yyyy-MM-dd'
                                    )
                                  )
                                } else {
                                  setDayEnd(excl)
                                }
                              }}
                              className={cn(
                                eventDialogPanelSelectClass,
                                'min-w-0 flex-1 tabular-nums'
                              )}
                            />
                          </div>
                        </div>
                        <label
                          className={cn(
                            'mt-1 flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium',
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
                                      format(
                                        addDays(parseISO(`${lastInclusive}T12:00:00`), 1),
                                        'yyyy-MM-dd'
                                      )
                                    )
                                  }
                                }
                                setIsAllDay(true)
                              } else {
                                if (dayStart) {
                                  setDtStart(`${dayStart}T09:00`)
                                  setDtEnd(
                                    addMinutesInEventZone(`${dayStart}T09:00`, 60, eventTimeZone)
                                  )
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
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('calendar.eventDialog.summaryDash')}</p>
                    )}
                    {!isTaskCreate && !timedDisplay && !(isAllDay && dayStart && dayEnd) ? (
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
                ) : null}

                {isTaskCreate || eventScheduleTab === 'more' ? (
                <>
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
                ) : showEventRecurrenceEditor ? (
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
                      eventFieldsLocked={
                        eventFieldsLocked || (mode === 'edit' && !editEventTypeLoaded)
                      }
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

                {isTaskCreate ? (
                <>
                <div className="min-w-0">
                  <div className={eventDialogSectionHeadingClass}>
                    <CircleDot className="h-3.5 w-3.5 shrink-0" />
                    {t('calendar.eventDialog.statusHeading')}
                  </div>
                  <p className={cn(eventDialogPanelSelectClass, 'flex items-center text-muted-foreground')}>
                    {t('calendar.eventDialog.summaryDash')}
                  </p>
                </div>

                <div className="min-w-0">
                  <div className={eventDialogSectionHeadingClass}>
                    <Bell className="h-3.5 w-3.5 shrink-0" />
                    {t('calendar.eventDialog.reminderHeading')}
                  </div>
                  <p className={cn(eventDialogPanelSelectClass, 'flex items-center text-muted-foreground')}>
                    {t('calendar.eventDialog.summaryDash')}
                  </p>
                </div>
                </>
                ) : null}
                </>
                ) : null}
              </div>
            </div>
            ) : null}

            {!isTaskCreate && eventScheduleTab === 'more' && mode === 'edit' && calendarAccounts.length > 0 ? (
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

            {!isTaskCreate && (webinarMode || eventScheduleTab === 'location') ? (
              <div className="space-y-3 border-b border-border py-3">
                {isMicrosoftEventAccount ? (
                  <div className={cn(teamsMeeting && 'rounded-md bg-blue-500/5 px-1 py-1')}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 transition-colors',
                        teamsMeeting
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Video className={cn('h-4 w-4 shrink-0', teamsMeeting && 'text-blue-500')} />
                      <input
                        type="checkbox"
                        checked={teamsMeeting}
                        disabled={
                          isAllDay || msTeamsUiLocked || eventFieldsLocked || teamsProvisioning
                        }
                        onChange={(e): void => handleTeamsMeetingChange(e.target.checked)}
                        className="h-4 w-4 shrink-0 rounded border-border accent-blue-500"
                      />
                      <span className="text-sm font-medium leading-snug">
                        {t('calendar.eventDialog.teamsMeetingToggle')}
                      </span>
                      {teamsProvisioning ? (
                        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {t('calendar.eventDialog.teamsProvisioning')}
                        </span>
                      ) : teamsMeeting && !isAllDay ? (
                        <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                          {t('calendar.eventDialog.teamsMeetingActive')}
                        </span>
                      ) : null}
                      {isAllDay ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t('calendar.eventDialog.teamsDisabledAllDay')}
                        </span>
                      ) : null}
                    </label>
                    {isMicrosoftEventAccount && !isAllDay ? (
                      <div className="mt-2 space-y-1 px-1">
                        <label className="block text-xs font-medium text-foreground">
                          {t('calendar.eventDialog.teamsTemplateLabel')}
                          <select
                            value={teamsMeetingTemplateId}
                            disabled={teamsProvisioning || eventFieldsLocked}
                            onChange={(e): void => handleTeamsTemplateChange(e.target.value)}
                            className={cn(eventDialogPanelSelectClass, 'mt-1 w-full')}
                          >
                            <option value="">{t('calendar.eventDialog.teamsTemplateNone')}</option>
                            {teamsMeetingTemplates.map((tpl) => (
                              <option key={tpl.id} value={tpl.meetingTemplateId}>
                                {tpl.name}
                                {tpl.builtin
                                  ? ` (${t('settings.teamsMeetingTemplates.builtinBadge')})`
                                  : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="text-2xs text-muted-foreground">
                          {teamsMeetingTemplates.length === 0
                            ? t('calendar.eventDialog.teamsTemplateEmptyHint')
                            : t('calendar.eventDialog.teamsTemplateHint')}
                        </p>
                      </div>
                    ) : null}
                    <CalendarEventDialogTeamsJoinLink
                      store={joinUrlStoreRef.current}
                      teamsMeeting={teamsMeeting}
                      isAllDay={isAllDay}
                      teamsProvisioning={teamsProvisioning}
                    />
                    {msEventDetailsError ? (
                      <p className="mt-1 px-1 text-2xs text-destructive" role="status">
                        {msEventDetailsError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <PropertyRow icon={MapPin} label={t('calendar.eventDialog.locationRowLabel')}>
                  <LocationAutocompleteInput
                    value={location}
                    onChange={setLocation}
                    disabled={eventFieldsLocked}
                    inputClassName={eventDialogPanelSelectClass}
                  />
                </PropertyRow>
              </div>
            ) : null}

            {(mode !== 'create' || createKind === 'event') &&
            (selectedAccount?.provider === 'google' ||
            selectedAccount?.provider === 'microsoft' ? (
              <div className="space-y-2 border-b border-border py-2">
                <FilterTabs
                  size="compact"
                  ariaLabel={t('calendar.eventDialog.attendeesTabsAria')}
                  value={
                    selectedAccount?.provider !== 'microsoft' && attendeesInviteTab === 'tracking'
                      ? 'required'
                      : attendeesInviteTab
                  }
                  onChange={setAttendeesInviteTab}
                  options={[
                    {
                      id: 'required' as const,
                      label: t('calendar.eventDialog.attendeesRowLabel'),
                      icon: <UserPlus className="h-3.5 w-3.5" />,
                      count: requiredAttendeeCount
                    },
                    {
                      id: 'optional' as const,
                      label: t('calendar.eventDialog.optionalAttendeesRowLabel'),
                      icon: <Users className="h-3.5 w-3.5" />,
                      count: optionalAttendeeCount
                    },
                    ...(selectedAccount?.provider === 'microsoft'
                      ? [
                          {
                            id: 'tracking' as const,
                            label: t('calendar.eventDialog.trackingHeading'),
                            icon: <ListChecks className="h-3.5 w-3.5" />,
                            count: trackingActiveCount
                          }
                        ]
                      : [])
                  ]}
                />
                {attendeesInviteTab === 'required' ? (
                  <CalendarEventDialogAttendeeField
                    fieldRef={attendeeFieldRef}
                    label={t('calendar.eventDialog.attendeesRowLabel')}
                    value={attendeeInput}
                    onChange={setAttendeeInput}
                    accountId={accountId}
                    eventFieldsLocked={eventFieldsLocked}
                    pickContactsLabel={t('calendar.eventDialog.attendeesPickContacts')}
                  />
                ) : null}
                {attendeesInviteTab === 'optional' ? (
                  <div>
                    <CalendarEventDialogAttendeeField
                      fieldRef={optionalAttendeeFieldRef}
                      label={t('calendar.eventDialog.optionalAttendeesRowLabel')}
                      value={optionalAttendeeInput}
                      onChange={setOptionalAttendeeInput}
                      accountId={accountId}
                      eventFieldsLocked={eventFieldsLocked}
                      pickContactsLabel={t('calendar.eventDialog.attendeesPickContacts')}
                    />
                    <p className="mt-1.5 text-2xs text-muted-foreground">
                      {t('calendar.eventDialog.optionalAttendeesHint')}
                    </p>
                  </div>
                ) : null}
                {attendeesInviteTab === 'tracking' &&
                selectedAccount?.provider === 'microsoft' ? (
                  <div className="space-y-2 rounded-md border border-border/70 bg-muted/15 px-2.5 py-2">
                    {(
                      [
                        {
                          key: 'responseRequested',
                          checked: responseRequested,
                          set: setResponseRequested,
                          label: 'responseRequested',
                          hint: 'responseRequestedHint'
                        },
                        {
                          key: 'allowForwarding',
                          checked: allowForwarding,
                          set: setAllowForwarding,
                          label: 'allowForwarding',
                          hint: 'allowForwardingHint'
                        },
                        {
                          key: 'hideAttendees',
                          checked: hideAttendees,
                          set: setHideAttendees,
                          label: 'hideAttendees',
                          hint: 'hideAttendeesHint',
                          icon: EyeOff
                        }
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.key}
                        className={cn(
                          'flex cursor-pointer items-start gap-2 text-xs font-medium',
                          (eventFieldsLocked || (mode === 'edit' && msEventDetailsLoading)) &&
                            'cursor-not-allowed opacity-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={opt.checked}
                          disabled={eventFieldsLocked || (mode === 'edit' && msEventDetailsLoading)}
                          onChange={(e): void => opt.set(e.target.checked)}
                          className="mt-0.5 rounded border-border"
                        />
                        {'icon' in opt && opt.icon ? (
                          <opt.icon
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        ) : null}
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block',
                              opt.checked ? 'text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {t(`calendar.eventDialog.${opt.label}`)}
                          </span>
                          <span className="mt-0.5 block text-2xs font-normal leading-snug text-muted-foreground">
                            {t(`calendar.eventDialog.${opt.hint}`)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null)}

            {(mode !== 'create' || createKind === 'event') ? (
            <div className="border-b border-border py-1">
              <PropertyRow icon={AlignLeft} label={t('calendar.eventDialog.description')}>
                <div className="mt-1 min-w-0 space-y-2">
                  {usesWebinarDescriptionUi ? (
                    <>
                      {webinarMode && !eventFieldsLocked ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(): void => openWebinarTemplateDialog()}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
                        >
                          {t('calendar.eventDialog.webinarLoadTemplate')}
                        </button>
                      ) : null}
                      {!eventFieldsLocked ? (
                        <>
                          <p className="text-2xs text-muted-foreground">
                            {t('calendar.eventDialog.webinarWysiwygHint')}
                          </p>
                          <WebinarInvitationEditorPanel
                            descriptionHtml={descriptionHtml}
                            onChangeHtml={setDescriptionHtml}
                            flushRef={webinarHtmlEditorFlushRef}
                            attendeePreviewHtml={webinarAttendeePreviewHtml}
                            disabled={busy || eventFieldsLocked}
                            imagesLoading={webinarImagesLoading}
                          />
                        </>
                      ) : webinarAttendeePreviewHtml.trim() ? (
                        <WebinarInvitationPreview html={webinarAttendeePreviewHtml} className="w-full" />
                      ) : descriptionHtml.trim() ? (
                        <WebinarInvitationPreview html={descriptionHtml} className="w-full" />
                      ) : null}
                    </>
                  ) : (
                    <>
                  {!usesWebinarDescriptionUi &&
                  descriptionHtml.trim() &&
                  (teamsMeeting || descriptionHtml.includes('bgcolor="#121212"')) ? (
                    <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {t('calendar.eventDialog.webinarEnableAssistantHint')}
                    </p>
                  ) : null}
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
                  ) : usesWebinarDescriptionUi ? null : (
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
                        eventAttachmentsApi.supportsCloudAttachments ||
                        copilotAvailable) ? (
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
                          leadingActions={
                            copilotAvailable ? (
                              <button
                                type="button"
                                disabled={busy}
                                title={t('calendar.eventDialog.ribbonCopilot')}
                                aria-label={t('calendar.eventDialog.ribbonCopilot')}
                                onClick={(): void => setDescriptionCopilotOpen(true)}
                                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-primary/10 disabled:opacity-50"
                              >
                                <Sparkles className="h-3 w-3 text-primary" />
                                {t('copilot.compose.button')}
                              </button>
                            ) : null
                          }
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
                              eventAttachmentsApi.supportsCloudAttachments ||
                              copilotAvailable) &&
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
                    </>
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
                contentPaddingClass="px-1"
                sectionHeaderVariant="property"
                sectionCollapsedDefault
                className="border-b border-border"
              />
            ) : null}

            {localError && (
              <p className="py-2 text-xs text-destructive" role="alert">
                {localError}
              </p>
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 shadow-[0_-8px_24px_-4px_hsl(0_0%_0%/0.25)]">
            <div className="flex min-w-0 items-center gap-3">
              {mode === 'edit' &&
              initialEvent?.graphEventId?.trim() &&
              initialEvent.calendarCanEdit !== false ? (
                <button
                  type="button"
                  disabled={busy || msEventDetailsLoading}
                  onClick={(): void => {
                    void handleDeleteEvent()
                  }}
                  className="inline-flex items-center gap-1.5 text-base font-medium text-destructive hover:text-destructive/90 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {t('calendar.eventDialog.deleteEventButton')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={requestClose}
                className="text-base font-medium text-muted-foreground hover:text-foreground"
              >
                {t('calendar.eventDialog.cancel')}
              </button>
            </div>
            <button
              type="button"
              disabled={submitDisabled}
              onClick={(ev): void => {
                void handleSubmit(ev, {
                  notifyAttendees: showWebinarSaveAndSend ? false : hasInviteAttendees
                })
              }}
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
                          : showWebinarSaveAndSend
                            ? t('calendar.eventDialog.webinarSaveDraftTitle')
                            : undefined
              }
              className={cn(
                'inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-medium',
                showWebinarSaveAndSend
                  ? 'border border-border bg-background text-foreground hover:bg-muted'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                submitDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {showWebinarSaveAndSend
                ? t('calendar.eventDialog.save')
                : submitLabel}
            </button>
            {showWebinarSaveAndSend ? (
              <button
                type="button"
                disabled={submitDisabled}
                onClick={(ev): void => {
                  void handleSubmit(ev, { notifyAttendees: true })
                }}
                title={t('calendar.eventDialog.webinarSendInvitationsTitle')}
                className={cn(
                  'inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/90',
                  submitDisabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {!busy ? <Send className="h-4 w-4" aria-hidden /> : null}
                {t('calendar.eventDialog.send')}
              </button>
            ) : null}
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

  const descriptionCopilotPortal = (
    <CalendarEventDescriptionCopilotDialog
      open={descriptionCopilotOpen}
      accountId={accountId}
      subject={subject}
      location={location}
      existingHtml={descriptionHtml}
      onApply={(html, mode): void => {
        if (mode === 'replace') {
          setDescriptionHtml(html)
          return
        }
        setDescriptionHtml((prev) => (prev.trim() ? `${prev}${html}` : html))
      }}
      onClose={(): void => setDescriptionCopilotOpen(false)}
    />
  )

  const webinarTemplatePortal = webinarTemplateDialogOpen ? (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      onClick={(): void => setWebinarTemplateDialogOpen(false)}
      role="presentation"
    >
      <div
        className="max-h-[min(90dvh,720px)] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-lg"
        onClick={(e): void => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="webinar-template-dialog-title"
      >
        <h3 id="webinar-template-dialog-title" className="text-sm font-semibold text-foreground">
          {t('calendar.eventDialog.webinarLoadTemplateTitle')}
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('calendar.eventDialog.webinarFormIntro')}
        </p>
        <div className="mt-4 space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-foreground">
              {t('calendar.eventDialog.webinarLayoutTemplateLabel')}
            </legend>
            <div className="space-y-1" role="radiogroup" aria-label={t('calendar.eventDialog.webinarLayoutTemplateLabel')}>
              {readWebinarInvitationLayoutTemplates().map((tpl: WebinarInvitationLayoutTemplate) => {
                const selected = webinarLayoutTemplateId === tpl.id
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busy || eventFieldsLocked}
                    onClick={(): void => setWebinarLayoutTemplateId(tpl.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors',
                      selected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-secondary'
                    ].join(' ')}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{tpl.name}</span>
                    {tpl.builtin ? (
                      <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-2xs">
                        {t('calendar.eventDialog.webinarLayoutTemplateBuiltin')}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-foreground">
              {t('calendar.eventDialog.webinarLayoutThemeLabel')}
            </legend>
            <WebinarLayoutThemeSwatches
              value={webinarLayoutTheme}
              onChange={setWebinarLayoutTheme}
              disabled={busy || eventFieldsLocked}
              modeLabel={(mode): string => t(`calendar.eventDialog.webinarLayoutMode_${mode}`)}
              colorLabel={(color): string =>
                t(`calendar.eventDialog.webinarLayoutTheme_${color}`)
              }
            />
          </fieldset>
          <CalendarEventDialogWebinarContentForm
            values={webinarContent}
            onChange={setWebinarContent}
            disabled={busy || eventFieldsLocked}
            msAccountId={accountId.startsWith('ms:') ? accountId : null}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={(): void => setWebinarTemplateDialogOpen(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={busy || eventFieldsLocked}
              onClick={(): void => {
                applyWebinarInvitationHtml()
                setWebinarTemplateDialogOpen(false)
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('calendar.eventDialog.webinarApplyPreview')}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  if (!open) return null

  if (surface === 'osWindow') {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{panelInner}</div>
        {drivePortal}
        {descriptionCopilotPortal}
        {webinarTemplatePortal}
      </>
    )
  }

  if (placement === 'dock') {
    return (
      <>
        <div className="fixed inset-0 z-[95] flex justify-end bg-black/25" onClick={requestClose} role="presentation" />
        <div className="fixed inset-y-0 right-0 z-[100] flex">
          <VerticalSplitter
            ariaLabel={t('calendar.eventDialog.modalResizeAria')}
            onDrag={(delta): void => setDockWidth((w) => w - delta)}
          />
          <aside
            className="flex h-full min-h-0 flex-col border-l border-border bg-card shadow-2xl"
            style={{ width: dockWidth, maxWidth: 'calc(100vw - 32px)' }}
            onClick={(e): void => e.stopPropagation()}
          >
            {panelInner}
          </aside>
        </div>
        {drivePortal}
        {descriptionCopilotPortal}
        {webinarTemplatePortal}
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
          maxResizeWidthPx={Math.max(1200, window.innerWidth - 24)}
          maxResizeHeightPx={Math.min(window.innerHeight - 24, window.innerHeight - 24)}
          persistSizeKey={CAL_EVENT_DIALOG_FLOAT_SIZE_KEY}
          defaultPosition={floatDefaultPos}
          zIndex={100}
          hideHeaderActions
          slideFromRight={false}
          onClose={requestClose}
          onDock={(): void => setPlacementPersisted('dock')}
        >
          {panelInner}
        </CalendarFloatingPanel>
        {drivePortal}
        {descriptionCopilotPortal}
        {webinarTemplatePortal}
      </>
    )
  }

  return (
    <ModalRoot
      open={open}
      zIndex={100}
      centerClassName="justify-center bg-black/45 backdrop-blur-[2px] p-3 sm:p-6"
      onBackdropClick={requestClose}
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
      {descriptionCopilotPortal}
      {webinarTemplatePortal}
    </ModalRoot>
  )
}
