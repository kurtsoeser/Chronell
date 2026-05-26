import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  format,
  parseISO,
  set
} from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  AlignLeft,
  Calendar as CalendarIcon,
  CheckSquare,
  CircleDot,
  ExternalLink,
  LayoutPanelLeft,
  Loader2,
  MapPin,
  MoreHorizontal,
  Send,
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
import { dueIsoFromClientInput } from '@shared/calendar-datetime'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import { CalendarEventRecurrenceSection } from '@/app/calendar/CalendarEventRecurrenceSection'
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
import { formatAttachmentBytes } from '@/lib/attachment-files'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { openExternalUrl } from '@/lib/open-external'
import { useAccountsStore } from '@/stores/accounts'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import { TipTapBody } from '@/components/TipTapBody'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import { appendHtmlToComposeBody, cloudFileLinkHtml } from '@/lib/compose-cloud-link'
import { CalendarEventDescriptionPreview } from '@/app/calendar/CalendarEventDescriptionPreview'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { LocationAutocompleteInput } from '@/components/LocationAutocompleteInput'
import { ChronellDateField } from '@/components/ChronellDateField'
import { ChronellDatePickerPanel } from '@/components/ChronellDatePickerPanel'
import {
  RecipientTokenField,
  type RecipientTokenFieldHandle
} from '@/components/RecipientTokenField'
import { parseRecipients } from '@/lib/compose-helpers'
import { calendarEventIconIsExplicit } from '@/lib/calendar-event-icons'
import { useThemeStore } from '@/stores/theme'
import { OneDriveExplorerDialog } from '@/components/OneDriveExplorerDialog'

function dateToDatetimeLocal(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

function datetimeLocalToIso(s: string, invalidMsg: string): string {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) throw new Error(invalidMsg)
  return d.toISOString()
}

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

type SchedulePickerKind = 'startTime' | 'endTime' | 'startDate' | 'endDate' | 'dayStart' | 'dayEnd'

function quarterHourTimesForYmd(ymd: string): string[] {
  const base = parseISO(`${ymd}T12:00:00`)
  const out: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      out.push(
        format(set(base, { hours: h, minutes: m, seconds: 0, milliseconds: 0 }), 'HH:mm')
      )
    }
  }
  return out
}

function mergeTimeIntoStart(dtStart: string, hhmm: string): string {
  const d = new Date(dtStart)
  if (Number.isNaN(d.getTime())) return dtStart
  const [hh, mm] = hhmm.split(':').map(Number)
  d.setHours(hh, mm, 0, 0)
  return dateToDatetimeLocal(d)
}

function mergeTimeIntoEnd(dtStart: string, dtEnd: string, hhmm: string): string {
  const d = new Date(dtEnd)
  if (Number.isNaN(d.getTime())) return dtEnd
  const [hh, mm] = hhmm.split(':').map(Number)
  d.setHours(hh, mm, 0, 0)
  const next = dateToDatetimeLocal(d)
  const s = new Date(dtStart)
  const e = new Date(next)
  if (Number.isNaN(s.getTime())) return next
  if (e.getTime() <= s.getTime()) {
    return dateToDatetimeLocal(addMinutes(s, 15))
  }
  return next
}

/** Kalendertag (`yyyy-MM-dd`) in einen `datetime-local`-String einsetzen, Uhrzeit bleibt erhalten. */
function mergeYmdIntoDatetimeLocal(dtLocal: string, ymd: string): string {
  const d = new Date(dtLocal)
  if (Number.isNaN(d.getTime())) return dtLocal
  const parts = ymd.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dtLocal
  const [y, m, day] = parts
  d.setFullYear(y, m - 1, day)
  return dateToDatetimeLocal(d)
}

function fieldChipClass(locked: boolean): string {
  return cn(
    'inline-flex min-h-[30px] max-w-full shrink-0 items-center rounded-md border border-border bg-secondary/35 px-2 py-1 text-base font-medium tabular-nums text-foreground transition-colors',
    'hover:border-border hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
    locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
  )
}

