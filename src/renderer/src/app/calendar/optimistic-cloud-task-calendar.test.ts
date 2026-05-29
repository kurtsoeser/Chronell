import { describe, expect, it, vi } from 'vitest'
import { removeCloudTaskCalendarEventsByTaskKey } from '@/app/calendar/calendar-fc-event-source'
import {
  applyOptimisticCloudTaskPersistToLayer,
  syncFullCalendarCloudTaskEventFromLayer
} from '@/app/calendar/optimistic-cloud-task-calendar'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'

function sampleTask(): CloudTaskListItem {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Demo',
    completed: false,
    dueIso: '2026-05-20',
    notes: null,
    accountId: 'acc-1',
    listName: 'Tasks',
    source: 'cloud'
  }
}

describe('applyOptimisticCloudTaskPersistToLayer', () => {
  it('aktualisiert Planung und Fälligkeit nach Zeitverschiebung', () => {
    const task = sampleTask()
    const key = cloudTaskStableKey(task.accountId, task.listId, task.id)
    const result = applyOptimisticCloudTaskPersistToLayer(
      {
        kind: 'planned',
        taskKey: key,
        plannedStartIso: '2026-05-21T13:15:00.000Z',
        plannedEndIso: '2026-05-21T13:45:00.000Z'
      },
      task,
      [task],
      new Map(),
      'UTC'
    )
    expect(result.plannedByKey.get(key)?.plannedStartIso).toBe('2026-05-21T13:15:00.000Z')
    expect(result.items[0]?.dueIso).toContain('2026-05-21')
  })
})

describe('syncFullCalendarCloudTaskEventFromLayer', () => {
  it('legt Termin neu an wenn nach Dedupe keine kanonische ID existiert', () => {
    const addEvent = vi.fn()
    const api = {
      getEventById: () => null,
      getEvents: () => [],
      addEvent
    }
    const task = sampleTask()
    syncFullCalendarCloudTaskEventFromLayer(
      api as never,
      task,
      {
        plannedStartIso: '2026-05-21T09:00:00.000Z',
        plannedEndIso: '2026-05-21T09:30:00.000Z'
      },
      'UTC',
      { 'acc-1': '#6366f1' }
    )
    expect(addEvent).toHaveBeenCalledOnce()
    expect(addEvent.mock.calls[0]?.[0]?.id).toContain('cloud-task:')
  })
})

describe('removeCloudTaskCalendarEventsByTaskKey', () => {
  it('entfernt Drag-Duplikate und behält die kanonische Event-ID', () => {
    const keep = { id: 'cloud-task:key1', extendedProps: { taskKey: 'key1' }, remove: vi.fn() }
    const dragCopy = { id: '', extendedProps: { taskKey: 'key1' }, remove: vi.fn() }
    const api = { getEvents: () => [dragCopy, keep] }
    removeCloudTaskCalendarEventsByTaskKey(api as never, 'key1', 'cloud-task:key1')
    expect(dragCopy.remove).toHaveBeenCalledOnce()
    expect(keep.remove).not.toHaveBeenCalled()
  })
})
