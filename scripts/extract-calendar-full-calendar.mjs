import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const shellPath = path.join(root, 'src/renderer/src/app/calendar/CalendarShell.tsx')
const outPath = path.join(root, 'src/renderer/src/app/calendar/CalendarShellFullCalendar.tsx')

const lines = fs.readFileSync(shellPath, 'utf8').split(/\r?\n/)
const start = lines.findIndex((l) => l.trimStart().startsWith('<FullCalendar'))
const end = lines.findIndex((l, i) => i > start && l.trim() === '/>')
if (start < 0 || end < 0) throw new Error(`FullCalendar block not found: ${start} ${end}`)

const fcBody = lines
  .slice(start, end + 1)
  .map((l) => l.replace(/^              /, '    '))
  .join('\n')

const header = `import FullCalendar from '@fullcalendar/react'
import type { EventChangeArg, EventInput, EventSourceInput } from '@fullcalendar/core'
import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react'
import type FullCalendarType from '@fullcalendar/react'
import { startOfMonth } from 'date-fns'
import type { TFunction } from 'i18next'
import type {
  CalendarEventView,
  CalendarGraphCalendarRow,
  ConnectedAccount,
  MailListItem,
  UserNoteListItem
} from '@shared/types'
import {
  CALENDAR_KIND_MAIL_TODO
} from '@/app/calendar/mail-todo-calendar'
import {
  CALENDAR_KIND_CLOUD_TASK
} from '@/app/calendar/cloud-task-calendar'
import {
  CALENDAR_KIND_USER_NOTE
} from '@/app/calendar/notes-calendar'
import { purgeDuplicateGraphCalendarEventsOnApi } from '@/app/calendar/calendar-graph-events'
import {
  applyMultiMonthEventDotMount,
  isMultiMonthFcView,
  multiMonthDatesSetKey,
  shouldSkipHeavyCalendarLayersForMultiMonth
} from '@/app/calendar/calendar-fc-multimonth'
import { QUICK_CREATE_PLACEHOLDER_EVENT_ID } from '@/app/calendar/calendar-quick-create-placeholder'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { CALENDAR_FC_PLUGINS } from '@/app/calendar/calendar-fc-plugins'
import {
  readCalendarActiveFcView,
  persistCalendarActiveFcView,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'
import { syncFullCalendarWidth } from '@/app/calendar/sync-full-calendar-width'
import { accountColorToCssBackground } from '@/lib/avatar-color'
import {
  buildMailCategorySubmenuItems,
  buildMailContextItems,
  type MailContextHandlers
} from '@/lib/mail-context-menu'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
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
import { deleteCalendarEventIpc } from '@/lib/calendar-ipc'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import { openExternalUrl } from '@/lib/open-external'
import {
  mailReadingPopoutOptsFromClick,
  openMailReadingPopout
} from '@/lib/open-mail-reading-popout'
import { showAppConfirm } from '@/stores/app-dialog'
import { useMailStore } from '@/stores/mail'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import { useAppModeStore } from '@/stores/app-mode'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { graphEventKey } from '@/app/calendar/calendar-graph-event-key'
import type { useIdBulkSelection } from '@/lib/id-bulk-selection'
import type { Locale } from 'date-fns'
import type { ContextMenuItem } from '@/components/ContextMenu'
import type { CalendarCreateQuickDraft } from '@/app/calendar/CalendarCreateQuickPopover'
import type { CalendarEventDialogState } from '@/app/calendar/CalendarShell'

export interface CalendarShellFullCalendarProps {
  fcTimeZone: string
  i18nLanguage: string
  timeGridSlotMinutes: TimeGridSlotMinutes
  calSettings: {
    weekStartsOn: number
    slotMinTime: string
    slotMaxTime: string
    scrollTime: string
    hideWeekends: boolean
  }
  calendarRef: RefObject<FullCalendarType>
  fcLocale: string
  timeGridFcSlotOpts: { slotDuration: string; snapDuration: string }
  multiDayViews: Record<string, unknown>
  dayGridMonthView: Record<string, unknown>
  multiMonthViews: Record<string, unknown>
  isMultiMonthActive: boolean
  calendarLinkedAccounts: ConnectedAccount[]
  mailTodoOverlay: boolean
  cloudTaskOverlay: boolean
  userNoteOverlay: boolean
  handleGraphEventChange: (info: EventChangeArg) => void | Promise<void>
  canInteractInTimeGrid: boolean
  setError: (msg: string | null) => void
  setPreviewCloudTask: Dispatch<SetStateAction<CloudTaskListItem | null>>
  setPreviewCloudTaskPlannedFromTimeline: Dispatch<SetStateAction<WorkItemPlannedSchedule | null>>
  setPreviewCalendarEvent: Dispatch<SetStateAction<CalendarEventView | null>>
  schedulingOpen: boolean
  addSchedulingSlot: (range: CalendarCreateRange) => void
  setQuickCreate: Dispatch<SetStateAction<CalendarCreateQuickDraft | null>>
  fcEventSources: EventSourceInput[]
  graphCalendarReconcilingRef: MutableRefObject<boolean>
  calendarFcEventContentRender: (arg: unknown) => JSX.Element
  cloudTaskElByKeyRef: MutableRefObject<Map<string, HTMLElement>>
  previewCloudTask: CloudTaskListItem | null
  accounts: ConnectedAccount[]
  mailContextHandlersRef: MutableRefObject<MailContextHandlers>
  t: TFunction
  reloadVisibleRange: (opts?: { silent?: boolean; forceRefresh?: boolean }) => void
  calendarCollatorLocale: string
  isDeCalendar: boolean
  clipboardDfLocale: Locale
  setEventDialog: Dispatch<SetStateAction<CalendarEventDialogState | null>>
  setMailNoteTarget: Dispatch<SetStateAction<import('@/components/ObjectNoteEditor').ObjectNoteTarget | null>>
  setEventNoteTarget: Dispatch<SetStateAction<import('@/components/ObjectNoteEditor').ObjectNoteTarget | null>>
  setCalendarFolderContextMenu: Dispatch<
    SetStateAction<{ x: number; y: number; items: ContextMenuItem[] } | null>
  >
  setEventContextMenu: Dispatch<
    SetStateAction<{ x: number; y: number; items: ContextMenuItem[] } | null>
  >
  calendarDropRootRef: RefObject<HTMLDivElement>
  lastDatesSetKeyRef: MutableRefObject<string>
  lastRangeRef: MutableRefObject<{ start: Date; end: Date }>
  activeViewIdRef: MutableRefObject<string>
  setActiveViewId: Dispatch<SetStateAction<string>>
  setVisibleStart: Dispatch<SetStateAction<Date>>
  setMiniMonth: Dispatch<SetStateAction<Date>>
  setRangeTitle: Dispatch<SetStateAction<string>>
  datesSetLoadTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  loadRange: (
    start: Date,
    end: Date,
    opts?: { silent?: boolean }
  ) => void | Promise<void>
  eventsRef: MutableRefObject<EventInput[]>
  mailTodoOverlayRef: MutableRefObject<boolean>
  cloudTaskOverlayRef: MutableRefObject<boolean>
  userNoteOverlayRef: MutableRefObject<boolean>
  loadMailTodosForRange: (start: Date, end: Date) => void | Promise<void>
  loadCloudTasksForRange: (start: Date, end: Date) => void | Promise<void>
  loadUserNotesForRange: (start: Date, end: Date) => void | Promise<void>
  graphEventSelection: ReturnType<typeof useIdBulkSelection>
  clearSelectedMessage: () => void
  selectMessageWithThreadPreview: (messageId: string) => void | Promise<void>
  persistRightPreviewOpen: (open: boolean) => void
  setRightPreviewOpen: Dispatch<SetStateAction<boolean>>
}

import type { WorkItemPlannedSchedule } from '@shared/work-item'

export function CalendarShellFullCalendar(props: CalendarShellFullCalendarProps): JSX.Element {
  const {
    fcTimeZone,
    i18nLanguage,
    timeGridSlotMinutes,
    calSettings,
    calendarRef,
    fcLocale,
    timeGridFcSlotOpts,
    multiDayViews,
    dayGridMonthView,
    multiMonthViews,
    isMultiMonthActive,
    calendarLinkedAccounts,
    mailTodoOverlay,
    cloudTaskOverlay,
    userNoteOverlay,
    handleGraphEventChange,
    canInteractInTimeGrid,
    setError,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    setPreviewCalendarEvent,
    schedulingOpen,
    addSchedulingSlot,
    setQuickCreate,
    fcEventSources,
    graphCalendarReconcilingRef,
    calendarFcEventContentRender,
    cloudTaskElByKeyRef,
    previewCloudTask,
    accounts,
    mailContextHandlersRef,
    t,
    reloadVisibleRange,
    calendarCollatorLocale,
    isDeCalendar,
    clipboardDfLocale,
    setEventDialog,
    setMailNoteTarget,
    setEventNoteTarget,
    setCalendarFolderContextMenu,
    setEventContextMenu,
    calendarDropRootRef,
    lastDatesSetKeyRef,
    lastRangeRef,
    activeViewIdRef,
    setActiveViewId,
    setVisibleStart,
    setMiniMonth,
    setRangeTitle,
    datesSetLoadTimerRef,
    loadRange,
    eventsRef,
    mailTodoOverlayRef,
    cloudTaskOverlayRef,
    userNoteOverlayRef,
    loadMailTodosForRange,
    loadCloudTasksForRange,
    loadUserNotesForRange,
    graphEventSelection,
    clearSelectedMessage,
    selectMessageWithThreadPreview,
    persistRightPreviewOpen,
    setRightPreviewOpen
  } = props

  return (
${fcBody}
  )
}
`

fs.writeFileSync(outPath, header)
console.log('Wrote', outPath, 'lines', end - start + 1)