export interface CalendarEventDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  accounts: ConnectedAccount[]
  defaultAccountId?: string
  initialRange?: { start: Date; end: Date; allDay: boolean } | null
  /** Optional: Betreff/Ort beim Anlegen (z. B. Duplizieren aus Kontextmenue). */
  createPrefill?: { subject?: string; location?: string } | null
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
  onSaved: () => void
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
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
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
  onSaved
}: CalendarEventDialogProps): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const dfLocale: Locale = i18n.language.startsWith('de') ? deFns : enUSFns
  const collatorLocale = i18n.language.startsWith('de') ? 'de' : 'en'

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
  const tzDisplay =
    calendarTzConfig?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

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
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [driveOpen, setDriveOpen] = useState(false)
  const [eventAttachments, setEventAttachments] = useState<ComposeAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [showAdvancedDateTime, setShowAdvancedDateTime] = useState(false)
  const [schedulePicker, setSchedulePicker] = useState<SchedulePickerKind | null>(null)
  const [schedulePickerPos, setSchedulePickerPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
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
  const MAX_EVENT_ATTACHMENTS_TOTAL_BYTES = 25 * 1024 * 1024
  const dragDepthRef = useRef(0)

  function hasDraggedFiles(e: React.DragEvent<HTMLElement>): boolean {
    const types = e.dataTransfer?.types
    if (!types) return false
    return Array.from(types).includes('Files')
  }

  async function addFilesAsEventAttachments(files: File[]): Promise<void> {
    if (files.length === 0) return
    if (selectedAccount?.provider !== 'microsoft') {
      setAttachmentError(t('calendar.eventDialog.attachmentProviderUnsupported'))
      return
    }
    setAttachmentError(null)
    const currentTotal = eventAttachments.reduce((s, a) => s + (a.size || 0), 0)
    let running = currentTotal
    const mapped: ComposeAttachment[] = []
    for (const f of files) {
      if (running + f.size > MAX_EVENT_ATTACHMENTS_TOTAL_BYTES) {
        setAttachmentError(
          t('calendar.eventDialog.attachmentMax', {
            maxMb: Math.round(MAX_EVENT_ATTACHMENTS_TOTAL_BYTES / (1024 * 1024)),
            file: f.name
          })
        )
        continue
      }
      const buf = await f.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
      mapped.push({
        name: f.name,
        contentType: f.type || 'application/octet-stream',
        size: f.size,
        dataBase64: btoa(binary)
      })
      running += f.size
    }
    setEventAttachments((prev) => [...prev, ...mapped])
  }

  const handleEditorDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setDraggingFiles(false)
    void addFilesAsEventAttachments(Array.from(e.dataTransfer.files))
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
    void addFilesAsEventAttachments(files)
  }

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
    if (!open) return
    if (mode === 'edit' && !initialEvent) return

    setLocalError(null)
    setBusy(false)
    setShowAdvancedDateTime(false)
    setSchedulePicker(null)
    setSchedulePickerPos(null)
    setDescriptionHtml('')
    setEventAttachments([])
    setAttachmentError(null)
    setCreateKind(initialCreateKind ?? 'event')
    setTaskNotes('')

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
        setDtStart(dateToDatetimeLocal(parseISO(initialEvent.startIso)))
        setDtEnd(dateToDatetimeLocal(parseISO(initialEvent.endIso)))
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
      if (initialRange) {
        setIsAllDay(initialRange.allDay)
        if (initialRange.allDay) {
          setDayStart(format(initialRange.start, 'yyyy-MM-dd'))
          setDayEnd(format(initialRange.end, 'yyyy-MM-dd'))
          setDtStart('')
          setDtEnd('')
        } else {
          setDtStart(dateToDatetimeLocal(initialRange.start))
          setDtEnd(dateToDatetimeLocal(initialRange.end))
          setDayStart('')
          setDayEnd('')
        }
      } else {
        setIsAllDay(false)
        const start = new Date()
        start.setMinutes(0, 0, 0)
        start.setHours(start.getHours() + 1)
        const end = addHours(start, 1)
        setDtStart(dateToDatetimeLocal(start))
        setDtEnd(dateToDatetimeLocal(end))
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
      setTeamsMeeting(false)
      setAttendeeInput('')
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
    taskAccounts
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
    const s = new Date(dtStart)
    const e = new Date(dtEnd)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null
    const ms = e.getTime() - s.getTime()
    const sameDay = format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd')
    const sameYear = format(s, 'yyyy') === format(e, 'yyyy')
    const startDateChip =
      sameDay || sameYear
        ? format(s, 'EEE d. MMM', { locale: dfLocale })
        : format(s, 'EEE d. MMM yyyy', { locale: dfLocale })
    const endDateChip = sameDay
      ? startDateChip
      : format(e, 'EEE d. MMM yyyy', { locale: dfLocale })
    return {
      startHm: format(s, 'HH:mm'),
      endHm: format(e, 'HH:mm'),
      duration: formatDurationMs(ms, t),
      startDateChip,
      endDateChip,
      startYmd: format(s, 'yyyy-MM-dd'),
      endYmd: format(e, 'yyyy-MM-dd')
    }
  }, [isAllDay, dtStart, dtEnd, dfLocale, t])

  const allDayDisplay = useMemo(() => {
    if (!isAllDay || !dayStart || !dayEnd) return null
    try {
      const s = parseISO(`${dayStart}T12:00:00`)
      const endExcl = parseISO(`${dayEnd}T12:00:00`)
      const lastIncl = addDays(endExcl, -1)
      const same = format(s, 'yyyy-MM-dd') === format(lastIncl, 'yyyy-MM-dd')
      return {
        startChip: format(s, 'EEE d. MMM', { locale: dfLocale }),
        endChip: format(lastIncl, 'EEE d. MMM yyyy', { locale: dfLocale }),
        singleDay: same
      }
    } catch {
      return null
    }
  }, [isAllDay, dayStart, dayEnd, dfLocale])

  useEffect(() => {
    if (!schedulePicker) return
    function onDocMouseDown(e: MouseEvent): void {
      const el = schedulePickerRef.current
      if (!el || el.contains(e.target as Node)) return
      setSchedulePicker(null)
      setSchedulePickerPos(null)
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setSchedulePicker(null)
        setSchedulePickerPos(null)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return (): void => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [schedulePicker])

  useLayoutEffect(() => {
    if (schedulePicker !== 'startTime' && schedulePicker !== 'endTime') return
    const btn = selectedTimeOptionRef.current
    if (!btn) return
    btn.scrollIntoView({ block: 'nearest' })
  }, [schedulePicker, dtStart, dtEnd])

  /** Formularfelder gesperrt (Busy oder Kalender nur lesbar). */
  const eventFieldsLocked = useMemo(
    () => busy || (mode === 'edit' && initialEvent?.calendarCanEdit === false),
    [busy, mode, initialEvent?.calendarCanEdit]
  )

  /** Outlook-Masterkategorien nur fuer Microsoft-Konten laden. */
  const useOutlookCategories = mode === 'edit' && initialEvent?.source === 'microsoft'

  useEffect(() => {
    if (!open || !useOutlookCategories || !accountId) {
      setMasterCategories([])
      setMastersLoading(false)
      return
    }
    let cancelled = false
    setMastersLoading(true)
    void window.mailClient.mail
      .listMasterCategories(accountId)
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
  }, [open, useOutlookCategories, accountId])

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
  const schedulePickerRef = useRef<HTMLDivElement>(null)
  const selectedTimeOptionRef = useRef<HTMLButtonElement>(null)

  const selectedAccount = useMemo(
    () => calendarAccounts.find((a) => a.id === accountId),
    [calendarAccounts, accountId]
  )
  const cloudLinkAccount = selectedAccount?.provider === 'microsoft' ? selectedAccount : null

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
        setAttendeeInput(d.attendeeEmails.join(', '))
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
  }, [open, mode, initialEvent])

  const msTeamsUiLocked = useMemo(
    () =>
      eventFieldsLocked ||
      (mode === 'edit' && initialEvent?.source === 'microsoft' && msEventDetailsLoading),
    [eventFieldsLocked, mode, initialEvent?.source, msEventDetailsLoading]
  )

  if (!open) return null

  function closeSchedulePicker(): void {
    setSchedulePicker(null)
    setSchedulePickerPos(null)
  }

  function openSchedulePicker(kind: SchedulePickerKind, anchorEl: HTMLElement | null): void {
    if (eventFieldsLocked || !anchorEl) return
    const r = anchorEl.getBoundingClientRect()
    const margin = 8
    const dateKind =
      kind === 'startDate' ||
      kind === 'endDate' ||
      kind === 'dayStart' ||
      kind === 'dayEnd'
    const popW = dateKind ? 248 : 208
    const listMax = dateKind ? 320 : 260
    let left = r.left
    if (left + popW > window.innerWidth - margin) left = window.innerWidth - popW - margin
    if (left < margin) left = margin
    let top = r.bottom + 6
    if (top + listMax > window.innerHeight - margin) {
      top = r.top - 6 - listMax
      if (top < margin) top = margin
    }
    setSchedulePickerPos({ top, left, width: popW })
    setSchedulePicker(kind)
  }

  const timePickerYmd =
    schedulePicker === 'startTime'
      ? (dtStart.length >= 10 ? dtStart.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'))
      : schedulePicker === 'endTime'
        ? (dtEnd.length >= 10 ? dtEnd.slice(0, 10) : dtStart.slice(0, 10) || format(new Date(), 'yyyy-MM-dd'))
        : ''
  const timePickerOptions =
    schedulePicker === 'startTime' || schedulePicker === 'endTime'
      ? quarterHourTimesForYmd(timePickerYmd)
      : []
  const timePickerCurrentHm =
    schedulePicker === 'startTime'
      ? dtStart
        ? format(new Date(dtStart), 'HH:mm')
        : ''
      : schedulePicker === 'endTime'
        ? dtEnd
          ? format(new Date(dtEnd), 'HH:mm')
          : ''
        : ''

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
          ...(taskRecurrence ? { recurrence: taskRecurrence } : {})
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
        startIso = datetimeLocalToIso(dtStart, invalid)
        endIso = datetimeLocalToIso(dtEnd, invalid)
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
      : sanitizeComposeHtmlFragment(descriptionHtml.trim())

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
          ...(selectedAccount?.provider === 'microsoft' && eventAttachments.length > 0
            ? { attachments: eventAttachments }
            : {}),
          ...(recurrence ? { recurrence } : {})
        })
        if (calendarEventIconIsExplicit(eventIconId) && created.id?.trim()) {
          await window.mailClient.calendar.patchEventIcon({
            accountId,
            graphEventId: created.id.trim(),
            iconId: eventIconId
          })
        }
        const graphEventId = created.id?.trim()
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
          ...(initialEvent.source === 'microsoft' && eventAttachments.length > 0
            ? { attachments: eventAttachments }
            : {})
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
      onSaved()
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const isTaskCreate = mode === 'create' && createKind === 'task'
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

  return (
    <ModalRoot
      open={open}
      zIndex={100}
      centerClassName="justify-end bg-black/45 backdrop-blur-[2px]"
      onBackdropClick={onClose}
    >
      <ModalPanel
        variant="drawer-right"
        className="calendar-event-panel flex h-[100dvh] max-h-[100dvh] w-full max-w-[630px] flex-col overflow-hidden border-l border-border bg-card text-foreground shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          {mode === 'create' && taskAccounts.length > 0 ? (
            <div>
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
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground opacity-50"
              tabIndex={-1}
              aria-hidden
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground opacity-50"
              tabIndex={-1}
              aria-hidden
            >
              <LayoutPanelLeft className="h-4 w-4" />
            </button>
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
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(ev): void => void handleSubmit(ev)}
        >
          <div className="min-h-0 flex-1 space-y-0 overflow-y-auto px-4 py-3">
            <div className="flex items-start gap-2 border-b border-border pb-3">
              {mode === 'create' && createKind === 'task' ? (
                <CheckSquare className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <CalendarEventIconPicker
                  layout="compact"
                  iconId={eventIconId}
                  title={subject}
                  disabled={eventFieldsLocked}
                  onIconChange={setEventIconId}
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

            {mode === 'create' && createKind === 'task' && taskAccounts.length > 0 ? (
              <div className="border-b border-border py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('calendar.eventDialog.taskDestinationHeadingShort')}
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {t('calendar.eventDialog.taskDestinationHelpBody')}
                </p>
                <label className="mt-2 block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('tasks.create.account')}</span>
                  <select
                    value={taskAccountId}
                    disabled={busy || taskListsLoading}
                    onChange={(e): void => setTaskAccountId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {taskAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {cloudTaskAccountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-2 block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('tasks.create.list')}</span>
                  <select
                    value={taskListId}
                    disabled={busy || taskListsLoading || taskLists.length === 0}
                    onChange={(e): void => setTaskListId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
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
            ) : null}

            {mode === 'create' && createKind === 'event' && calendarAccounts.length > 0 ? (
              <div className="border-b border-border py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('calendar.eventDialog.destinationHeadingShort')}
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {t('calendar.eventDialog.destinationHelpBody')}
                </p>
                <select
                  value={destinationSelectValue}
                  disabled={false || calendarsLoading}
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

            {mode === 'create' && createKind === 'task' ? (
              <div className="border-b border-border py-3 space-y-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                  {t('tasks.create.planned')}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-xs">
                    <span className="text-muted-foreground">{t('tasks.create.plannedStart')}</span>
                    <input
                      type="datetime-local"
                      value={taskPlannedStart}
                      onChange={(e): void => setTaskPlannedStart(e.target.value)}
                      disabled={busy}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-base"
                    />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="text-muted-foreground">{t('tasks.create.plannedEnd')}</span>
                    <input
                      type="datetime-local"
                      value={taskPlannedEnd}
                      onChange={(e): void => setTaskPlannedEnd(e.target.value)}
                      disabled={busy}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-base"
                    />
                  </label>
                </div>
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">{t('tasks.create.due')}</span>
                  <ChronellDateField
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
                    disabled={busy}
                  />
                </label>
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
                />
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">{t('tasks.create.notes')}</span>
                  <textarea
                    value={taskNotes}
                    onChange={(e): void => setTaskNotes(e.target.value)}
                    disabled={busy}
                    rows={4}
                    className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-base"
                  />
                </label>
              </div>
            ) : (
            <div className="border-b border-border py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                {t('calendar.eventDialog.appointmentHeading')}
              </div>

              {!isAllDay && timedDisplay ? (
                <>
                  <div className="grid w-fit max-w-full grid-cols-[auto_auto_auto_1fr] items-center gap-x-2 gap-y-1.5 text-[14px]">
                    <button
                      type="button"
                      disabled={eventFieldsLocked}
                      aria-label={t('calendar.eventDialog.editStartTimeAria')}
                      onClick={(ev): void => openSchedulePicker('startTime', ev.currentTarget)}
                      className={fieldChipClass(eventFieldsLocked)}
                    >
                      {timedDisplay.startHm}
                    </button>
                    <span className="text-muted-foreground" aria-hidden>
                      →
                    </span>
                    <button
                      type="button"
                      disabled={eventFieldsLocked}
                      aria-label={t('calendar.eventDialog.editEndTimeAria')}
                      onClick={(ev): void => openSchedulePicker('endTime', ev.currentTarget)}
                      className={fieldChipClass(eventFieldsLocked)}
                    >
                      {timedDisplay.endHm}
                    </button>
                    <span className="min-w-0 text-base tabular-nums text-muted-foreground">
                      · {timedDisplay.duration}
                    </span>
                    <button
                      type="button"
                      disabled={eventFieldsLocked}
                      aria-label={t('calendar.eventDialog.editStartDateAria')}
                      onClick={(ev): void => openSchedulePicker('startDate', ev.currentTarget)}
                      className={fieldChipClass(eventFieldsLocked)}
                    >
                      {timedDisplay.startDateChip}
                    </button>
                    <span className="select-none text-transparent" aria-hidden>
                      →
                    </span>
                    <button
                      type="button"
                      disabled={eventFieldsLocked}
                      aria-label={t('calendar.eventDialog.editEndDateAria')}
                      onClick={(ev): void => openSchedulePicker('endDate', ev.currentTarget)}
                      className={fieldChipClass(eventFieldsLocked)}
                    >
                      {timedDisplay.endDateChip}
                    </button>
                    <span aria-hidden className="min-w-0" />
                  </div>
                </>
              ) : isAllDay && allDayDisplay ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground">{t('calendar.eventDialog.allDay')}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
                    <button
                      type="button"
                      disabled={eventFieldsLocked}
                      aria-label={t('calendar.eventDialog.editAllDayStartAria')}
                      onClick={(ev): void => openSchedulePicker('dayStart', ev.currentTarget)}
                      className={fieldChipClass(eventFieldsLocked)}
                    >
                      {allDayDisplay.startChip}
                    </button>
                    <span className="text-muted-foreground" aria-hidden>
                      →
                    </span>
                    <button
                      type="button"
                      disabled={eventFieldsLocked}
                      aria-label={t('calendar.eventDialog.editAllDayEndAria')}
                      onClick={(ev): void => openSchedulePicker('dayEnd', ev.currentTarget)}
                      className={fieldChipClass(eventFieldsLocked)}
                    >
                      {allDayDisplay.endChip}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-base text-muted-foreground">{t('calendar.eventDialog.summaryDash')}</p>
              )}

              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button
                    type="button"
                    disabled={eventFieldsLocked}
                    onClick={(): void => {
                      setSchedulePicker(null)
                      setSchedulePickerPos(null)
                      setIsAllDay((prev) => {
                        if (!prev) {
                          if (dtStart && dtEnd) {
                            const s = new Date(dtStart)
                            const e = new Date(dtEnd)
                            if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
                              const startDay = format(s, 'yyyy-MM-dd')
                              const endDay = format(e, 'yyyy-MM-dd')
                              const lastInclusive = endDay >= startDay ? endDay : startDay
                              setDayStart(startDay)
                              setDayEnd(
                                format(addDays(parseISO(`${lastInclusive}T12:00:00`), 1), 'yyyy-MM-dd')
                              )
                            }
                          }
                          return true
                        }
                        if (dayStart) {
                          const base = parseISO(`${dayStart}T09:00:00`)
                          setDtStart(dateToDatetimeLocal(base))
                          setDtEnd(dateToDatetimeLocal(addHours(base, 1)))
                        }
                        return false
                      })
                    }}
                    className={cn(
                      'font-medium transition-colors',
                      isAllDay ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t('calendar.eventDialog.allDay')}
                  </button>
                  <span className="text-muted-foreground" title={t('calendar.eventDialog.timezoneTitle')}>
                    {t('calendar.eventDialog.timezonePrefix')}{' '}
                    <span className="text-foreground/90">{tzDisplay}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(): void => setShowAdvancedDateTime((s) => !s)}
                  className="w-fit text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {showAdvancedDateTime
                    ? t('calendar.eventDialog.advancedDateTimeHide')
                    : t('calendar.eventDialog.advancedDateTime')}
                </button>
              </div>
              {showAdvancedDateTime && (
                <div className="mt-3 space-y-2 rounded-lg border border-border/50 bg-secondary/25 p-3">
                  {isAllDay ? (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        <span className="mb-1 block text-muted-foreground">
                          {t('calendar.eventDialog.labelStartDate')}
                        </span>
                        <ChronellDateField
                          value={dayStart}
                          onChange={setDayStart}
                          disabled={eventFieldsLocked}
                          className="text-xs"
                        />
                      </label>
                      <label className="text-xs">
                        <span className="mb-1 block text-muted-foreground">
                          {t('calendar.eventDialog.labelEndExclusive')}
                        </span>
                        <ChronellDateField
                          value={dayEnd}
                          onChange={setDayEnd}
                          disabled={eventFieldsLocked}
                          className="text-xs"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        <span className="mb-1 block text-muted-foreground">
                          {t('calendar.eventDialog.labelBegin')}
                        </span>
                        <input
                          type="datetime-local"
                          value={dtStart}
                          onChange={(e): void => setDtStart(e.target.value)}
                          disabled={eventFieldsLocked}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs">
                        <span className="mb-1 block text-muted-foreground">
                          {t('calendar.eventDialog.labelEnd')}
                        </span>
                        <input
                          type="datetime-local"
                          value={dtEnd}
                          onChange={(e): void => setDtEnd(e.target.value)}
                          disabled={eventFieldsLocked}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {mode === 'create' && createKind === 'event' ? (
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
              />
            ) : null}

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
                <PropertyRow icon={Video} label={t('calendar.eventDialog.teamsMeetingRowLabel')}>
                  <div className="space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-2 text-base">
                      <input
                        type="checkbox"
                        checked={teamsMeeting}
                        disabled={isAllDay || msTeamsUiLocked}
                        onChange={(e): void => setTeamsMeeting(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span>{t('calendar.eventDialog.teamsMeetingToggle')}</span>
                    </label>
                    {isAllDay ? (
                      <p className="text-2xs text-muted-foreground">{t('calendar.eventDialog.teamsDisabledAllDay')}</p>
                    ) : null}
                    {msEventDetailsError ? (
                      <p className="text-2xs text-destructive" role="status">
                        {msEventDetailsError}
                      </p>
                    ) : null}
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
              <PropertyRow icon={CircleDot} label={t('calendar.eventDialog.categories')}>
                {selectedAccount?.provider !== 'microsoft' ? (
                  <span className="text-xs text-muted-foreground">
                    {t('calendar.eventDialog.categoriesOutlookOnly')}
                  </span>
                ) : mastersLoading && categoryChoiceNames.length === 0 ? (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('calendar.eventDialog.loadingShort')}
                  </span>
                ) : (
                  <div className="space-y-2">
                    {categoryChoiceNames.length === 0 ? (
                      <p className="text-xs leading-snug text-muted-foreground">
                        {t('calendar.eventDialog.categoriesEmptyOutlook')}
                      </p>
                    ) : (
                      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
                        {categoryChoiceNames.map((name) => {
                          const on = eventCategories.includes(name)
                          const dotClass = outlookCategoryDotClass(categoryColorByName.get(name))
                          return (
                            <button
                              key={name}
                              type="button"
                              disabled={busy}
                              onClick={(): void => toggleEventCategory(name)}
                              className={cn(
                                'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                                on
                                  ? 'border-primary/40 bg-primary/15 text-foreground'
                                  : 'border-border/80 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                              )}
                              title={name}
                            >
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />
                              <span className="truncate">{name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <p className="text-2xs leading-snug text-muted-foreground">
                      {t('calendar.eventDialog.categoriesMasterHint')}
                    </p>
                  </div>
                )}
              </PropertyRow>
              <PropertyRow icon={MapPin} label={t('calendar.eventDialog.locationRowLabel')}>
                <LocationAutocompleteInput
                  value={location}
                  onChange={setLocation}
                  disabled={eventFieldsLocked}
                />
              </PropertyRow>
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
                      <TipTapBody
                        valueHtml={descriptionHtml}
                        onChangeHtml={setDescriptionHtml}
                        placeholder={t('calendar.eventDialog.descriptionEditorPlaceholder')}
                        onAttachFiles={
                          cloudLinkAccount
                            ? (files): void => {
                                void addFilesAsEventAttachments(files)
                              }
                            : undefined
                        }
                        attachmentCount={eventAttachments.length}
                        onCloudAttach={cloudLinkAccount ? (): void => setDriveOpen(true) : undefined}
                        editorMinHeightClass="min-h-[440px]"
                        className="min-h-[520px] rounded-md border border-border bg-background !border-t-0"
                      />
                      {draggingFiles ? (
                        <p className="px-2 pb-2 text-2xs text-muted-foreground">
                          {t('calendar.eventDialog.attachmentsDropHint')}
                        </p>
                      ) : null}
                      {attachmentError ? (
                        <p className="text-2xs text-destructive">{attachmentError}</p>
                      ) : null}
                      {eventAttachments.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-2xs font-medium text-muted-foreground">
                            {t('calendar.eventDialog.attachments')}
                          </p>
                          <div className="space-y-1">
                            {eventAttachments.map((a, idx) => (
                              <div
                                key={`${a.name}-${idx}`}
                                className="flex items-center justify-between gap-2 rounded border border-border/70 bg-muted/20 px-2 py-1"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs text-foreground">{a.name}</p>
                                  <p className="text-2xs text-muted-foreground">
                                    {formatAttachmentBytes(a.size || 0)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(): void =>
                                    setEventAttachments((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="text-2xs text-muted-foreground hover:text-foreground"
                                >
                                  {t('common.remove')}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
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
                      void openExternalUrl(initialEvent.webLink!).catch(() => undefined)
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
                      void openExternalUrl(initialEvent.joinUrl!).catch(() => undefined)
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
        </form>
      </ModalPanel>

      {schedulePicker && schedulePickerPos ? (
        <div
          ref={schedulePickerRef}
          role="dialog"
          aria-label={t('calendar.eventDialog.schedulePickerAria')}
          className="chronell-acrylic-popover fixed z-[220] max-w-[calc(100vw-16px)] overflow-hidden text-popover-foreground"
          style={{
            top: schedulePickerPos.top,
            left: schedulePickerPos.left,
            width: schedulePickerPos.width
          }}
          onMouseDown={(ev): void => ev.stopPropagation()}
          onClick={(ev): void => ev.stopPropagation()}
        >
          {(schedulePicker === 'startTime' || schedulePicker === 'endTime') && (
            <ul className="max-h-60 overflow-y-auto py-1">
              {timePickerOptions.map((hm) => {
                const sel = hm === timePickerCurrentHm
                return (
                  <li key={`${schedulePicker}-${hm}`}>
                    <button
                      type="button"
                      ref={sel ? selectedTimeOptionRef : undefined}
                      className={cn(
                        'w-full rounded-md px-2.5 py-1.5 text-left text-base tabular-nums transition-colors',
                        sel
                          ? 'bg-primary/15 font-medium text-foreground'
                          : 'text-foreground hover:bg-secondary/80'
                      )}
                      onClick={(): void => {
                        if (schedulePicker === 'startTime') {
                          const nextStart = mergeTimeIntoStart(dtStart, hm)
                          setDtStart(nextStart)
                          if (new Date(dtEnd).getTime() <= new Date(nextStart).getTime()) {
                            setDtEnd(dateToDatetimeLocal(addMinutes(new Date(nextStart), 15)))
                          }
                        } else {
                          setDtEnd(mergeTimeIntoEnd(dtStart, dtEnd, hm))
                        }
                        closeSchedulePicker()
                      }}
                    >
                      {hm}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {schedulePicker === 'startDate' && timedDisplay ? (
            <div className="p-1.5">
              <ChronellDatePickerPanel
                value={timedDisplay.startYmd}
                disabled={eventFieldsLocked}
                onChange={(v): void => {
                  if (!v) return
                  const nextStart = mergeYmdIntoDatetimeLocal(dtStart, v)
                  setDtStart(nextStart)
                  if (new Date(dtEnd).getTime() <= new Date(nextStart).getTime()) {
                    setDtEnd(dateToDatetimeLocal(addMinutes(new Date(nextStart), 15)))
                  }
                }}
                onPick={closeSchedulePicker}
              />
            </div>
          ) : null}

          {schedulePicker === 'endDate' && timedDisplay ? (
            <div className="p-1.5">
              <ChronellDatePickerPanel
                value={timedDisplay.endYmd}
                min={timedDisplay.startYmd}
                disabled={eventFieldsLocked}
                onChange={(v): void => {
                  if (!v) return
                  const nextEnd = mergeYmdIntoDatetimeLocal(dtEnd, v)
                  if (new Date(nextEnd).getTime() <= new Date(dtStart).getTime()) {
                    setDtEnd(dateToDatetimeLocal(addMinutes(new Date(dtStart), 15)))
                  } else {
                    setDtEnd(nextEnd)
                  }
                }}
                onPick={closeSchedulePicker}
              />
            </div>
          ) : null}

          {schedulePicker === 'dayStart' ? (
            <div className="p-1.5">
              <ChronellDatePickerPanel
                value={dayStart}
                disabled={eventFieldsLocked}
                onChange={(v): void => {
                  if (!v) return
                  setDayStart(v)
                  if (dayEnd <= v) {
                    setDayEnd(format(addDays(parseISO(`${v}T12:00:00`), 1), 'yyyy-MM-dd'))
                  }
                }}
                onPick={closeSchedulePicker}
              />
            </div>
          ) : null}

          {schedulePicker === 'dayEnd' && dayStart && dayEnd ? (
            <div className="space-y-1.5 p-1.5">
              <p className="text-2xs leading-snug text-muted-foreground">
                {t('calendar.eventDialog.allDayEndLastDayHint')}
              </p>
              <ChronellDatePickerPanel
                min={dayStart}
                value={format(addDays(parseISO(`${dayEnd}T12:00:00`), -1), 'yyyy-MM-dd')}
                disabled={eventFieldsLocked}
                onChange={(v): void => {
                  if (!v) return
                  const excl = format(addDays(parseISO(`${v}T12:00:00`), 1), 'yyyy-MM-dd')
                  if (excl <= dayStart) {
                    setDayEnd(format(addDays(parseISO(`${dayStart}T12:00:00`), 1), 'yyyy-MM-dd'))
                  } else {
                    setDayEnd(excl)
                  }
                }}
                onPick={closeSchedulePicker}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {cloudLinkAccount ? (
        <OneDriveExplorerDialog
          open={driveOpen}
          accountId={cloudLinkAccount.id}
          configureSharingLink={false}
          onClose={(): void => setDriveOpen(false)}
          onPickFile={(file): void => {
            setDescriptionHtml((prev) =>
              appendHtmlToComposeBody(prev, cloudFileLinkHtml(file.name, file.webUrl))
            )
          }}
        />
      ) : null}
    </ModalRoot>
  )
}
