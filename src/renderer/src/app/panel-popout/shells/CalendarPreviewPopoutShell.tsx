import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEventView } from '@shared/types'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import { CalendarEventPreview } from '@/app/calendar/CalendarEventPreview'
import { CalendarSchedulingPanel } from '@/app/calendar/CalendarSchedulingPanel'
import { CloudTaskItemPreview } from '@/app/calendar/CloudTaskItemPreview'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import type { CalendarPreviewPopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import { PopoutWindowChrome } from '@/app/panel-popout/PopoutWindowChrome'
import { requestPanelPopoutDock } from '@/lib/request-panel-popout-dock'
import { ReadingPane } from '@/app/layout/ReadingPane'
import type { CloudTaskDisplayPatch, CloudTaskSaveDraft } from '@/app/work/CloudTaskWorkItemDetail'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function CalendarPreviewPopoutShell(): JSX.Element {
  const { t } = useTranslation()
  const route = parsePanelPopoutRoute()
  const accounts = useAccountsStore((s) => s.accounts)
  const [stash, setStash] = useState<CalendarPreviewPopoutStash | null>(null)
  const [calendarEvent, setCalendarEvent] = useState<CalendarEventView | null>(null)
  const [cloudTask, setCloudTask] = useState<CloudTaskListItem | null>(null)
  const [cloudTaskPlanned, setCloudTaskPlanned] = useState<WorkItemPlannedSchedule | null>(null)
  const [taskSaving, setTaskSaving] = useState(false)
  const [schedulingSlots, setSchedulingSlots] = useState(
    () => (stash?.focus === 'scheduling' ? stash.slots : [])
  )
  const [schedulingAccountId, setSchedulingAccountId] = useState('')
  const [schedulingDurationMin, setSchedulingDurationMin] = useState(30)
  const [schedulingMeetingTitle, setSchedulingMeetingTitle] = useState('')

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
    void useMailStore.getState().initialize()
  }, [])

  useEffect(() => {
    if (!route?.params.get('stashKey')) return
    const key = route.params.get('stashKey')!.trim()
    void window.mailClient.panelPopout.takePayload(key).then((raw) => {
      const s = raw as CalendarPreviewPopoutStash | null
      if (s) {
        setStash(s)
        if (s.focus === 'scheduling') {
          setSchedulingSlots(s.slots)
          setSchedulingAccountId(s.accountId)
          setSchedulingDurationMin(s.durationMin)
          setSchedulingMeetingTitle(s.meetingTitle)
        }
      }
    })
  }, [route])

  useEffect(() => {
    if (!stash) return
    let cancelled = false
    void (async (): Promise<void> => {
      if (stash.focus === 'event') {
        const now = new Date()
        const start = new Date(now)
        start.setMonth(start.getMonth() - 6)
        const end = new Date(now)
        end.setMonth(end.getMonth() + 12)
        const events = await window.mailClient.calendar.listEvents({
          startIso: start.toISOString(),
          endIso: end.toISOString()
        })
        const ev = events.find(
          (row) =>
            row.accountId === stash.accountId && row.graphEventId === stash.graphEventId
        )
        if (!cancelled) setCalendarEvent(ev ?? null)
        return
      }
      if (stash.focus === 'task') {
        const tasks = await window.mailClient.tasks.listTasks({
          accountId: stash.accountId,
          listId: stash.listId
        })
        const hit = tasks.find((row) => row.id === stash.taskId)
        if (!cancelled && hit) {
          setCloudTask({ ...hit, accountId: stash.accountId, listName: '', source: 'cloud' })
        }
      }
      if (stash.focus === 'mail') {
        await useMailStore.getState().selectMessageWithThreadPreview(stash.messageId)
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [stash])

  const close = useCallback((): void => {
    if (!route) return
    void window.mailClient.panelPopout.close({ panel: route.panel, instanceKey: route.instanceKey || undefined })
  }, [route])

  const buildDockStash = useCallback((): CalendarPreviewPopoutStash => {
    if (stash?.focus === 'scheduling') {
      return {
        focus: 'scheduling',
        accountId: schedulingAccountId,
        durationMin: schedulingDurationMin,
        meetingTitle: schedulingMeetingTitle,
        slots: schedulingSlots
      }
    }
    if (cloudTask) {
      return {
        focus: 'task',
        accountId: cloudTask.accountId,
        listId: cloudTask.listId,
        taskId: cloudTask.id
      }
    }
    if (calendarEvent?.graphEventId?.trim()) {
      return {
        focus: 'event',
        accountId: calendarEvent.accountId,
        graphEventId: calendarEvent.graphEventId.trim()
      }
    }
    const msgId = useMailStore.getState().selectedMessageId
    if (msgId != null) return { focus: 'mail', messageId: msgId }
    return stash ?? { focus: 'empty' }
  }, [
    stash,
    schedulingAccountId,
    schedulingDurationMin,
    schedulingMeetingTitle,
    schedulingSlots,
    cloudTask,
    calendarEvent
  ])

  const popIn = useCallback((): void => {
    if (!route) return
    void requestPanelPopoutDock({
      panel: 'calendar-preview',
      instanceKey: route.instanceKey,
      stashPayload: buildDockStash()
    })
  }, [route, buildDockStash])

  const title = useMemo(() => {
    if (calendarEvent?.title?.trim()) return calendarEvent.title.trim()
    if (cloudTask?.title?.trim()) return cloudTask.title.trim()
    if (stash?.focus === 'scheduling') return t('calendar.scheduling.panelTitle')
    return t('calendar.shell.previewBadgeDefault')
  }, [calendarEvent, cloudTask, stash, t])

  const fcTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const savePreviewCloudTask = useCallback(async (draft: CloudTaskSaveDraft): Promise<void> => {
    if (!cloudTask) return
    setTaskSaving(true)
    try {
      await window.mailClient.tasks.updateTask({
        accountId: cloudTask.accountId,
        listId: cloudTask.listId,
        taskId: cloudTask.id,
        title: draft.title,
        notes: draft.notes || null,
        dueIso: draft.dueIso,
        completed: cloudTask.completed
      })
    } finally {
      setTaskSaving(false)
    }
  }, [cloudTask])

  const patchPreviewCloudTaskDisplay = useCallback(
    async (patch: CloudTaskDisplayPatch): Promise<void> => {
      if (!cloudTask) return
      setTaskSaving(true)
      try {
        await window.mailClient.tasks.patchTaskDisplay({
          accountId: cloudTask.accountId,
          listId: cloudTask.listId,
          taskId: cloudTask.id,
          ...patch
        })
      } finally {
        setTaskSaving(false)
      }
    },
    [cloudTask]
  )

  const body =
    stash?.focus === 'scheduling' ? (
      <CalendarSchedulingPanel
        accounts={accounts}
        slots={schedulingSlots}
        onSlotsChange={setSchedulingSlots}
        accountId={schedulingAccountId}
        onAccountIdChange={setSchedulingAccountId}
        durationMinutes={schedulingDurationMin}
        onDurationMinutesChange={setSchedulingDurationMin}
        meetingTitle={schedulingMeetingTitle}
        onMeetingTitleChange={setSchedulingMeetingTitle}
        timeZone={fcTimeZone}
        onClose={close}
        className="min-h-0 flex-1"
      />
    ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {cloudTask ? (
          <CloudTaskItemPreview
            task={cloudTask}
            planned={cloudTaskPlanned}
            accountDisplayName={
              accounts.find((a) => a.id === cloudTask.accountId)?.displayName ?? cloudTask.accountId
            }
            editable
            saving={taskSaving}
            onSave={savePreviewCloudTask}
            onDisplayChange={patchPreviewCloudTaskDisplay}
          />
        ) : calendarEvent ? (
          <CalendarEventPreview
            event={calendarEvent}
            calendarName=""
            onEdit={(): void => undefined}
            onEventChange={setCalendarEvent}
            onSaved={(): void => undefined}
          />
        ) : (
          <ReadingPane hideChromeWhenEmpty compactToolbar />
        )}
      </div>
    )

  return (
    <PopoutWindowChrome title={title} onClose={close} onPopIn={popIn}>
      {body}
    </PopoutWindowChrome>
  )
}
