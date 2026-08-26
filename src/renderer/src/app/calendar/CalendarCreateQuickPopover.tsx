import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMinutes, format, parseISO, startOfDay } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { Calendar as CalendarIcon, CheckSquare, FileText, LayoutTemplate, Loader2, Paperclip, Video, X } from 'lucide-react'
import type {
  CalendarEventView,
  CalendarGraphCalendarRow,
  ConnectedAccount,
  TaskListRow
} from '@shared/types'
import { dueIsoFromClientInput } from '@shared/calendar-datetime'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import {
  calendarDestinationKey,
  destinationAccountOptgroupLabel,
  isWritableCalendarTarget,
  parseCalendarDestinationKey
} from '@/app/calendar/calendar-create-destination'
import {
  scheduleFromCalendarCreateRange,
  type CalendarCreateRange
} from '@/app/tasks/tasks-calendar-create-range'
import {
  persistTasksCalendarCreateAccountId,
  readTasksCalendarCreateAccountId
} from '@/app/tasks/tasks-calendar-create-storage'
import { ChronellDateField } from '@/components/ChronellDateField'
import { ChronellTimeField } from '@/components/ChronellTimeField'
import {
  addMinutesToDate,
  mergeHmIntoDate,
  mergeHmIntoEndAfterStart,
  mergeYmdIntoDate
} from '@/lib/calendar-time-select'
import { eventDialogPanelSelectClass } from '@/lib/chronell-ui-classes'
import {
  datetimeLocalValueToIso,
  isoToDatetimeLocalValue
} from '@/app/work-items/work-item-datetime'
import { cloudTaskAccountOptionLabel } from '@/lib/cloud-task-accounts'
import { CalendarEventAttachmentsPanel } from '@/app/calendar/CalendarEventAttachmentsPanel'
import { useCalendarEventAttachments } from '@/app/calendar/useCalendarEventAttachments'
import { cn } from '@/lib/utils'
import {
  readCalendarEventTemplates,
  type CalendarEventTemplate
} from '@/lib/calendar-event-templates-storage'

export type CalendarCreateQuickKind = 'event' | 'task'

export type CalendarCreateQuickDraft = {
  createKind: CalendarCreateQuickKind
  subject: string
  range: CalendarCreateRange
  accountId: string
  graphCalendarId: string
  taskListId: string
  isAllDay: boolean
  createPrefill?: {
    location?: string
    descriptionHtml?: string
    teamsMeeting?: boolean
  }
}

function pickDefaultTaskListId(rows: TaskListRow[]): string | null {
  if (rows.length === 0) return null
  return rows.find((r) => r.isDefault)?.id ?? rows[0]!.id
}

function resolvePreferredTaskAccountId(
  taskAccounts: ConnectedAccount[],
  defaultAccountId?: string
): string {
  if (defaultAccountId && taskAccounts.some((a) => a.id === defaultAccountId)) {
    return defaultAccountId
  }
  const stored = readTasksCalendarCreateAccountId()
  if (stored && taskAccounts.some((a) => a.id === stored)) return stored
  return taskAccounts[0]?.id ?? ''
}

function buildWebinarDescriptionHtml(t: (key: string) => string): string {
  return [
    `<p><strong>${t('calendar.quickCreate.webinarTemplateHeading')}</strong></p>`,
    `<ul><li>${t('calendar.quickCreate.webinarTemplateAgenda')}</li><li>${t('calendar.quickCreate.webinarTemplateQa')}</li></ul>`,
    `<p>${t('calendar.quickCreate.webinarTemplateJoinHint')}</p>`
  ].join('')
}

export interface CalendarCreateQuickPopoverProps {
  anchor: { x: number; y: number }
  range: CalendarCreateRange
  calendarAccounts: ConnectedAccount[]
  taskAccounts: ConnectedAccount[]
  defaultAccountId?: string
  loadListsForAccount: (accountId: string) => Promise<TaskListRow[]>
  onClose: () => void
  onSaved: (created?: CalendarEventView) => void
  /** Nach erfolgreichem Anlegen (z. B. Verbindungen-Canvas). */
  onEntityCreated?: (payload: { ref: ChronellEntityRef; title: string }) => void
  onOpenDetails: (draft: CalendarCreateQuickDraft) => void
  /** Hält den Kalender-Platzhalter mit der gewählten Zeit synchron. */
  onRangeChange?: (range: CalendarCreateRange) => void
}

