import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import FullCalendar from '@fullcalendar/react'
import type { EventChangeArg, EventInput, EventSourceInput } from '@fullcalendar/core'
import {
  addMonths,
  compareAsc,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  differenceInCalendarDays
} from 'date-fns'
import {
  CheckSquare,
  Eye,
  EyeOff,
  Mails,
  StickyNote,
  PanelLeftClose,
  Search,
  CalendarPlus
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAccountsStore } from '@/stores/accounts'
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'
import { useCalendarEventSearchStore } from '@/stores/calendar-event-search'
import { useCalendarIcsImportStore } from '@/stores/calendar-ics-import'
import { useMailStore } from '@/stores/mail'
import {
  mailReadingPopoutOptsFromClick,
  openMailReadingPopout
} from '@/lib/open-mail-reading-popout'
import { useComposeStore } from '@/stores/compose'
import { useSnoozeUiStore } from '@/stores/snooze-ui'
import { CalendarShellHeader } from '@/app/calendar/CalendarShellHeader'
import { showAppConfirm } from '@/stores/app-dialog'
import { useIdBulkSelection } from '@/lib/id-bulk-selection'
import {
  CalendarScheduleChangeDiscardedError,
  patchScheduleInputWithMeetingNotify,
  resolveMeetingScheduleChange
} from '@/app/calendar/calendar-meeting-schedule-change'
import type {
  CalendarEventView,
  CalendarGraphCalendarRow,
  ConnectedAccount,
  MailListItem,
  TodoDueKindOpen,
  UserNoteListItem
} from '@shared/types'
import {
  CALENDAR_COLOR_MENU_PRESET_IDS,
  CALENDAR_EXTENDED_COLOR_PRESET_IDS,
  calendarMenuPresetDisplayHex,
  resolveCalendarDisplayHex,
  resolveCalendarMenuPresetId
} from '@shared/graph-calendar-colors'
import {
  CALENDAR_KIND_MAIL_TODO,
  computePersistIsoRangeForMailTodo,
  mailTodoFullCalendarEventId
} from '@/app/calendar/mail-todo-calendar'
import {
  CALENDAR_KIND_CLOUD_TASK,
  cloudTaskEventId,
  computePersistTargetForCloudTask
} from '@/app/calendar/cloud-task-calendar'
import {
  CALENDAR_KIND_USER_NOTE,
  computePersistTargetForUserNote,
  userNoteEventId
} from '@/app/calendar/notes-calendar'
import {
  scheduleRemoveCloudTaskCalendarEventsByTaskKey,
  scheduleRemoveDuplicateFullCalendarEventsById,
  scheduleRemoveMailTodoCalendarEventsByMessageId
} from '@/app/calendar/calendar-fc-event-source'
import {
  applyOptimisticMailTodoScheduleToItems,
  syncFullCalendarMailTodoEventFromLayer
} from '@/app/calendar/optimistic-mail-todo-calendar'
import {
  deduplicateCalendarEventsByGraphEventId,
  purgeDuplicateGraphCalendarEventsOnApi
} from '@/app/calendar/calendar-graph-events'
import {
  reconcileGraphCalendarEventOnCalendar,
  syncFullCalendarGraphEventFromLayer
} from '@/app/calendar/optimistic-graph-calendar'
import { clearMegaTimelineCache } from '@/app/work-items/apply-calendar-event-schedule-to-work-items'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import {
  applyOptimisticCloudTaskPersistToLayer
} from '@/app/calendar/optimistic-cloud-task-calendar'
import { useCalendarFcEventContent } from '@/app/calendar/use-calendar-fc-event-content'
import { MAIN_CALENDAR_VIEW_ZOOM_LADDER } from '@/app/calendar/calendar-view-zoom-ladder'
import { useCalendarViewZoom } from '@/hooks/use-calendar-view-zoom'
import { useCalendarFcLocale } from '@/hooks/use-calendar-fc-locale'
import {
  useCalendarCollatorLocale,
  useCalendarDateFnsLocale
} from '@/hooks/use-calendar-date-fns-locale'
import { CALENDAR_FC_PLUGINS } from '@/app/calendar/calendar-fc-plugins'
import { useCalendarShellLightOverlays } from '@/app/calendar/use-calendar-shell-light-overlays'
import { useCalendarShellCloudTasks } from '@/app/calendar/use-calendar-shell-cloud-tasks'
import { useCalendarShellGraphEvents } from '@/app/calendar/use-calendar-shell-graph-events'
import { useCalendarShellEventPersist } from '@/app/calendar/use-calendar-shell-event-persist'
import { useCalendarShellCalendarVisibility } from '@/app/calendar/use-calendar-shell-calendar-visibility'
import { CalendarShellFullCalendar } from '@/app/calendar/CalendarShellFullCalendar'
import { CalendarShellPreviewBody } from '@/app/calendar/CalendarShellPreviewBody'
import { CalendarShellRightPanels } from '@/app/calendar/CalendarShellRightPanels'
import { useCalendarShellRightPanels } from '@/app/calendar/use-calendar-shell-right-panels'
import { useCalendarShellKeyboard } from '@/app/calendar/use-calendar-shell-keyboard'
import { CalendarShellModals } from '@/app/calendar/CalendarShellModals'
import { CalendarShellLeftSidebar } from '@/app/calendar/CalendarShellLeftSidebar'
import type { CalendarShellEventDialogState } from '@/app/calendar/calendar-shell-event-dialog-state'
import { useCalendarShellSchedulingActions } from '@/app/calendar/use-calendar-shell-scheduling'
import { useCalendarShellPendingFocus } from '@/app/calendar/use-calendar-shell-pending-focus'
import { useCalendarShellMailActions } from '@/app/calendar/use-calendar-shell-mail-actions'
import { useCalendarShellFcEventSources } from '@/app/calendar/use-calendar-shell-fc-event-sources'
import { useCalendarShellGanttHandlers } from '@/app/calendar/use-calendar-shell-gantt-handlers'
import { buildCalendarFolderColorContextMenuItems } from '@/lib/calendar-folder-color-context-menu'
import {
  applyMultiMonthEventDotMount,
  capEventInputsForMultiMonthView,
  isMultiMonthFcView,
  multiMonthDatesSetKey,
  MULTI_MONTH_QUARTER_VIEW_ID,
  MULTI_MONTH_YEAR_VIEW_ID,
  shouldSkipHeavyCalendarLayersForMultiMonth
} from '@/app/calendar/calendar-fc-multimonth'
import {
  QUICK_CREATE_PLACEHOLDER_EVENT_ID,
  quickCreateRangeToFcPlaceholder
} from '@/app/calendar/calendar-quick-create-placeholder'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { useCalendarSyncStore } from '@/stores/calendar-sync'
import { useInboxCalendarAgendaCacheStore } from '@/stores/inbox-calendar-agenda-cache'
import { useAppModeStore } from '@/stores/app-mode'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import { loadPlannedScheduleMapForTasks } from '@/app/work-items/load-planned-schedules'
import { loadUnifiedCloudTasks } from '@/app/tasks/tasks-calendar-load'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import type { WorkItemPlannedSchedule, WorkItem } from '@shared/work-item'
import { cn } from '@/lib/utils'
import { openExternalUrl } from '@/lib/open-external'
import { buildAccountColorAndNewContextItems } from '@/lib/account-sidebar-context-menu'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import type { ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import { runCalendarEventReminders } from '@/lib/calendar-event-reminders-runner'
import {
  buildCalendarEventCategorySubmenuItems,
  buildCalendarEventTransferSubmenuItems,
  buildCalendarEventContextItems,
  formatCalendarEventClipboardText
} from '@/lib/calendar-event-context-menu'
import {
  pickAndSendCalendarEventToNotion,
  runNotionSendWithErrorHandling,
  sendCalendarEventAsNewNotionPage
} from '@/lib/notion-ui'
import {
  buildMailCategorySubmenuItems,
  buildMailContextItems,
  type MailContextHandlers
} from '@/lib/mail-context-menu'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import { confirmDeleteCloudTasks } from '@/app/tasks/confirm-delete-cloud-task'
import { toggleWorkItemCompleted } from '@/app/work-items/work-item-actions'
import { openWorkItemInCalendar } from '@/app/work-items/work-item-calendar-nav'
import type { CalendarOverlayContextMenuOptions } from '@/app/calendar/calendar-overlay-context-menu'
import { deleteCalendarEventIpc } from '@/lib/calendar-ipc'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import { accountColorToCssBackground } from '@/lib/avatar-color'
import { GLOBAL_CREATE_EVENT, useGlobalCreateNavigateStore } from '@/lib/global-create'
import { VerticalSplitter } from '@/components/ResizableSplitter'
import { useModuleNavColumnWidth } from '@/lib/module-nav-column-width'
import { useCalendarPanelPopoutDock } from '@/app/calendar/use-calendar-panel-popout-dock'
import { useCalendarMailExternalDrop } from '@/lib/use-calendar-mail-external-drop'
import { useCalendarCloudTaskExternalDrop } from '@/lib/use-calendar-cloud-task-external-drop'
import { useCalendarIcsDrop } from '@/lib/use-calendar-ics-drop'
import type { CloudTaskDragPayload } from '@/app/tasks/tasks-cloud-task-dnd'
import { buildCalendarIncludeCalendars } from '@/lib/build-calendar-include-calendars'
import { ModuleNavMiniMonth } from '@/components/ModuleNavMiniMonth'
import {
  moduleNavColumnScrollBodyClass,
  moduleNavColumnScrollBodyStackClass,
  modulePaneStackClass,
  moduleShellClass
} from '@/components/module-shell-layout'
import { CalendarShellAlerts } from '@/app/calendar/CalendarShellAlerts'
import { CalendarShellLoadingOverlay } from '@/app/calendar/CalendarShellLoadingOverlay'
import { CalendarShellSidebarCalendars } from '@/app/calendar/CalendarShellSidebarCalendars'
import { schedulingSlotsToFcEvents } from '@/app/calendar/scheduling-fc-placeholders'
import { clearSchedulingDraft } from '@/app/calendar/scheduling-draft-storage'
import type { SchedulingSlot } from '@shared/scheduling-types'
import { CalendarShellOverlayToggles } from '@/app/calendar/shell/CalendarShellOverlayToggles'
import {
  persistCloudTaskOverlay,
  persistRightPreviewOpen,
  readLeftSidebarCollapsedFromStorage,
  readTimeGridSlotMinutesFromStorage,
  persistLeftSidebarCollapsed,
  SIDEBAR_DEFAULT_CAL_ID,
  timeGridFcSnapOptions,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'
import {
  fullCalendarEventToPatchSchedule,
  GANTT_TIMELINE_VIEW_ID,
  MAX_TIME_GRID_SPAN_DAYS,
  resolveCalendarEventGraphCalendarId
} from '@/app/calendar/calendar-shell-view-helpers'
import { CalendarGanttTimelineView } from '@/app/calendar/CalendarGanttTimelineView'
import { ganttNavStepAnchor } from '@/app/calendar/calendar-gantt-scale'
import type { GanttBarInterval } from '@/app/calendar/calendar-gantt-layout'
import { persistWorkItemGanttSchedule } from '@/app/calendar/calendar-gantt-persist'
import {
  persistGanttTimelineScale,
  readGanttTimelineScale
} from '@/app/calendar/calendar-gantt-timeline-storage'
import type { GanttTimelineScale } from '@/app/calendar/calendar-gantt-scale'
import {
  persistCalendarActiveFcView,
  readCalendarActiveFcView
} from '@/app/calendar/calendar-active-fc-view-storage'
import { useCalendarSettingsPrefs } from '@/lib/use-calendar-settings-prefs'
import { useUiScaleStore } from '@/stores/ui-scale'
import { syncFullCalendarWidth } from '@/app/calendar/sync-full-calendar-width'
import './notion-calendar.css'

export function CalendarShell(): JSX.Element {
  const { t, i18n } = useTranslation()
  const calSettings = useCalendarSettingsPrefs()
  const calendarFcEventContentRender = useCalendarFcEventContent()
  const fcLocale = useCalendarFcLocale()
  const clipboardDfLocale = useCalendarDateFnsLocale()
  const calendarCollatorLocale = useCalendarCollatorLocale()
  const isDeCalendar = calendarCollatorLocale === 'de'

  const accounts = useAccountsStore((s) => s.accounts)
  const calendarSyncByAccount = useCalendarSyncStore((s) => s.syncByAccount)
  const triggerCalendarAccountSync = useCalendarSyncStore((s) => s.triggerSync)
  const accountDisplayAvatarDataUrls = useAccountsStore((s) => s.accountDisplayAvatarDataUrls)
  const patchAccountColor = useAccountsStore((s) => s.patchAccountColor)
  const calendarTimeZoneConfig = useAccountsStore((s) => s.config?.calendarTimeZone)
  const selectedMessageId = useMailStore((s) => s.selectedMessageId)
  const selectMessage = useMailStore((s) => s.selectMessage)
  const selectMessageWithThreadPreview = useMailStore((s) => s.selectMessageWithThreadPreview)
  const clearSelectedMessage = useMailStore((s) => s.clearSelectedMessage)
  const calendarPendingEventId = useCalendarPendingFocusStore((s) => s.pendingEvent?.id ?? null)
  const calendarPendingGotoDateIso = useCalendarPendingFocusStore((s) => s.pendingGotoDateIso)
  const calendarPendingCreateOnDayIso = useCalendarPendingFocusStore(
    (s) => s.pendingCreateOnDay?.dateIso ?? null
  )
  const setTodoScheduleForMessage = useMailStore((s) => s.setTodoScheduleForMessage)
  const refreshNow = useMailStore((s) => s.refreshNow)
  const setMessageRead = useMailStore((s) => s.setMessageRead)
  const toggleMessageFlag = useMailStore((s) => s.toggleMessageFlag)
  const archiveMessage = useMailStore((s) => s.archiveMessage)
  const deleteMessage = useMailStore((s) => s.deleteMessage)
  const setTodoForMessage = useMailStore((s) => s.setTodoForMessage)
  const completeTodoForMessage = useMailStore((s) => s.completeTodoForMessage)
  const setWaitingForMessage = useMailStore((s) => s.setWaitingForMessage)
  const clearWaitingForMessage = useMailStore((s) => s.clearWaitingForMessage)

  const openReply = useComposeStore((s) => s.openReply)
  const openForward = useComposeStore((s) => s.openForward)
  const openSnoozePicker = useSnoozeUiStore((s) => s.open)
  const calendarRef = useRef<FullCalendar>(null)
  const lastRangeRef = useRef<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date()
  })

  const [todoSideListRefreshKey, setTodoSideListRefreshKey] = useState(0)

  const timelineReloadRef = useRef<(() => void) | null>(null)
  const reminderFiredCacheRef = useRef<Map<string, number>>(new Map())
  const [timelineLoading, setTimelineLoading] = useState(false)


  const [activeViewId, setActiveViewId] = useState<string>(() => readCalendarActiveFcView())
  const activeViewIdRef = useRef(activeViewId)
  activeViewIdRef.current = activeViewId
  const isGanttTimelineView = activeViewId === GANTT_TIMELINE_VIEW_ID
  const [ganttAnchor, setGanttAnchor] = useState(() => new Date())
  const [ganttScale, setGanttScale] = useState<GanttTimelineScale>(() => readGanttTimelineScale())
  const [ganttSelectedKey, setGanttSelectedKey] = useState<string | null>(null)
  const [ganttScrollToTodaySignal, setGanttScrollToTodaySignal] = useState(0)
  const lastDatesSetKeyRef = useRef('')
  const datesSetLoadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>()
  const [rangeTitle, setRangeTitle] = useState('')
  const [visibleStart, setVisibleStart] = useState(() => new Date())
  const [miniMonth, setMiniMonth] = useState(() => startOfMonth(new Date()))
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [daysSubOpen, setDaysSubOpen] = useState(false)
  const [settingsSubOpen, setSettingsSubOpen] = useState(false)
  const [gotoDateOpen, setGotoDateOpen] = useState(false)
  const [gotoDateDraft, setGotoDateDraft] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [calendarEventSearchOpen, setCalendarEventSearchOpen] = useState(false)
  const calendarEventSearchQuery = useCalendarEventSearchStore((s) => s.query)
  const setCalendarEventSearchQuery = useCalendarEventSearchStore((s) => s.setQuery)
  const clearCalendarEventSearch = useCalendarEventSearchStore((s) => s.clear)
  const viewMenuRef = useRef<HTMLDivElement>(null)
  const calendarSearchInputRef = useRef<HTMLInputElement>(null)

  const [eventDialog, setEventDialog] = useState<CalendarShellEventDialogState>(null)
  const [quickCreate, setQuickCreate] = useState<{
    anchor: { x: number; y: number }
    range: CalendarCreateRange
  } | null>(null)

  const [schedulingOpen, setSchedulingOpen] = useState(false)
  const [schedulingSlots, setSchedulingSlots] = useState<SchedulingSlot[]>([])
  const [schedulingAccountId, setSchedulingAccountId] = useState('')
  const [schedulingDurationMin, setSchedulingDurationMin] = useState(30)
  const [schedulingMeetingTitle, setSchedulingMeetingTitle] = useState('')

  const dismissQuickCreate = useCallback((): void => {
    calendarRef.current?.getApi().unselect()
    setQuickCreate(null)
  }, [])

  const handleQuickCreateRangeChange = useCallback((range: CalendarCreateRange): void => {
    setQuickCreate((prev) => (prev ? { ...prev, range } : null))
  }, [])
  const [eventContextMenu, setEventContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)
  const [eventNoteTarget, setEventNoteTarget] = useState<ObjectNoteTarget | null>(null)
  const [mailNoteTarget, setMailNoteTarget] = useState<Extract<ObjectNoteTarget, { kind: 'mail' }> | null>(
    null
  )
  const [calendarFolderContextMenu, setCalendarFolderContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)

  const graphCalendarPersistInFlightRef = useRef(0)
  const graphCalendarReconcilingRef = useRef(false)
  const skipCalendarReloadUntilRef = useRef(0)

  const [timeGridSlotMinutes, setTimeGridSlotMinutes] = useState<TimeGridSlotMinutes>(
    readTimeGridSlotMinutesFromStorage
  )

  const msAccounts = useMemo(() => accounts.filter((a) => a.provider === 'microsoft'), [accounts])

  const calendarLinkedAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const taskAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const {
    hiddenCalendarKeys,
    sidebarHiddenCalendarKeys,
    accountSidebarOpen,
    setAccountSidebarOpen,
    accountGroupCalSidebarOpen,
    setAccountGroupCalSidebarOpen,
    groupCalendarsLoading,
    calendarsByAccount,
    m365GroupCalPaging,
    isAccountSidebarOpen,
    ensureCalendarsForAccount,
    reloadCalendarsForAccount,
    fetchMicrosoft365GroupCalendarsIfNeeded,
    fetchMoreMicrosoft365GroupCalendars,
    hideCalendarFromSidebar,
    restoreCalendarToSidebar,
    toggleCalendarVisibility,
    showAllCalendarsInView,
    calendarSidebarHiddenRestoreEntries
  } = useCalendarShellCalendarVisibility({
    calendarLinkedAccounts,
    msAccounts,
    calendarCollatorLocale
  })

  const canCreateCalendarEntry = calendarLinkedAccounts.length > 0 || taskAccounts.length > 0
  const isMultiMonthActive = isMultiMonthFcView(activeViewId)
  const canInteractInTimeGrid = canCreateCalendarEntry && !isMultiMonthActive

  const loadTaskListsForAccount = useCallback(async (accountId: string) => {
    return window.mailClient.tasks.listLists({ accountId })
  }, [])

  const timeGridFcSlotOpts = useMemo(
    () => timeGridFcSnapOptions(timeGridSlotMinutes),
    [timeGridSlotMinutes]
  )

  const multiDayViews = useMemo(() => {
    const o: Record<
      string,
      {
        type: 'timeGrid'
        duration: { days: number }
        buttonText: string
        slotDuration: string
        snapDuration: string
      }
    > = {}
    for (let n = 2; n <= MAX_TIME_GRID_SPAN_DAYS; n++) {
      o[`timeGrid${n}Day`] = {
        type: 'timeGrid',
        duration: { days: n },
        buttonText: t('calendar.views.nDays', { count: n }),
        ...timeGridFcSlotOpts
      }
    }
    return o
  }, [t, timeGridFcSlotOpts])

  const dayGridMonthView = useMemo(
    () => ({
      dayGridMonth: {
        moreLinkClick: 'popover' as const
      }
    }),
    []
  )

  const multiMonthViews = useMemo(
    () => ({
      [MULTI_MONTH_YEAR_VIEW_ID]: {
        type: 'multiMonthYear' as const,
        /** 4×3-Raster: alle 12 Monate auf einen Blick */
        multiMonthMaxColumns: 4,
        /** Niedrig halten, damit bei schmaler Kalenderspalte (Sidebar/Vorschau) 4 Spalten bleiben */
        multiMonthMinWidth: 64,
        /** Niedriger = hoehere Monatskacheln (width/height) */
        aspectRatio: 1.38,
        fixedWeekCount: true,
        showNonCurrentDates: true,
        dayHeaderFormat: { weekday: 'narrow' } as const,
        multiMonthTitleFormat: { month: 'long' } as const,
        dayMaxEvents: 3,
        dayMaxEventRows: 1,
        moreLinkClick: 'day' as const
      },
      [MULTI_MONTH_QUARTER_VIEW_ID]: {
        type: 'multiMonth' as const,
        duration: { months: 3 },
        multiMonthMaxColumns: 3,
        multiMonthMinWidth: 180,
        aspectRatio: 1.75,
        fixedWeekCount: true,
        showNonCurrentDates: true,
        dayHeaderFormat: { weekday: 'narrow' } as const,
        dayMaxEvents: 5,
        dayMaxEventRows: 2,
        moreLinkClick: 'day' as const
      }
    }),
    []
  )

  const fcTimeZone = useMemo(
    () => (calendarTimeZoneConfig?.trim() ? calendarTimeZoneConfig.trim() : 'local'),
    [calendarTimeZoneConfig]
  )

  const calendarDropRootRef = useRef<HTMLDivElement>(null)
  const calendarViewZoomHostRef = useRef<HTMLDivElement>(null)
  const uiScale = useUiScaleStore((s) => s.scale)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(
    readLeftSidebarCollapsedFromStorage
  )
  const [moduleNavWidth, setModuleNavWidth] = useModuleNavColumnWidth()
  const onDragModuleNavWidth = useCallback(
    (delta: number) => setModuleNavWidth((w) => w + delta),
    [setModuleNavWidth]
  )
  const [previewCalendarEvent, setPreviewCalendarEvent] = useState<CalendarEventView | null>(null)
  const [previewCloudTask, setPreviewCloudTask] = useState<CloudTaskListItem | null>(null)
  const [previewCloudTaskSaving, setPreviewCloudTaskSaving] = useState(false)
  const [previewCloudTaskPlannedFromTimeline, setPreviewCloudTaskPlannedFromTimeline] =
    useState<WorkItemPlannedSchedule | null>(null)

  useEffect(() => {
    if (selectedMessageId != null) {
      setPreviewCalendarEvent(null)
      setPreviewCloudTask(null)
      setPreviewCloudTaskPlannedFromTimeline(null)
    }
  }, [selectedMessageId])

  const openCreateCalendarEventDialog = useCallback((): void => {
    if (!canCreateCalendarEntry) return
    setError(null)
    setPreviewCloudTask(null)
    setPreviewCloudTaskPlannedFromTimeline(null)
    setPreviewCalendarEvent(null)
    setEventDialog({ mode: 'create', range: null })
  }, [canCreateCalendarEntry])

  const openCalendarAccountContextMenu = useCallback(
    (clientX: number, clientY: number, account: ConnectedAccount): void => {
      setEventContextMenu(null)
      setCalendarFolderContextMenu({
        x: clientX,
        y: clientY,
        items: buildAccountColorAndNewContextItems({
          account,
          patchAccountColor,
          onPatchError: (msg) => setError(msg),
          newItem: {
            id: `cal-new-event-${account.id}`,
            label: t('calendar.shell.newEvent'),
            icon: CalendarPlus,
            onSelect: (): void => {
              setCalendarFolderContextMenu(null)
              setEventDialog({ mode: 'create', range: null, createAccountId: account.id })
            }
          }
        })
      })
    },
    [patchAccountColor, t]
  )

  useEffect(() => {
    persistLeftSidebarCollapsed(leftSidebarCollapsed)
  }, [leftSidebarCollapsed])

  const previewCloudTaskAccountName = useMemo(() => {
    if (!previewCloudTask) return undefined
    return accounts.find((a) => a.id === previewCloudTask.accountId)?.displayName
  }, [previewCloudTask, accounts])

  const previewCalendarName = useMemo((): string | null => {
    if (!previewCalendarEvent) return null
    const calId = previewCalendarEvent.graphCalendarId?.trim()
    if (!calId) return null
    const rows = calendarsByAccount[previewCalendarEvent.accountId] ?? []
    return rows.find((c) => c.id === calId)?.name?.trim() || null
  }, [previewCalendarEvent, calendarsByAccount])

  const accountColorById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a.color])),
    [accounts]
  )

  const {
    mailTodoOverlay,
    setMailTodoOverlay,
    mailTodoOverlayRef,
    mailTodoItems,
    setMailTodoItems,
    loadMailTodosForRange,
    userNoteOverlay,
    setUserNoteOverlay,
    userNoteOverlayRef,
    setUserNoteRangeItems,
    loadUserNotesForRange,
    mailTodoFcEvents,
    userNoteFcEvents
  } = useCalendarShellLightOverlays(accountColorById, lastRangeRef)


  const {
    cloudTaskOverlay,
    setCloudTaskOverlay,
    cloudTaskOverlayRef,
    cloudTaskAllItems,
    setCloudTaskAllItems,
    cloudTaskRangeItems,
    setCloudTaskRangeItems,
    cloudTaskPlannedByKey,
    setCloudTaskPlannedByKey,
    cloudTaskAllItemsRef,
    cloudTaskPlannedByKeyRef,
    cloudTaskByKeyRef,
    cloudTaskPersistInFlightRef,
    cloudTaskElByKeyRef,
    commitCloudTaskLayer,
    loadCloudTasksForRange,
    bumpCloudTaskLayerRevision,
    cloudTaskFcEvents,
    syncPreviewCloudTaskOnCalendar
  } = useCalendarShellCloudTasks({
    taskAccounts,
    fcTimeZone,
    accountColorById,
    calendarRef,
    lastRangeRef,
    previewCloudTask
  })

  const {
    events,
    setEvents,
    eventsRef,
    graphCalendarSourceRev,
    setGraphCalendarSourceRev,
    loading,
    error,
    setError,
    loadRange,
    reloadVisibleRange,
    reloadCalendarEventsOnly,
    reloadCalendarEventsOnlyRef,
    applyOptimisticGraphCalendarEvent,
    defaultGraphCalendarIdByAccount,
    graphFcEventsForFc
  } = useCalendarShellGraphEvents({
    calendarRef,
    lastRangeRef,
    calendarLinkedAccounts,
    calendarsByAccount,
    hiddenCalendarKeys,
    sidebarHiddenCalendarKeys,
    activeViewId,
    calendarEventSearchQuery,
    graphCalendarPersistInFlightRef,
    skipCalendarReloadUntilRef,
    graphCalendarReconcilingRef,
    mailTodoOverlayRef,
    cloudTaskOverlayRef,
    userNoteOverlayRef,
    loadMailTodosForRange,
    loadCloudTasksForRange,
    loadUserNotesForRange
  })

  const previewCloudTaskPlanned = useMemo(() => {
    if (!previewCloudTask) return null
    const key = cloudTaskStableKey(
      previewCloudTask.accountId,
      previewCloudTask.listId,
      previewCloudTask.id
    )
    return cloudTaskPlannedByKey.get(key) ?? previewCloudTaskPlannedFromTimeline ?? null
  }, [previewCloudTask, cloudTaskPlannedByKey, previewCloudTaskPlannedFromTimeline])

  const rightPanels = useCalendarShellRightPanels({
    t,
    selectedMessageId,
    previewCloudTask,
    previewCalendarEvent,
    schedulingOpen,
    schedulingAccountId,
    schedulingDurationMin,
    schedulingMeetingTitle,
    schedulingSlots,
    clearSelectedMessage,
    selectMessageWithThreadPreview,
    setPreviewCalendarEvent,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    setError
  })

  const {
    rightInboxOpen,
    setRightInboxOpen,
    onRightInboxOpenChange,
    closeRightInbox,
    rightPreviewOpen,
    setRightPreviewOpen,
    onRightPreviewOpenChange,
    closeRightPreview,
    inboxColumnWidth,
    setInboxColumnWidth,
    previewPaneWidth,
    setPreviewPaneWidth,
    contextColumnWidth,
    setContextColumnWidth,
    sidePanelFloatMaxWidthPx,
    inboxPlacement,
    previewPlacement,
    contextPlacement,
    rightContextOpen,
    setInboxPlacement,
    setPreviewPlacement,
    setContextPlacement,
    setRightContextOpen,
    inboxDockShow,
    previewDockShow,
    contextDockShow,
    inboxDockStripInDom,
    setInboxDockStripInDom,
    previewDockStripInDom,
    setPreviewDockStripInDom,
    contextDockStripInDom,
    setContextDockStripInDom,
    inboxFloatWidth,
    previewFloatWidth,
    contextFloatWidth,
    useOsFloatingPanels,
    inboxFloatPos,
    previewFloatPos,
    contextFloatPos,
    previewColumnLabel,
    undockPreviewPanel,
    undockInboxPanel,
    applyTimelineWorkItemToPreview
  } = rightPanels

  const { closeSchedulingPanel, openSchedulingPanel, addSchedulingSlot } =
    useCalendarShellSchedulingActions(
      msAccounts,
      dismissQuickCreate,
      t,
      setSchedulingOpen,
      setSchedulingSlots,
      setSchedulingAccountId,
      setSchedulingDurationMin,
      setSchedulingMeetingTitle,
      setRightPreviewOpen,
      setPreviewDockStripInDom
    )

  useEffect(() => {
    const pending = useGlobalCreateNavigateStore.getState().takePendingAfterNavigate()
    if (pending === 'calendar_event') {
      window.setTimeout((): void => openCreateCalendarEventDialog(), 0)
    } else if (pending === 'booking') {
      window.setTimeout((): void => openSchedulingPanel(), 0)
    }
  }, [openCreateCalendarEventDialog, openSchedulingPanel])

  useEffect(() => {
    function onGlobalCreate(e: Event): void {
      const ce = e as CustomEvent<{ kind?: string }>
      if (ce.detail?.kind === 'calendar_event') {
        openCreateCalendarEventDialog()
      } else if (ce.detail?.kind === 'booking') {
        openSchedulingPanel()
      }
    }
    window.addEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
    return (): void => window.removeEventListener(GLOBAL_CREATE_EVENT, onGlobalCreate as EventListener)
  }, [openCreateCalendarEventDialog, openSchedulingPanel])

  useEffect(() => {
    useCalendarSyncStore.getState().initialize()
  }, [])

  useEffect(() => {
    if (eventDialog != null) {
      setEventContextMenu(null)
      setCalendarFolderContextMenu(null)
    }
  }, [eventDialog])

  useCalendarPanelPopoutDock({
    setRightInboxOpen,
    setInboxPlacement,
    setRightPreviewOpen,
    setPreviewPlacement,
    setEventDialog,
    setSchedulingOpen,
    setSchedulingSlots,
    setSchedulingAccountId,
    setSchedulingDurationMin,
    setSchedulingMeetingTitle,
    setPreviewCalendarEvent,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    clearSelectedMessage,
    selectMessageWithThreadPreview
  })

  const previewBody = (
    <CalendarShellPreviewBody
      t={t}
      accounts={accounts}
      fcTimeZone={fcTimeZone}
      previewPlacement={previewPlacement}
      schedulingOpen={schedulingOpen}
      schedulingSlots={schedulingSlots}
      setSchedulingSlots={setSchedulingSlots}
      schedulingAccountId={schedulingAccountId}
      setSchedulingAccountId={setSchedulingAccountId}
      schedulingDurationMin={schedulingDurationMin}
      setSchedulingDurationMin={setSchedulingDurationMin}
      schedulingMeetingTitle={schedulingMeetingTitle}
      setSchedulingMeetingTitle={setSchedulingMeetingTitle}
      closeSchedulingPanel={closeSchedulingPanel}
      previewCloudTask={previewCloudTask}
      previewCloudTaskPlanned={previewCloudTaskPlanned}
      previewCloudTaskAccountName={previewCloudTaskAccountName}
      previewCloudTaskSaving={previewCloudTaskSaving}
      previewCalendarEvent={previewCalendarEvent}
      previewCalendarName={previewCalendarName}
      setEventDialog={setEventDialog}
      setPreviewCalendarEvent={setPreviewCalendarEvent}
      setEvents={setEvents}
      reloadCalendarEventsOnlyRef={reloadCalendarEventsOnlyRef}
      calendarRef={calendarRef}
      lastRangeRef={lastRangeRef}
      cloudTaskByKeyRef={cloudTaskByKeyRef}
      setCloudTaskAllItems={setCloudTaskAllItems}
      setCloudTaskRangeItems={setCloudTaskRangeItems}
      setPreviewCloudTask={setPreviewCloudTask}
      setPreviewCloudTaskPlannedFromTimeline={setPreviewCloudTaskPlannedFromTimeline}
      cloudTaskAllItems={cloudTaskAllItems}
      cloudTaskPlannedByKey={cloudTaskPlannedByKey}
      commitCloudTaskLayer={commitCloudTaskLayer}
      syncPreviewCloudTaskOnCalendar={syncPreviewCloudTaskOnCalendar}
      setPreviewCloudTaskSaving={setPreviewCloudTaskSaving}
    />
  )

  useEffect(() => {
    if (eventsRef.current.length === 0) return
    const productName = 'MailClient'
    let cancelled = false
    const tick = (): void => {
      if (cancelled) return
      void runCalendarEventReminders(eventsRef.current, productName, reminderFiredCacheRef.current).catch(
        () => undefined
      )
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return (): void => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [events.length])

  const handleCalendarEventSaved = useCallback(
    (created?: CalendarEventView): void => {
      setQuickCreate(null)
      calendarRef.current?.getApi().unselect()
      if (created) {
        applyOptimisticGraphCalendarEvent(created)
        useInboxCalendarAgendaCacheStore.getState().upsertPreviewCalendarEvent(created)
        skipCalendarReloadUntilRef.current = Date.now() + 6000
        return
      }
      reloadVisibleRange({ silent: true })
    },
    [applyOptimisticGraphCalendarEvent, reloadVisibleRange]
  )

  const { mailContextHandlers, bumpTodoOverlayAndSideList } = useCalendarShellMailActions({
    t,
    fcTimeZone,
    taskAccounts,
    calendarDropRootRef,
    calendarRef,
    lastRangeRef,
    timelineReloadRef,
    loadMailTodosForRange,
    commitCloudTaskLayer,
    bumpCloudTaskLayerRevision,
    setTodoSideListRefreshKey,
    setError,
    setEventNoteTarget,
    setMailNoteTarget,
    selectMessage
  })

  const setAppMode = useAppModeStore((s) => s.setMode)

  const reloadCloudTaskOverlay = useCallback((): void => {
    bumpCloudTaskLayerRevision()
    timelineReloadRef.current?.()
    const api = calendarRef.current?.getApi()
    if (api) {
      void loadCloudTasksForRange(api.view.activeStart, api.view.activeEnd)
      return
    }
    const range = lastRangeRef.current
    if (!range) return
    void loadCloudTasksForRange(range.start, range.end)
  }, [
    bumpCloudTaskLayerRevision,
    calendarRef,
    lastRangeRef,
    loadCloudTasksForRange,
    timelineReloadRef
  ])

  const overlayContextMenuOptions = useMemo<CalendarOverlayContextMenuOptions>(
    () => ({
      t,
      mailTodoListLabel: t('calendar.shell.mailTodosLabel'),
      plannedByTaskKey: cloudTaskPlannedByKey,
      workItemHandlers: {
        t,
        mailHandlers: mailContextHandlers,
        canCreateCloudTask: (accountId): boolean =>
          taskAccounts.some((a) => a.id === accountId && accountSupportsCloudTasks(a)),
        onToggleCompleted: async (item): Promise<void> => {
          try {
            await toggleWorkItemCompleted(item)
            if (item.kind === 'cloud_task') {
              if (
                previewCloudTask &&
                cloudTaskStableKey(
                  previewCloudTask.accountId,
                  previewCloudTask.listId,
                  previewCloudTask.id
                ) === item.stableKey
              ) {
                setPreviewCloudTask({ ...previewCloudTask, completed: !item.completed })
              }
              reloadCloudTaskOverlay()
              return
            }
            bumpTodoOverlayAndSideList()
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        },
        onShowInCalendar: (item): void => {
          openWorkItemInCalendar(item, setAppMode)
        },
        onOpenInMail: (item): void => {
          void selectMessageWithThreadPreview(item.messageId)
          setAppMode('mail')
        },
        onOpenInTasks: (): void => setAppMode('tasks'),
        onDeleteCloudTask: async (item): Promise<void> => {
          if (!(await confirmDeleteCloudTasks(t, 1))) return
          try {
            await window.mailClient.tasks.deleteTask({
              accountId: item.accountId,
              listId: item.listId,
              taskId: item.taskId
            })
            if (
              previewCloudTask &&
              cloudTaskStableKey(
                previewCloudTask.accountId,
                previewCloudTask.listId,
                previewCloudTask.id
              ) === item.stableKey
            ) {
              setPreviewCloudTask(null)
              setPreviewCloudTaskPlannedFromTimeline(null)
            }
            reloadCloudTaskOverlay()
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        },
        refreshMailList: bumpTodoOverlayAndSideList
      },
      onEditCloudTask: (task): void => {
        setError(null)
        setPreviewCalendarEvent(null)
        clearSelectedMessage()
        setPreviewCloudTaskPlannedFromTimeline(null)
        setPreviewCloudTask(task)
        persistRightPreviewOpen(true)
        setRightPreviewOpen(true)
      },
      onEditMailTodo: (mail): void => {
        setError(null)
        setPreviewCalendarEvent(null)
        setPreviewCloudTask(null)
        setPreviewCloudTaskPlannedFromTimeline(null)
        void selectMessageWithThreadPreview(mail.id)
        persistRightPreviewOpen(true)
        setRightPreviewOpen(true)
      }
    }),
    [
      t,
      cloudTaskPlannedByKey,
      mailContextHandlers,
      taskAccounts,
      reloadCloudTaskOverlay,
      previewCloudTask,
      bumpTodoOverlayAndSideList,
      setAppMode,
      selectMessageWithThreadPreview,
      setPreviewCalendarEvent,
      setPreviewCloudTask,
      setPreviewCloudTaskPlannedFromTimeline,
      clearSelectedMessage,
      persistRightPreviewOpen,
      setRightPreviewOpen,
      setError
    ]
  )

  const overlayContextMenuOptionsRef = useRef(overlayContextMenuOptions)
  overlayContextMenuOptionsRef.current = overlayContextMenuOptions

  useCalendarShellPendingFocus({
    calendarRef,
    calendarPendingEventId,
    calendarPendingGotoDateIso,
    calendarPendingCreateOnDayIso,
    clearSelectedMessage,
    setError,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    setPreviewCalendarEvent,
    setRightPreviewOpen,
    setEventDialog
  })

  const buildCalendarFolderColorMenuItems = useCallback(
    (accountId: string, cal: CalendarGraphCalendarRow): ContextMenuItem[] =>
      buildCalendarFolderColorContextMenuItems({
        accountId,
        cal,
        t,
        hideCalendarFromSidebar,
        reloadCalendarsForAccount,
        reloadVisibleRange,
        setError
      }),
    [hideCalendarFromSidebar, reloadCalendarsForAccount, reloadVisibleRange, t]
  )

  const { handleGraphEventChange } = useCalendarShellEventPersist({
    calendarRef,
    lastRangeRef,
    fcTimeZone,
    accountColorById,
    cloudTaskByKeyRef,
    cloudTaskAllItemsRef,
    cloudTaskPlannedByKeyRef,
    cloudTaskPersistInFlightRef,
    graphCalendarPersistInFlightRef,
    graphCalendarReconcilingRef,
    skipCalendarReloadUntilRef,
    timelineReloadRef,
    taskAccounts,
    defaultGraphCalendarIdByAccount,
    setError,
    setMailTodoItems,
    setTodoSideListRefreshKey,
    setEvents,
    setPreviewCalendarEvent,
    setGraphCalendarSourceRev,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    commitCloudTaskLayer,
    loadUserNotesForRange,
    setTodoScheduleForMessage,
    t
  })

  const fcEventSources = useCalendarShellFcEventSources({
    activeViewId,
    graphCalendarSourceRev,
    graphFcEventsForFc,
    mailTodoOverlay,
    cloudTaskOverlay,
    userNoteOverlay,
    mailTodoFcEvents,
    cloudTaskFcEvents,
    userNoteFcEvents,
    calendarEventSearchQuery,
    quickCreate,
    schedulingOpen,
    schedulingSlots
  })

  useEffect(() => {
    return (): void => {
      if (datesSetLoadTimerRef.current) clearTimeout(datesSetLoadTimerRef.current)
    }
  }, [])


  const applyMiniCalendarDayRange = useCallback(
    (startInclusive: Date, endInclusive: Date): void => {
      const api = calendarRef.current?.getApi()
      if (!api) return
      const lo = compareAsc(startInclusive, endInclusive) <= 0 ? startInclusive : endInclusive
      const hi = compareAsc(startInclusive, endInclusive) <= 0 ? endInclusive : startInclusive
      const span = differenceInCalendarDays(hi, lo) + 1
      setMiniMonth(startOfMonth(lo))

      if (span === 1) {
        const currentView = activeViewIdRef.current
        if (currentView === GANTT_TIMELINE_VIEW_ID) {
          setGanttAnchor(lo)
          return
        }
        api.gotoDate(lo)
        return
      }

      const capped = Math.min(Math.max(span, 1), MAX_TIME_GRID_SPAN_DAYS)
      const viewId = `timeGrid${capped}Day`
      api.gotoDate(lo)
      api.changeView(viewId)
      setActiveViewId(viewId)
      persistCalendarActiveFcView(viewId)
      setViewMenuOpen(false)
      setDaysSubOpen(false)
      setSettingsSubOpen(false)
    },
    []
  )

  const changeView = useCallback(
    (viewId: string): void => {
      if (viewId === GANTT_TIMELINE_VIEW_ID) {
        setGanttAnchor(visibleStart)
        setActiveViewId(viewId)
        persistCalendarActiveFcView(viewId)
        setViewMenuOpen(false)
        setDaysSubOpen(false)
        setSettingsSubOpen(false)
        return
      }
      const api = calendarRef.current?.getApi()
      if (!api) return
      api.changeView(viewId)
      setActiveViewId(viewId)
      persistCalendarActiveFcView(viewId)
      setViewMenuOpen(false)
      setDaysSubOpen(false)
      setSettingsSubOpen(false)
    },
    [visibleStart]
  )

  useCalendarViewZoom(calendarViewZoomHostRef, {
    activeViewId,
    onViewChange: changeView,
    ladder: MAIN_CALENDAR_VIEW_ZOOM_LADDER
  })

  const refreshCalendarSize = useCallback((): void => {
    if (isGanttTimelineView) return
    syncFullCalendarWidth(calendarDropRootRef.current, calendarRef.current?.getApi())
  }, [isGanttTimelineView])

  useLayoutEffect(() => {
    const el = calendarDropRootRef.current
    if (!el || isGanttTimelineView) return
    refreshCalendarSize()
    const ro = new ResizeObserver(() => {
      refreshCalendarSize()
    })
    ro.observe(el)
    const onWindowResize = (): void => refreshCalendarSize()
    window.addEventListener('resize', onWindowResize)
    return (): void => {
      ro.disconnect()
      window.removeEventListener('resize', onWindowResize)
    }
  }, [refreshCalendarSize, isGanttTimelineView])

  useEffect(() => {
    if (isGanttTimelineView) return
    refreshCalendarSize()
    const timers = [0, 50, 150, 350, 500].map((ms) =>
      window.setTimeout(refreshCalendarSize, ms)
    )
    return (): void => {
      for (const id of timers) window.clearTimeout(id)
    }
  }, [
    refreshCalendarSize,
    isGanttTimelineView,
    rightInboxOpen,
    rightPreviewOpen,
    rightContextOpen,
    inboxPlacement,
    previewPlacement,
    contextPlacement,
    leftSidebarCollapsed,
    moduleNavWidth,
    inboxColumnWidth,
    previewPaneWidth,
    contextColumnWidth,
    inboxDockShow,
    previewDockShow,
    contextDockShow,
    uiScale
  ])

  const { handleGanttScaleChange, handleGanttPersistSchedule, handleGanttWorkItemSelect } =
    useCalendarShellGanttHandlers({
      fcTimeZone,
      t,
      setTodoScheduleForMessage,
      reloadVisibleRange,
      timelineReloadRef,
      setError,
      setGanttScale,
      setGanttSelectedKey,
      applyTimelineWorkItemToPreview
    })

  const scrollCalendarTodayIntoView = useCallback((): void => {
    const root = calendarDropRootRef.current
    if (!root) return
    const col = root.querySelector('.fc-timegrid-col.fc-day-today') as HTMLElement | null
    if (col) {
      col.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' })
      return
    }
    const dayCell = root.querySelector('.fc-daygrid-day.fc-day-today') as HTMLElement | null
    dayCell?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [])

  useCalendarShellKeyboard({
    timeGridSlotMinutes,
    setTimeGridSlotMinutes,
    calendarRef,
    changeView,
    gotoDateOpen,
    setGotoDateOpen,
    setGotoDateDraft,
    calendarEventSearchOpen,
    setCalendarEventSearchOpen,
    schedulingOpen,
    closeSchedulingPanel,
    quickCreate,
    dismissQuickCreate,
    setMiniMonth,
    scrollCalendarTodayIntoView
  })

  const graphEventKey = useCallback(
    (ev: CalendarEventView): string => `${ev.accountId}:${(ev.graphEventId ?? '').trim()}`,
    []
  )

  const orderedGraphEventKeys = useMemo((): string[] => {
    return [...events]
      .filter((e) => (e.graphEventId ?? '').trim().length > 0)
      .sort((a, b) => (a.startIso ?? '').localeCompare(b.startIso ?? ''))
      .map((e) => graphEventKey(e))
  }, [events, graphEventKey])

  const graphEventSelection = useIdBulkSelection(
    orderedGraphEventKeys,
    useMemo(() => `${activeViewId}:${visibleStart.toISOString()}`, [activeViewId, visibleStart])
  )

  useEffect(() => {
    if (!calendarEventSearchOpen) return
    const id = window.requestAnimationFrame(() => {
      calendarSearchInputRef.current?.focus()
      calendarSearchInputRef.current?.select()
    })
    return (): void => window.cancelAnimationFrame(id)
  }, [calendarEventSearchOpen])

  useEffect(() => {
    if (!viewMenuOpen) return
    const onDoc = (e: MouseEvent): void => {
      if (viewMenuRef.current?.contains(e.target as Node)) return
      setViewMenuOpen(false)
      setDaysSubOpen(false)
      setSettingsSubOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [viewMenuOpen])

  return (
    <>
      <div className={moduleShellClass}>
            {!leftSidebarCollapsed ? (
              <CalendarShellLeftSidebar
                t={t}
                moduleNavWidth={moduleNavWidth}
                onDragModuleNavWidth={onDragModuleNavWidth}
                miniMonth={miniMonth}
                setMiniMonth={setMiniMonth}
                onSelectDayRange={applyMiniCalendarDayRange}
                mailTodoOverlay={mailTodoOverlay}
                setMailTodoOverlay={setMailTodoOverlay}
                cloudTaskOverlay={cloudTaskOverlay}
                setCloudTaskOverlay={setCloudTaskOverlay}
                userNoteOverlay={userNoteOverlay}
                setUserNoteOverlay={setUserNoteOverlay}
                taskAccountsCount={taskAccounts.length}
                calendarLinkedAccounts={calendarLinkedAccounts}
                calendarsByAccount={calendarsByAccount}
                sidebarHiddenCalendarKeys={sidebarHiddenCalendarKeys}
                hiddenCalendarKeys={hiddenCalendarKeys}
                toggleCalendarVisibility={toggleCalendarVisibility}
                showAllCalendarsInView={showAllCalendarsInView}
                onCalendarRowContextMenu={(clientX, clientY, accountId, cal): void => {
                  setEventContextMenu(null)
                  setCalendarFolderContextMenu({
                    x: clientX,
                    y: clientY,
                    items: buildCalendarFolderColorMenuItems(accountId, cal)
                  })
                }}
                accountDisplayAvatarDataUrls={accountDisplayAvatarDataUrls}
                setAccountSidebarOpen={setAccountSidebarOpen}
                isAccountSidebarOpen={isAccountSidebarOpen}
                accountGroupCalSidebarOpen={accountGroupCalSidebarOpen}
                setAccountGroupCalSidebarOpen={setAccountGroupCalSidebarOpen}
                groupCalendarsLoading={groupCalendarsLoading}
                m365GroupCalPaging={m365GroupCalPaging}
                fetchMicrosoft365GroupCalendarsIfNeeded={fetchMicrosoft365GroupCalendarsIfNeeded}
                fetchMoreMicrosoft365GroupCalendars={fetchMoreMicrosoft365GroupCalendars}
                onAccountHeaderContextMenu={openCalendarAccountContextMenu}
                calendarSyncByAccount={calendarSyncByAccount}
                onAccountSync={(accountId): void => {
                  void (async (): Promise<void> => {
                    await triggerCalendarAccountSync(accountId)
                    await reloadCalendarsForAccount(accountId)
                    reloadVisibleRange({ forceRefresh: true })
                  })()
                }}
              />
          ) : null}

            <div className={cn(modulePaneStackClass, 'w-full flex-row')}>
            <div
              className={cn(
                'calendar-notion-shell flex h-full min-h-0 min-w-0 w-full flex-1 flex-col text-foreground',
                `cal-slot-${timeGridSlotMinutes}`,
                activeViewId === MULTI_MONTH_YEAR_VIEW_ID &&
                  'calendar-notion-shell--multimonth-year',
                quickCreate != null && 'calendar-notion-shell--quick-create-open',
                schedulingOpen && 'calendar-notion-shell--scheduling-open'
              )}
            >
              <div className="calendar-shell-header-container shrink-0 border-b border-border">
                <CalendarShellHeader
                  rangeTitle={rangeTitle}
                  visibleStart={visibleStart}
                  rightInboxOpen={rightInboxOpen}
                  onRightInboxOpenChange={onRightInboxOpenChange}
                  rightPreviewOpen={rightPreviewOpen}
                  onRightPreviewOpenChange={onRightPreviewOpenChange}
                  rightContextOpen={rightContextOpen}
                  onRightContextOpenChange={setRightContextOpen}
                  viewMenuRef={viewMenuRef}
                  viewMenuOpen={viewMenuOpen}
                  setViewMenuOpen={setViewMenuOpen}
                  activeViewId={activeViewId}
                  changeView={changeView}
                  daysSubOpen={daysSubOpen}
                  setDaysSubOpen={setDaysSubOpen}
                  settingsSubOpen={settingsSubOpen}
                  setSettingsSubOpen={setSettingsSubOpen}
                  calendarSidebarHiddenRestoreEntries={calendarSidebarHiddenRestoreEntries}
                  onRestoreCalendarToSidebar={restoreCalendarToSidebar}
                  timeGridSlotMinutes={timeGridSlotMinutes}
                  onTimeGridSlotMinutesChange={(min): void => setTimeGridSlotMinutes(min)}
                  onCalendarToday={(): void => {
                    if (isGanttTimelineView) {
                      setGanttAnchor(new Date())
                      setGanttScrollToTodaySignal((n) => n + 1)
                      return
                    }
                    calendarRef.current?.getApi().today()
                  }}
                  onCalendarPrev={(): void => {
                    if (isGanttTimelineView) {
                      setGanttAnchor((a) => ganttNavStepAnchor(a, ganttScale, -1))
                      return
                    }
                    calendarRef.current?.getApi().prev()
                  }}
                  onCalendarNext={(): void => {
                    if (isGanttTimelineView) {
                      setGanttAnchor((a) => ganttNavStepAnchor(a, ganttScale, 1))
                      return
                    }
                    calendarRef.current?.getApi().next()
                  }}
                  leftSidebarCollapsed={leftSidebarCollapsed}
                  onLeftSidebarCollapsedChange={setLeftSidebarCollapsed}
                  onImportIcsClick={(): void => {
                    void useCalendarIcsImportStore.getState().openFromPicker()
                  }}
                  eventSearchQuery={calendarEventSearchQuery}
                  onClearEventSearch={clearCalendarEventSearch}
                  onOpenEventSearch={(): void => setCalendarEventSearchOpen(true)}
                />
              </div>
          <div ref={calendarViewZoomHostRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <CalendarShellAlerts error={error} />

            <div
              ref={calendarDropRootRef}
              className={cn(
                'relative z-0 flex min-h-0 min-w-0 w-full flex-1 flex-col pl-3 pt-2',
                isGanttTimelineView && 'hidden'
              )}
            >
              <>
                  <CalendarShellLoadingOverlay visible={loading} />
              <div className="calendar-fc-host">
              {/* selectLongPressDelay: Touch — kurzes Halten vor Ziehen (sonst oft ~1s). */}
              <CalendarShellFullCalendar
                fcTimeZone={fcTimeZone}
                i18nLanguage={i18n.language}
                timeGridSlotMinutes={timeGridSlotMinutes}
                calSettings={calSettings}
                calendarRef={calendarRef}
                fcLocale={fcLocale}
                timeGridFcSlotOpts={timeGridFcSlotOpts}
                multiDayViews={multiDayViews}
                dayGridMonthView={dayGridMonthView}
                multiMonthViews={multiMonthViews}
                isMultiMonthActive={isMultiMonthActive}
                calendarLinkedAccounts={calendarLinkedAccounts}
                mailTodoOverlay={mailTodoOverlay}
                cloudTaskOverlay={cloudTaskOverlay}
                userNoteOverlay={userNoteOverlay}
                handleGraphEventChange={handleGraphEventChange}
                canInteractInTimeGrid={canInteractInTimeGrid}
                setError={setError}
                setPreviewCloudTask={setPreviewCloudTask}
                setPreviewCloudTaskPlannedFromTimeline={setPreviewCloudTaskPlannedFromTimeline}
                setPreviewCalendarEvent={setPreviewCalendarEvent}
                schedulingOpen={schedulingOpen}
                addSchedulingSlot={addSchedulingSlot}
                setQuickCreate={setQuickCreate}
                fcEventSources={fcEventSources}
                graphCalendarReconcilingRef={graphCalendarReconcilingRef}
                calendarFcEventContentRender={calendarFcEventContentRender}
                cloudTaskElByKeyRef={cloudTaskElByKeyRef}
                t={t}
                overlayContextMenuOptionsRef={overlayContextMenuOptionsRef}
                reloadVisibleRange={reloadVisibleRange}
                calendarCollatorLocale={calendarCollatorLocale}
                isDeCalendar={isDeCalendar}
                clipboardDfLocale={clipboardDfLocale}
                setEventDialog={setEventDialog}
                setMailNoteTarget={setMailNoteTarget}
                setEventNoteTarget={setEventNoteTarget}
                setCalendarFolderContextMenu={setCalendarFolderContextMenu}
                setEventContextMenu={setEventContextMenu}
                calendarDropRootRef={calendarDropRootRef}
                lastDatesSetKeyRef={lastDatesSetKeyRef}
                lastRangeRef={lastRangeRef}
                activeViewIdRef={activeViewIdRef}
                setActiveViewId={setActiveViewId}
                setVisibleStart={setVisibleStart}
                setMiniMonth={setMiniMonth}
                setRangeTitle={setRangeTitle}
                datesSetLoadTimerRef={datesSetLoadTimerRef}
                loadRange={loadRange}
                eventsRef={eventsRef}
                mailTodoOverlayRef={mailTodoOverlayRef}
                cloudTaskOverlayRef={cloudTaskOverlayRef}
                userNoteOverlayRef={userNoteOverlayRef}
                loadMailTodosForRange={loadMailTodosForRange}
                loadCloudTasksForRange={loadCloudTasksForRange}
                loadUserNotesForRange={loadUserNotesForRange}
                graphEventSelection={graphEventSelection}
                graphEventKey={graphEventKey}
                clearSelectedMessage={clearSelectedMessage}
                selectMessageWithThreadPreview={selectMessageWithThreadPreview}
                persistRightPreviewOpen={persistRightPreviewOpen}
                setRightPreviewOpen={setRightPreviewOpen}
              />
              </div>
                </>
            </div>
            {isGanttTimelineView ? (
              <div className="relative z-0 flex min-h-0 flex-1 flex-col pl-1 pt-1">
                <CalendarGanttTimelineView
                  anchor={ganttAnchor}
                  scale={ganttScale}
                  hourSlotMinutes={timeGridSlotMinutes}
                  onScaleChange={handleGanttScaleChange}
                  onRangeTitleChange={setRangeTitle}
                  accounts={calendarLinkedAccounts}
                  selectedKey={ganttSelectedKey}
                  onSelect={handleGanttWorkItemSelect}
                  onPersistSchedule={handleGanttPersistSchedule}
                  reloadSignal={todoSideListRefreshKey}
                  reloadRef={timelineReloadRef}
                  onLoadingChange={setTimelineLoading}
                  scrollToTodaySignal={ganttScrollToTodaySignal}
                  onNewEventClick={(): void => setEventDialog({ mode: 'create', range: null })}
                  newEventDisabled={calendarLinkedAccounts.length === 0}
                />
              </div>
            ) : null}
          </div>
        </div>

        <CalendarShellRightPanels
          t={t}
          previewBody={previewBody}
          refreshCalendarSize={refreshCalendarSize}
          todoSideListRefreshKey={todoSideListRefreshKey}
          timelineReloadRef={timelineReloadRef}
          timelineLoading={timelineLoading}
          setTimelineLoading={setTimelineLoading}
          applyTimelineWorkItemToPreview={applyTimelineWorkItemToPreview}
          rightInboxOpen={rightInboxOpen}
          closeRightInbox={closeRightInbox}
          rightPreviewOpen={rightPreviewOpen}
          closeRightPreview={closeRightPreview}
          inboxColumnWidth={inboxColumnWidth}
          setInboxColumnWidth={setInboxColumnWidth}
          previewPaneWidth={previewPaneWidth}
          setPreviewPaneWidth={setPreviewPaneWidth}
          contextColumnWidth={contextColumnWidth}
          setContextColumnWidth={setContextColumnWidth}
          sidePanelFloatMaxWidthPx={sidePanelFloatMaxWidthPx}
          inboxPlacement={inboxPlacement}
          previewPlacement={previewPlacement}
          contextPlacement={contextPlacement}
          rightContextOpen={rightContextOpen}
          setInboxPlacement={setInboxPlacement}
          setPreviewPlacement={setPreviewPlacement}
          setContextPlacement={setContextPlacement}
          setRightContextOpen={setRightContextOpen}
          inboxDockShow={inboxDockShow}
          previewDockShow={previewDockShow}
          contextDockShow={contextDockShow}
          inboxDockStripInDom={inboxDockStripInDom}
          setInboxDockStripInDom={setInboxDockStripInDom}
          previewDockStripInDom={previewDockStripInDom}
          setPreviewDockStripInDom={setPreviewDockStripInDom}
          contextDockStripInDom={contextDockStripInDom}
          setContextDockStripInDom={setContextDockStripInDom}
          inboxFloatWidth={inboxFloatWidth}
          previewFloatWidth={previewFloatWidth}
          contextFloatWidth={contextFloatWidth}
          useOsFloatingPanels={useOsFloatingPanels}
          inboxFloatPos={inboxFloatPos}
          previewFloatPos={previewFloatPos}
          contextFloatPos={contextFloatPos}
          previewColumnLabel={previewColumnLabel}
          undockPreviewPanel={undockPreviewPanel}
          undockInboxPanel={undockInboxPanel}
        />
        </div>
      </div>

      {eventContextMenu && (
        <ContextMenu
          x={eventContextMenu.x}
          y={eventContextMenu.y}
          items={eventContextMenu.items}
          onClose={(): void => setEventContextMenu(null)}
        />
      )}

      {calendarFolderContextMenu && (
        <ContextMenu
          x={calendarFolderContextMenu.x}
          y={calendarFolderContextMenu.y}
          items={calendarFolderContextMenu.items}
          onClose={(): void => setCalendarFolderContextMenu(null)}
        />
      )}

      <CalendarShellModals
        t={t}
        accounts={accounts}
        calendarLinkedAccounts={calendarLinkedAccounts}
        taskAccounts={taskAccounts}
        eventDialog={eventDialog}
        setEventDialog={setEventDialog}
        quickCreate={quickCreate}
        dismissQuickCreate={dismissQuickCreate}
        handleQuickCreateRangeChange={handleQuickCreateRangeChange}
        loadTaskListsForAccount={loadTaskListsForAccount}
        onCalendarEventSaved={handleCalendarEventSaved}
        mailNoteTarget={mailNoteTarget}
        eventNoteTarget={eventNoteTarget}
        setMailNoteTarget={setMailNoteTarget}
        setEventNoteTarget={setEventNoteTarget}
        gotoDateOpen={gotoDateOpen}
        setGotoDateOpen={setGotoDateOpen}
        gotoDateDraft={gotoDateDraft}
        setGotoDateDraft={setGotoDateDraft}
        calendarRef={calendarRef}
        setMiniMonth={setMiniMonth}
        calendarEventSearchOpen={calendarEventSearchOpen}
        setCalendarEventSearchOpen={setCalendarEventSearchOpen}
        calendarEventSearchQuery={calendarEventSearchQuery}
        setCalendarEventSearchQuery={setCalendarEventSearchQuery}
        calendarSearchInputRef={calendarSearchInputRef}
      />
    </>
  )
}
