import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { CalendarEventView } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import {
  CAL_SIDE_PANEL_MIN_WIDTH_PX,
  calendarSidePanelMaxWidthPx,
  persistRightInboxOpen,
  persistRightPreviewOpen,
  readRightInboxOpenFromStorage,
  readRightPreviewOpenFromStorage
} from '@/app/calendar/calendar-shell-storage'
import { useResizableWidth } from '@/components/ResizableSplitter'
import { useCalendarPanelLayoutStore } from '@/stores/calendar-panel-layout'
import type { CalendarPreviewPopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import { loadUseOsFloatingPanelsDefault } from '@/lib/floating-panels-prefs'
import {
  openCalendarPreviewOsPopout,
  openCalendarZeitlisteOsPopout
} from '@/lib/open-panel-popout-helpers'
import { useMailStore } from '@/stores/mail'
import type { SchedulingSlot } from '@shared/scheduling-types'

export interface UseCalendarShellRightPanelsParams {
  t: TFunction
  selectedMessageId: number | null
  previewCloudTask: CloudTaskListItem | null
  previewCalendarEvent: CalendarEventView | null
  schedulingOpen: boolean
  schedulingAccountId: string
  schedulingDurationMin: number
  schedulingMeetingTitle: string
  schedulingSlots: SchedulingSlot[]
  clearSelectedMessage: () => void
  selectMessageWithThreadPreview: (messageId: number) => void | Promise<void>
  setPreviewCalendarEvent: Dispatch<SetStateAction<CalendarEventView | null>>
  setPreviewCloudTask: Dispatch<SetStateAction<CloudTaskListItem | null>>
  setPreviewCloudTaskPlannedFromTimeline: Dispatch<
    SetStateAction<import('@shared/work-item').WorkItemPlannedSchedule | null>
  >
  setError: (msg: string | null) => void
}

export function useCalendarShellRightPanels({
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
}: UseCalendarShellRightPanelsParams) {
  const [rightInboxOpen, setRightInboxOpen] = useState(readRightInboxOpenFromStorage)
  const [rightPreviewOpen, setRightPreviewOpen] = useState(readRightPreviewOpenFromStorage)
  const [sidePanelMaxWidth, setSidePanelMaxWidth] = useState(() => calendarSidePanelMaxWidthPx())

  useEffect(() => {
    const update = (): void => setSidePanelMaxWidth(calendarSidePanelMaxWidthPx())
    update()
    window.addEventListener('resize', update)
    return (): void => window.removeEventListener('resize', update)
  }, [])

  const [inboxColumnWidth, setInboxColumnWidth] = useResizableWidth({
    storageKey: 'mailclient.calendarShell.rightInboxWidth',
    defaultWidth: 300,
    minWidth: CAL_SIDE_PANEL_MIN_WIDTH_PX,
    maxWidth: sidePanelMaxWidth
  })
  const [previewPaneWidth, setPreviewPaneWidth] = useResizableWidth({
    storageKey: 'mailclient.calendarShell.readingWidth',
    defaultWidth: 400,
    minWidth: CAL_SIDE_PANEL_MIN_WIDTH_PX,
    maxWidth: sidePanelMaxWidth
  })
  const [contextColumnWidth, setContextColumnWidth] = useResizableWidth({
    storageKey: 'mailclient.calendarShell.contextSidebarWidth',
    defaultWidth: 348,
    minWidth: CAL_SIDE_PANEL_MIN_WIDTH_PX,
    maxWidth: sidePanelMaxWidth
  })

  useEffect(() => {
    setInboxColumnWidth((w) => Math.min(w, sidePanelMaxWidth))
  }, [sidePanelMaxWidth, setInboxColumnWidth])
  useEffect(() => {
    setPreviewPaneWidth((w) => Math.min(w, sidePanelMaxWidth))
  }, [sidePanelMaxWidth, setPreviewPaneWidth])
  useEffect(() => {
    setContextColumnWidth((w) => Math.min(w, sidePanelMaxWidth))
  }, [sidePanelMaxWidth, setContextColumnWidth])

  const inboxPlacement = useCalendarPanelLayoutStore((s) => s.inboxPlacement)
  const previewPlacement = useCalendarPanelLayoutStore((s) => s.previewPlacement)
  const contextPlacement = useCalendarPanelLayoutStore((s) => s.contextPlacement)
  const rightContextOpen = useCalendarPanelLayoutStore((s) => s.contextOpen)
  const setInboxPlacement = useCalendarPanelLayoutStore((s) => s.setInboxPlacement)
  const setPreviewPlacement = useCalendarPanelLayoutStore((s) => s.setPreviewPlacement)
  const setContextPlacement = useCalendarPanelLayoutStore((s) => s.setContextPlacement)
  const setRightContextOpen = useCalendarPanelLayoutStore((s) => s.setContextOpen)

  const inboxDockShow = rightInboxOpen && inboxPlacement === 'dock'
  const previewDockShow = rightPreviewOpen && previewPlacement === 'dock'
  const contextDockShow = rightContextOpen && contextPlacement === 'dock'

  const [inboxDockStripInDom, setInboxDockStripInDom] = useState(inboxDockShow)
  const [previewDockStripInDom, setPreviewDockStripInDom] = useState(previewDockShow)
  const [contextDockStripInDom, setContextDockStripInDom] = useState(contextDockShow)

  useEffect(() => {
    setInboxDockStripInDom(rightInboxOpen && inboxPlacement === 'dock')
  }, [rightInboxOpen, inboxPlacement])

  useEffect(() => {
    setPreviewDockStripInDom(rightPreviewOpen && previewPlacement === 'dock')
  }, [rightPreviewOpen, previewPlacement])

  useEffect(() => {
    setContextDockStripInDom(rightContextOpen && contextPlacement === 'dock')
  }, [rightContextOpen, contextPlacement])

  const inboxFloatWidth = inboxColumnWidth
  const previewFloatWidth = previewPaneWidth
  const contextFloatWidth = contextColumnWidth
  const sidePanelFloatMaxWidthPx = sidePanelMaxWidth

  const useOsFloatingPanels = loadUseOsFloatingPanelsDefault()

  const bothPanelsFloating = useMemo(
    () =>
      !useOsFloatingPanels &&
      rightInboxOpen &&
      inboxPlacement === 'float' &&
      rightPreviewOpen &&
      previewPlacement === 'float',
    [useOsFloatingPanels, rightInboxOpen, inboxPlacement, rightPreviewOpen, previewPlacement]
  )

  const previewColumnLabel = useMemo((): string => {
    if (previewCloudTask) return t('calendar.shell.previewBadgeCloudTask')
    if (previewCalendarEvent) return t('calendar.shell.previewBadgeEvent')
    if (selectedMessageId != null) return t('calendar.shell.previewBadgeMail')
    return t('calendar.shell.previewBadgeDefault')
  }, [previewCloudTask, previewCalendarEvent, selectedMessageId, t])

  const buildPreviewPopoutStash = useCallback((): CalendarPreviewPopoutStash => {
    if (schedulingOpen) {
      return {
        focus: 'scheduling',
        accountId: schedulingAccountId,
        durationMin: schedulingDurationMin,
        meetingTitle: schedulingMeetingTitle,
        slots: schedulingSlots
      }
    }
    if (previewCloudTask) {
      return {
        focus: 'task',
        accountId: previewCloudTask.accountId,
        listId: previewCloudTask.listId,
        taskId: previewCloudTask.id
      }
    }
    if (previewCalendarEvent) {
      const graphEventId = previewCalendarEvent.graphEventId?.trim()
      if (graphEventId) {
        return {
          focus: 'event',
          accountId: previewCalendarEvent.accountId,
          graphEventId
        }
      }
    }
    const msgId = useMailStore.getState().selectedMessageId
    if (msgId != null) return { focus: 'mail', messageId: msgId }
    return { focus: 'empty' }
  }, [
    schedulingOpen,
    schedulingAccountId,
    schedulingDurationMin,
    schedulingMeetingTitle,
    schedulingSlots,
    previewCloudTask,
    previewCalendarEvent
  ])

  const undockPreviewPanel = useCallback((): void => {
    if (useOsFloatingPanels) {
      void openCalendarPreviewOsPopout(buildPreviewPopoutStash(), previewColumnLabel)
      persistRightPreviewOpen(false)
      setRightPreviewOpen(false)
      setPreviewPlacement('dock')
      return
    }
    setPreviewPlacement('float')
  }, [useOsFloatingPanels, buildPreviewPopoutStash, previewColumnLabel, setPreviewPlacement])

  const undockInboxPanel = useCallback((): void => {
    if (useOsFloatingPanels) {
      void openCalendarZeitlisteOsPopout(t('mega.shell.title'))
      persistRightInboxOpen(false)
      setRightInboxOpen(false)
      setInboxPlacement('dock')
      return
    }
    setInboxPlacement('float')
  }, [useOsFloatingPanels, t, setInboxPlacement])

  const previewFloatPos = useMemo(() => {
    const x = Math.max(12, window.innerWidth - previewFloatWidth - 20)
    return { x, y: 68 }
  }, [previewFloatWidth])

  const inboxFloatPos = useMemo(() => {
    if (bothPanelsFloating) {
      const px = previewFloatPos.x
      return { x: Math.max(12, px - inboxFloatWidth - 12), y: 68 }
    }
    return { x: Math.max(12, window.innerWidth - inboxFloatWidth - 20), y: 68 }
  }, [bothPanelsFloating, inboxFloatWidth, previewFloatPos.x, previewFloatWidth])

  const contextFloatPos = useMemo(() => {
    let x = Math.max(12, window.innerWidth - contextFloatWidth - 20)
    if (rightPreviewOpen && previewPlacement === 'float') {
      x = Math.max(12, previewFloatPos.x - contextFloatWidth - 12)
    } else if (rightInboxOpen && inboxPlacement === 'float') {
      x = Math.max(12, inboxFloatPos.x - contextFloatWidth - 12)
    }
    return { x, y: 68 }
  }, [
    contextFloatWidth,
    inboxFloatPos.x,
    inboxPlacement,
    previewFloatPos.x,
    previewPlacement,
    rightInboxOpen,
    rightPreviewOpen
  ])

  const applyTimelineWorkItemToPreview = useCallback(
    (item: WorkItem): void => {
      setError(null)
      if (item.kind === 'cloud_task') {
        setPreviewCalendarEvent(null)
        clearSelectedMessage()
        const task: CloudTaskListItem = {
          ...item.task,
          accountId: item.accountId,
          listName: item.listName,
          source: 'cloud'
        }
        setPreviewCloudTaskPlannedFromTimeline(item.planned)
        setPreviewCloudTask(task)
        persistRightPreviewOpen(true)
        setRightPreviewOpen(true)
        return
      }
      if (item.kind === 'mail_todo') {
        setPreviewCalendarEvent(null)
        setPreviewCloudTask(null)
        setPreviewCloudTaskPlannedFromTimeline(null)
        void selectMessageWithThreadPreview(item.messageId)
        persistRightPreviewOpen(true)
        setRightPreviewOpen(true)
        return
      }
      clearSelectedMessage()
      setPreviewCloudTask(null)
      setPreviewCloudTaskPlannedFromTimeline(null)
      setPreviewCalendarEvent(item.event)
      persistRightPreviewOpen(true)
      setRightPreviewOpen(true)
    },
    [
      clearSelectedMessage,
      selectMessageWithThreadPreview,
      setError,
      setPreviewCalendarEvent,
      setPreviewCloudTask,
      setPreviewCloudTaskPlannedFromTimeline
    ]
  )

  const onRightInboxOpenChange = useCallback((next: boolean): void => {
    persistRightInboxOpen(next)
    setRightInboxOpen(next)
  }, [])

  const onRightPreviewOpenChange = useCallback((next: boolean): void => {
    persistRightPreviewOpen(next)
    setRightPreviewOpen(next)
  }, [])

  const closeRightInbox = useCallback((): void => {
    persistRightInboxOpen(false)
    setRightInboxOpen(false)
  }, [])

  const closeRightPreview = useCallback((): void => {
    persistRightPreviewOpen(false)
    setRightPreviewOpen(false)
  }, [])

  return {
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
    previewFloatPos,
    inboxFloatPos,
    contextFloatPos,
    previewColumnLabel,
    undockPreviewPanel,
    undockInboxPanel,
    applyTimelineWorkItemToPreview
  }
}
