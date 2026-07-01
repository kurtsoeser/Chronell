import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject
} from 'react'
import type { EventInput } from '@fullcalendar/core'
import type FullCalendar from '@fullcalendar/react'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import { cloudTasksToFullCalendarEvents } from '@/app/calendar/cloud-task-calendar'
import { syncFullCalendarCloudTaskEventFromLayer } from '@/app/calendar/optimistic-cloud-task-calendar'
import { readCloudTaskOverlayFromStorage } from '@/app/calendar/calendar-shell-storage'
import { loadPlannedScheduleMapForTasks } from '@/app/work-items/load-planned-schedules'
import {
  cloudTaskCalendarDisplaySignature,
  filterCloudTasksInCalendarRange,
  loadCloudTasksForAccount,
  loadUnifiedCloudTasks
} from '@/app/tasks/tasks-calendar-load'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import { cloudTaskStableKey } from '@shared/work-item-keys'

export interface UseCalendarShellCloudTasksParams {
  taskAccounts: ConnectedAccount[]
  fcTimeZone: string
  accountColorById: Record<string, string>
  calendarRef: RefObject<FullCalendar | null>
  lastRangeRef: MutableRefObject<{ start: Date; end: Date }>
  previewCloudTask: CloudTaskListItem | null
}

export function useCalendarShellCloudTasks({
  taskAccounts,
  fcTimeZone,
  accountColorById,
  calendarRef,
  lastRangeRef,
  previewCloudTask
}: UseCalendarShellCloudTasksParams) {
  const [cloudTaskOverlay, setCloudTaskOverlay] = useState<boolean>(readCloudTaskOverlayFromStorage)
  const cloudTaskOverlayRef = useRef(cloudTaskOverlay)
  cloudTaskOverlayRef.current = cloudTaskOverlay

  const [cloudTaskAllItems, setCloudTaskAllItems] = useState<CloudTaskListItem[]>([])
  const [cloudTaskRangeItems, setCloudTaskRangeItems] = useState<CloudTaskListItem[]>([])
  const [cloudTaskPlannedByKey, setCloudTaskPlannedByKey] = useState(
    () => new Map<string, WorkItemPlannedSchedule>()
  )
  const cloudTaskAllItemsRef = useRef(cloudTaskAllItems)
  cloudTaskAllItemsRef.current = cloudTaskAllItems
  const cloudTaskPlannedByKeyRef = useRef(cloudTaskPlannedByKey)
  cloudTaskPlannedByKeyRef.current = cloudTaskPlannedByKey
  const cloudTaskLayerSigRef = useRef('')
  const cloudTaskFcEventsSigRef = useRef('')
  const cloudTaskByKeyRef = useRef(new Map<string, CloudTaskListItem>())
  const lastCloudFilterRangeKeyRef = useRef('')
  const cloudTaskElByKeyRef = useRef(new Map<string, HTMLElement>())
  const cloudTaskPersistInFlightRef = useRef(0)

  const bumpCloudTaskLayerRevision = useCallback((): void => {
    cloudTaskLayerSigRef.current = ''
    cloudTaskFcEventsSigRef.current = ''
  }, [])

  const reloadCloudTasksAll = useCallback(async (): Promise<{
    items: CloudTaskListItem[]
    planned: Map<string, WorkItemPlannedSchedule>
  }> => {
    if (taskAccounts.length === 0) {
      setCloudTaskAllItems([])
      setCloudTaskPlannedByKey(new Map())
      cloudTaskByKeyRef.current = new Map()
      cloudTaskLayerSigRef.current = ''
      cloudTaskFcEventsSigRef.current = ''
      return { items: [], planned: new Map() }
    }
    try {
      const items = await loadUnifiedCloudTasks(taskAccounts, { cacheOnly: true })
      const planned = await loadPlannedScheduleMapForTasks(items)
      const map = new Map<string, CloudTaskListItem>()
      for (const t of items) {
        map.set(cloudTaskStableKey(t.accountId, t.listId, t.id), t)
      }
      setCloudTaskAllItems(items)
      setCloudTaskPlannedByKey(planned)
      cloudTaskByKeyRef.current = map
      return { items, planned }
    } catch {
      setCloudTaskAllItems([])
      setCloudTaskPlannedByKey(new Map())
      cloudTaskByKeyRef.current = new Map()
      cloudTaskLayerSigRef.current = ''
      cloudTaskFcEventsSigRef.current = ''
      return { items: [], planned: new Map() }
    }
  }, [taskAccounts])

  const commitCloudTaskLayer = useCallback(
    (
      merged: CloudTaskListItem[],
      planned: Map<string, WorkItemPlannedSchedule>,
      rangeStart: Date,
      rangeEnd: Date,
      opts?: { force?: boolean }
    ): void => {
      const map = new Map<string, CloudTaskListItem>()
      for (const t of merged) {
        map.set(cloudTaskStableKey(t.accountId, t.listId, t.id), t)
      }
      cloudTaskByKeyRef.current = map

      const filtered = filterCloudTasksInCalendarRange(
        merged,
        planned,
        rangeStart,
        rangeEnd,
        'open',
        fcTimeZone
      )
      const sig = cloudTaskCalendarDisplaySignature(filtered, planned)
      if (!opts?.force && sig === cloudTaskLayerSigRef.current) return

      cloudTaskLayerSigRef.current = sig
      cloudTaskFcEventsSigRef.current = ''
      setCloudTaskAllItems(merged)
      setCloudTaskPlannedByKey(planned)
      setCloudTaskRangeItems(filtered)
    },
    [fcTimeZone]
  )

  const applyCloudTaskRangeFilter = useCallback(
    (
      items: CloudTaskListItem[],
      planned: Map<string, WorkItemPlannedSchedule>,
      start: Date,
      end: Date
    ): void => {
      const rangeKey = `${start.toISOString()}|${end.toISOString()}`
      const filtered = filterCloudTasksInCalendarRange(items, planned, start, end, 'open', fcTimeZone)
      const sig = cloudTaskCalendarDisplaySignature(filtered, planned)
      if (sig === cloudTaskLayerSigRef.current && rangeKey === lastCloudFilterRangeKeyRef.current) {
        return
      }
      lastCloudFilterRangeKeyRef.current = rangeKey
      cloudTaskLayerSigRef.current = sig
      setCloudTaskRangeItems(filtered)
    },
    [fcTimeZone]
  )

  const reloadCloudTasksForAccounts = useCallback(
    async (accountIds: string[]): Promise<void> => {
      const ids = accountIds.filter((id) => taskAccounts.some((a) => a.id === id))
      if (ids.length === 0) return
      try {
        let merged = cloudTaskAllItemsRef.current
        for (const accountId of ids) {
          const accountItems = await loadCloudTasksForAccount(accountId, { cacheOnly: true })
          merged = [...merged.filter((t) => t.accountId !== accountId), ...accountItems]
        }
        const planned = await loadPlannedScheduleMapForTasks(merged)
        if (!cloudTaskOverlayRef.current) return
        const api = calendarRef.current?.getApi()
        const { start, end } = api
          ? { start: api.view.activeStart, end: api.view.activeEnd }
          : lastRangeRef.current
        commitCloudTaskLayer(merged, planned, start, end)
      } catch {
        // Cache-Lesen fehlgeschlagen
      }
    },
    [taskAccounts, commitCloudTaskLayer, calendarRef, lastRangeRef]
  )

  const loadCloudTasksForRange = useCallback(
    async (start: Date, end: Date): Promise<void> => {
      if (!cloudTaskOverlayRef.current) return
      let items = cloudTaskAllItemsRef.current
      let planned = cloudTaskPlannedByKeyRef.current
      if (items.length === 0 && taskAccounts.length > 0) {
        const loaded = await reloadCloudTasksAll()
        items = loaded.items
        planned = loaded.planned
      }
      applyCloudTaskRangeFilter(items, planned, start, end)
    },
    [taskAccounts.length, reloadCloudTasksAll, applyCloudTaskRangeFilter]
  )

  const loadCloudTasksForRangeRef = useRef(loadCloudTasksForRange)
  loadCloudTasksForRangeRef.current = loadCloudTasksForRange

  const cloudTaskFcEventsRef = useRef<EventInput[]>([])
  const cloudTaskFcEvents = useMemo((): EventInput[] => {
    const sig = cloudTaskCalendarDisplaySignature(cloudTaskRangeItems, cloudTaskPlannedByKey)
    if (sig === cloudTaskFcEventsSigRef.current && cloudTaskFcEventsRef.current.length > 0) {
      return cloudTaskFcEventsRef.current
    }
    cloudTaskFcEventsSigRef.current = sig
    const next = cloudTasksToFullCalendarEvents(
      cloudTaskRangeItems,
      accountColorById,
      cloudTaskPlannedByKey,
      undefined,
      fcTimeZone
    )
    cloudTaskFcEventsRef.current = next
    return next
  }, [cloudTaskRangeItems, accountColorById, cloudTaskPlannedByKey, fcTimeZone])

  useEffect(() => {
    if (!cloudTaskOverlay) return
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    const pendingAccountIds = new Set<string>()
    const off = window.mailClient.events.onTasksChanged(({ accountId }) => {
      if (cloudTaskPersistInFlightRef.current > 0) return
      pendingAccountIds.add(accountId)
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (cloudTaskPersistInFlightRef.current > 0) return
        const ids = [...pendingAccountIds]
        pendingAccountIds.clear()
        void reloadCloudTasksForAccounts(ids)
      }, 400)
    })
    return (): void => {
      off()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [cloudTaskOverlay, reloadCloudTasksForAccounts])

  useEffect(() => {
    if (!cloudTaskOverlay) return
    const previewKey = previewCloudTask
      ? cloudTaskStableKey(previewCloudTask.accountId, previewCloudTask.listId, previewCloudTask.id)
      : null
    for (const [key, el] of cloudTaskElByKeyRef.current) {
      const active = previewKey != null && key === previewKey
      el.classList.toggle('ring-2', active)
      el.classList.toggle('ring-primary', active)
    }
  }, [previewCloudTask, cloudTaskOverlay])

  useEffect(() => {
    if (!cloudTaskOverlay) {
      setCloudTaskAllItems([])
      setCloudTaskRangeItems([])
      setCloudTaskPlannedByKey(new Map())
      cloudTaskByKeyRef.current = new Map()
      cloudTaskLayerSigRef.current = ''
      cloudTaskFcEventsSigRef.current = ''
      lastCloudFilterRangeKeyRef.current = ''
      cloudTaskElByKeyRef.current.clear()
      return
    }
    const { start, end } = lastRangeRef.current
    void loadCloudTasksForRangeRef.current(start, end)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur Overlay-Toggle
  }, [cloudTaskOverlay])

  return {
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
    reloadCloudTasksAll,
    commitCloudTaskLayer,
    loadCloudTasksForRange,
    loadCloudTasksForRangeRef,
    reloadCloudTasksForAccounts,
    bumpCloudTaskLayerRevision,
    cloudTaskFcEvents,
    syncPreviewCloudTaskOnCalendar: (
      task: CloudTaskListItem,
      planned: WorkItemPlannedSchedule | undefined
    ): void => {
      syncFullCalendarCloudTaskEventFromLayer(
        calendarRef.current?.getApi(),
        task,
        planned,
        fcTimeZone,
        accountColorById
      )
    }
  }
}
