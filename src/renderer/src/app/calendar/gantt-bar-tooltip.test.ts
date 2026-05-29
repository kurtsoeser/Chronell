import { describe, expect, it } from 'vitest'
import { formatGanttBarTooltip } from '@/app/calendar/gantt-bar-tooltip'
import type { GanttBarInterval } from '@/app/calendar/calendar-gantt-layout'
import type { WorkItem } from '@shared/work-item'

function sampleItem(title: string): WorkItem {
  return {
    stableKey: 'k',
    kind: 'cloud_task',
    accountId: 'a',
    listId: 'list-1',
    taskId: 't',
    listName: 'Inbox',
    title,
    completed: false,
    dueAtIso: null,
    planned: { plannedStartIso: null, plannedEndIso: null },
    task: {
      id: 't',
      listId: 'list-1',
      title,
      completed: false,
      dueIso: null,
      notes: null,
      iconId: null,
      iconColor: null
    },
    linkedMessageIds: []
  }
}

describe('formatGanttBarTooltip', () => {
  it('enthält Titel und Uhrzeit', () => {
    const interval: GanttBarInterval = {
      startMs: new Date(2026, 4, 18, 10, 0).getTime(),
      endMs: new Date(2026, 4, 18, 11, 30).getTime(),
      allDay: false
    }
    const tip = formatGanttBarTooltip(sampleItem('Team-Meeting'), interval, 'de-DE')
    expect(tip).toContain('Team-Meeting')
    expect(tip).toContain('10:00')
  })

  it('enthält Titel und Datum bei Ganztag', () => {
    const interval: GanttBarInterval = {
      startMs: new Date(2026, 4, 18).getTime(),
      endMs: new Date(2026, 4, 19).getTime(),
      allDay: true
    }
    const tip = formatGanttBarTooltip(sampleItem('Urlaub'), interval, 'de-DE')
    expect(tip).toContain('Urlaub')
    expect(tip).toContain('2026')
  })
})