export function CalendarCreateQuickPopover({
  anchor,
  range,
  calendarAccounts,
  taskAccounts,
  defaultAccountId,
  loadListsForAccount,
  onClose,
  onSaved,
  onEntityCreated,
  onOpenDetails,
  onRangeChange
}: CalendarCreateQuickPopoverProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const [createKind, setCreateKind] = useState<CalendarCreateQuickKind>(
    calendarAccounts.length > 0 ? 'event' : 'task'
  )
  const [subject, setSubject] = useState('')
  const [isAllDay, setIsAllDay] = useState(range.allDay)
  const [rangeStart, setRangeStart] = useState(() => new Date(range.start))
  const [rangeEnd, setRangeEnd] = useState(() => new Date(range.end))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [accountId, setAccountId] = useState('')
  const [graphCalendarId, setGraphCalendarId] = useState('')
  const [destinationSelectValue, setDestinationSelectValue] = useState('')
  const [calendarsByAccount, setCalendarsByAccount] = useState<
    { account: ConnectedAccount; calendars: CalendarGraphCalendarRow[] }[]
  >([])
  const [calendarsLoading, setCalendarsLoading] = useState(false)

  const [taskAccountId, setTaskAccountId] = useState('')
  const [taskListId, setTaskListId] = useState('')
  const [taskLists, setTaskLists] = useState<TaskListRow[]>([])
  const [taskListsLoading, setTaskListsLoading] = useState(false)

  const calendarAccountIdsKey = useMemo(
    () =>
      calendarAccounts
        .map((a) => a.id)
        .sort()
        .join('|'),
    [calendarAccounts]
  )

  const selectedCalendarAccount = useMemo(
    () => calendarAccounts.find((a) => a.id === accountId),
    [calendarAccounts, accountId]
  )
  const supportsTeamsWebinar = createKind === 'event' && selectedCalendarAccount?.provider === 'microsoft'
  const availableTemplates = useMemo(
    () => (createKind === 'event' ? readCalendarEventTemplates() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createKind, accountId]
  )
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false)

  useEffect(() => {
    if (!templateDropdownOpen) return
    function close(): void { setTemplateDropdownOpen(false) }
    document.addEventListener('mousedown', close)
    return (): void => document.removeEventListener('mousedown', close)
  }, [templateDropdownOpen])

  const eventAttachmentsApi = useCalendarEventAttachments({
    account: selectedCalendarAccount,
    enabled: createKind === 'event'
  })

  const currentRange = useMemo(
    (): CalendarCreateRange => ({
      start: rangeStart,
      end: rangeEnd,
      allDay: isAllDay
    }),
    [rangeStart, rangeEnd, isAllDay]
  )

  const timedStartYmd = useMemo(() => format(rangeStart, 'yyyy-MM-dd'), [rangeStart])
  const timedStartHm = useMemo(() => format(rangeStart, 'HH:mm'), [rangeStart])
  const timedEndYmd = useMemo(() => format(rangeEnd, 'yyyy-MM-dd'), [rangeEnd])
  const timedEndHm = useMemo(() => format(rangeEnd, 'HH:mm'), [rangeEnd])

  useEffect(() => {
    onRangeChange?.(currentRange)
  }, [currentRange, onRangeChange])

  useEffect(() => {
    setIsAllDay(range.allDay)
    setRangeStart(new Date(range.start))
    setRangeEnd(new Date(range.end))
    setSubject('')
    setError(null)
    setBusy(false)
    eventAttachmentsApi.reset()
    setCreateKind(calendarAccounts.length > 0 ? 'event' : 'task')
    const preferTaskAcc = resolvePreferredTaskAccountId(taskAccounts, defaultAccountId)
    setTaskAccountId(preferTaskAcc)
    setTaskListId('')
    setTaskLists([])
    window.setTimeout(() => titleRef.current?.focus(), 0)
    // Nur beim Öffnen (Popover wird bei jedem Quick-Create neu gemountet).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (createKind !== 'event' || calendarAccounts.length === 0) {
      setCalendarsByAccount([])
      setDestinationSelectValue('')
      return
    }
    let cancelled = false
    setCalendarsLoading(true)
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
        const preferAcc =
          defaultAccountId && calendarAccounts.some((a) => a.id === defaultAccountId)
            ? defaultAccountId
            : (calendarAccounts[0]?.id ?? '')
        const bundle = bundles.find((b) => b.account.id === preferAcc) ?? bundles[0]
        if (!bundle) {
          setDestinationSelectValue('')
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
  }, [createKind, calendarAccountIdsKey, defaultAccountId, calendarAccounts])

  useEffect(() => {
    if (createKind !== 'task' || !taskAccountId) {
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
        setTaskListId(pickDefaultTaskListId(rows) ?? '')
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
  }, [createKind, taskAccountId, loadListsForAccount])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent): void {
      const el = panelRef.current
      if (!el || el.contains(e.target as Node)) return
      onClose()
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown, true)
    return (): void => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [onClose])

  const toggleAllDay = useCallback((next: boolean): void => {
    if (next) {
      const s = startOfDay(rangeStart)
      let endExcl = startOfDay(rangeEnd)
      if (endExcl.getTime() <= s.getTime()) endExcl = addDays(s, 1)
      setRangeStart(s)
      setRangeEnd(endExcl)
    } else {
      const s = new Date(rangeStart)
      if (s.getHours() === 0 && s.getMinutes() === 0 && s.getSeconds() === 0) {
        s.setHours(9, 0, 0, 0)
      }
      let e = new Date(rangeEnd)
      if (e.getTime() <= s.getTime()) e = addMinutes(s, 30)
      setRangeStart(s)
      setRangeEnd(e)
    }
    setIsAllDay(next)
  }, [rangeStart, rangeEnd])

  const validateRange = useCallback((): string | null => {
    if (isAllDay) {
      if (rangeEnd.getTime() <= rangeStart.getTime()) {
        return t('calendar.eventDialog.endAfterStartExclusive')
      }
      return null
    }
    if (rangeEnd.getTime() <= rangeStart.getTime()) {
      return t('calendar.eventDialog.endAfterStart')
    }
    return null
  }, [isAllDay, rangeStart, rangeEnd, t])

  const buildDraft = useCallback((): CalendarCreateQuickDraft | null => {
    if (!subject.trim()) return null
    if (createKind === 'event') {
      if (!parseCalendarDestinationKey(destinationSelectValue)) return null
      return {
        createKind: 'event',
        subject: subject.trim(),
        range: currentRange,
        accountId,
        graphCalendarId,
        taskListId: '',
        isAllDay
      }
    }
    if (!taskAccountId || !taskListId) return null
    return {
      createKind: 'task',
      subject: subject.trim(),
      range: currentRange,
      accountId: taskAccountId,
      graphCalendarId: '',
      taskListId,
      isAllDay
    }
  }, [
    subject,
    createKind,
    destinationSelectValue,
    accountId,
    graphCalendarId,
    taskAccountId,
    taskListId,
    currentRange,
    isAllDay
  ])

  async function handleSave(): Promise<void> {
    const rangeError = validateRange()
    if (rangeError) {
      setError(rangeError)
      return
    }
    const draft = buildDraft()
    if (!draft) {
      if (!subject.trim()) setError(t('calendar.eventDialog.enterTitle'))
      else if (createKind === 'task' && !taskListId) {
        setError(t('calendar.eventDialog.selectTaskList'))
      } else {
        setError(t('calendar.eventDialog.selectTargetCalendar'))
      }
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (draft.createKind === 'task') {
        const sched = scheduleFromCalendarCreateRange(draft.range, timeZone)
        const dueIso = dueIsoFromClientInput(sched.dueDate.trim() || null)
        const plannedStartIso = datetimeLocalValueToIso(isoToDatetimeLocalValue(sched.plannedStartIso))
        const plannedEndIso = datetimeLocalValueToIso(isoToDatetimeLocalValue(sched.plannedEndIso))
        const row = await window.mailClient.tasks.createTask({
          accountId: draft.accountId,
          listId: draft.taskListId,
          title: draft.subject,
          notes: null,
          dueIso,
          completed: false
        })
        if (plannedStartIso && plannedEndIso) {
          const taskKey = cloudTaskStableKey(draft.accountId, draft.taskListId, row.id)
          await applyCloudTaskPersistTarget(
            { kind: 'planned', taskKey, plannedStartIso, plannedEndIso },
            { accountId: draft.accountId, listId: draft.taskListId, id: row.id },
            timeZone
          )
        }
        persistTasksCalendarCreateAccountId(draft.accountId)
        onEntityCreated?.({
          ref: {
            kind: 'cloud_task',
            accountId: draft.accountId,
            listId: draft.taskListId,
            taskId: row.id
          },
          title: draft.subject
        })
      } else {
        let startIso: string
        let endIso: string
        if (draft.isAllDay) {
          startIso = format(draft.range.start, 'yyyy-MM-dd')
          endIso = format(draft.range.end, 'yyyy-MM-dd')
        } else {
          startIso = draft.range.start.toISOString()
          endIso = draft.range.end.toISOString()
        }
        const created = await window.mailClient.calendar.createEvent({
          accountId: draft.accountId,
          graphCalendarId: draft.graphCalendarId.trim() || null,
          subject: draft.subject,
          startIso,
          endIso,
          isAllDay: draft.isAllDay,
          location: null,
          bodyHtml: null,
          categories: [],
          ...eventAttachmentsApi.buildSavePayload()
        })
        const graphEventId = created.id?.trim()
        if (graphEventId) {
          onEntityCreated?.({
            ref: { kind: 'calendar_event', accountId: draft.accountId, graphEventId },
            title: draft.subject
          })
        }
        onClose()
        onSaved(created.event)
        return
      }
      onClose()
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function handleOpenDetails(asWebinar: boolean, template?: CalendarEventTemplate): void {
    onOpenDetails({
      createKind,
      subject: subject.trim() || (template?.defaultSubject ?? ''),
      range: currentRange,
      accountId: createKind === 'event' ? accountId : taskAccountId,
      graphCalendarId,
      taskListId,
      isAllDay,
      createPrefill: template
        ? {
            location: template.defaultLocation,
            teamsMeeting: template.teamsMeeting,
            descriptionHtml: template.descriptionHtml
          }
        : asWebinar && supportsTeamsWebinar
          ? {
              location: '',
              teamsMeeting: true,
              descriptionHtml: buildWebinarDescriptionHtml(t)
            }
          : undefined
    })
  }

  const panelW = 320
  const panelMaxH = 480
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(window.innerWidth - panelW - 8, Math.max(8, anchor.x + 8)),
    top: Math.min(window.innerHeight - panelMaxH - 8, Math.max(8, anchor.y + 8)),
    zIndex: 115,
    width: panelW
  }

  const canSave =
    subject.trim().length > 0 &&
    !busy &&
    (createKind === 'event'
      ? Boolean(parseCalendarDestinationKey(destinationSelectValue)) && !calendarsLoading
      : Boolean(taskAccountId && taskListId && !taskListsLoading))

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={t('calendar.quickCreate.title')}
      style={style}
      className="chronell-acrylic-popover overflow-hidden text-popover-foreground"
      onMouseDown={(e): void => e.stopPropagation()}
      onClick={(e): void => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        {calendarAccounts.length > 0 && taskAccounts.length > 0 ? (
          <div className="flex gap-0.5 rounded-md border border-border p-0.5">
            <button
              type="button"
              disabled={busy}
              onClick={(): void => setCreateKind('event')}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                createKind === 'event'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('calendar.eventDialog.eventKindName')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={(): void => setCreateKind('task')}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                createKind === 'task'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('calendar.eventDialog.taskKindName')}
            </button>
          </div>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            {createKind === 'task'
              ? t('calendar.eventDialog.taskKindName')
              : t('calendar.eventDialog.eventKindName')}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('calendar.eventDialog.closeAria')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        <label className="flex items-center gap-2">
          {createKind === 'task' ? (
            <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={titleRef}
            type="text"
            value={subject}
            onChange={(e): void => setSubject(e.target.value)}
            onKeyDown={(e): void => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSave()
              }
            }}
            disabled={busy}
            placeholder={t('calendar.quickCreate.titlePlaceholder')}
            className="min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2 py-1.5 text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>

        <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/20 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>{t('calendar.quickCreate.whenLabel')}</span>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-border"
                checked={isAllDay}
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
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
                  disabled={busy}
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
                  disabled={busy}
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
                  disabled={busy}
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
                  disabled={busy}
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

        {createKind === 'event' ? (
          <label className="block space-y-1">
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">
              {t('calendar.eventDialog.targetCalendarAria')}
            </span>
            <select
              value={destinationSelectValue}
              disabled={busy || calendarsLoading}
              onChange={(e): void => {
                const v = e.target.value
                setDestinationSelectValue(v)
                const parsed = parseCalendarDestinationKey(v)
                if (parsed) {
                  setAccountId(parsed.accountId)
                  setGraphCalendarId(parsed.graphCalendarId)
                }
              }}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {calendarsLoading ? (
                <option value="">{t('calendar.eventDialog.loadingShort')}</option>
              ) : (
                calendarsByAccount.map(({ account, calendars }) => (
                  <optgroup key={account.id} label={destinationAccountOptgroupLabel(account)}>
                    {calendars.length === 0 ? (
                      <option value={calendarDestinationKey(account.id, '')}>
                        {t('calendar.eventDialog.primaryCalendarStandard')}
                      </option>
                    ) : (
                      calendars.map((c) => (
                        <option key={`${account.id}:${c.id}`} value={calendarDestinationKey(account.id, c.id)}>
                          {c.name}
                          {c.isDefaultCalendar ? t('calendar.eventDialog.standardCalendarSuffix') : ''}
                        </option>
                      ))
                    )}
                  </optgroup>
                ))
              )}
            </select>
          </label>
        ) : (
          <div>
            <label className="block space-y-1">
              <span className="text-2xs text-muted-foreground">{t('tasks.create.account')}</span>
              <select
                value={taskAccountId}
                disabled={busy || taskListsLoading}
                onChange={(e): void => setTaskAccountId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                {taskAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {cloudTaskAccountOptionLabel(a)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-2xs text-muted-foreground">{t('tasks.create.list')}</span>
              <select
                value={taskListId}
                disabled={busy || taskListsLoading || taskLists.length === 0}
                onChange={(e): void => setTaskListId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                {taskLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {createKind === 'event' && eventAttachmentsApi.supportsFileAttachments ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">
                {t('calendar.eventDialog.attachments')}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={(): void => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-2xs font-medium hover:bg-secondary disabled:opacity-50"
              >
                <Paperclip className="h-3 w-3" />
                {t('calendar.quickCreate.addAttachment')}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e): void => {
                const list = e.target.files
                if (list?.length) void eventAttachmentsApi.addFiles(Array.from(list))
                e.target.value = ''
              }}
            />
            <CalendarEventAttachmentsPanel
              attachments={eventAttachmentsApi}
              disabled={busy}
              compact
            />
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={(): void => handleOpenDetails(false)}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
            >
              {t('calendar.quickCreate.detailsLink')}
            </button>
            {/* Template-Dropdown */}
            {availableTemplates.length > 0 && (
              <div className="relative" onMouseDown={(e): void => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={(): void => setTemplateDropdownOpen((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  {t('calendar.quickCreate.templateButton')}
                </button>
                {templateDropdownOpen && (
                  <div className="absolute bottom-9 left-0 z-30 min-w-[190px] rounded-md border border-border bg-popover shadow-lg">
                    {availableTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onMouseDown={(e): void => e.stopPropagation()}
                        onClick={(): void => handleOpenDetails(false, tpl)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-secondary"
                      >
                        <span className="shrink-0 text-sm leading-none">{tpl.emoji || '📅'}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{tpl.name}</span>
                        {tpl.teamsMeeting && <Video className="h-3 w-3 shrink-0 text-blue-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {supportsTeamsWebinar ? (
              <button
                type="button"
                disabled={busy || isAllDay}
                onClick={(): void => handleOpenDetails(true)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-500/15 dark:text-blue-300',
                  (busy || isAllDay) && 'cursor-not-allowed opacity-50'
                )}
              >
                <Video className="h-3.5 w-3.5" />
                {t('calendar.quickCreate.webinarButton')}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            disabled={!canSave}
            onClick={(): void => void handleSave()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90',
              !canSave && 'cursor-not-allowed opacity-50'
            )}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {createKind === 'task' ? t('tasks.create.submit') : t('calendar.eventDialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}