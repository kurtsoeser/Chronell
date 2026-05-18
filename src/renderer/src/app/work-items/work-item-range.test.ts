import { describe, expect, it } from 'vitest'
import type { WorkItem } from '@shared/work-item'
import {
  filterWorkItemsForMegaTimeline,
  workItemOverlapsRange
} from '@/app/work-items/work-item-range'

const rangeStart = new Date('2026-05-16T00:00:00')
const rangeEnd = new Date('2026-06-16T00:00:00')

describe('workItemOverlapsRange', () => {
  it('includes calendar events overlapping the range', () => {
    const item = {
      kind: 'calendar_event',
      event: {
        startIso: '2026-05-15T10:00:00.000Z',
        endIso: '2026-05-16T11:00:00.000Z'
      }
    } as WorkItem
    expect(workItemOverlapsRange(item, rangeStart, rangeEnd)).toBe(true)
  })

  it('excludes items before today when range starts today', () => {
    const item = {
      kind: 'cloud_task',
      dueAtIso: '2026-05-11T12:00:00.000Z',
      planned: {}
    } as WorkItem
    expect(workItemOverlapsRange(item, rangeStart, rangeEnd)).toBe(false)
  })
})

describe('filterWorkItemsForMegaTimeline', () => {
  const TZ = 'Europe/Berlin'
  const nowMs = Date.parse('2026-05-18T12:00:00.000Z')

  it('behält offene überfällige Aufgaben außerhalb des Fensters', () => {
    const item = {
      kind: 'cloud_task',
      completed: false,
      dueAtIso: '2026-05-11T12:00:00.000Z',
      planned: {},
      title: 'Alt'
    } as WorkItem
    const out = filterWorkItemsForMegaTimeline([item], rangeStart, rangeEnd, TZ, nowMs)
    expect(out).toHaveLength(1)
  })

  it('filtert erledigte überfällige Aufgaben weiterhin heraus', () => {
    const item = {
      kind: 'cloud_task',
      completed: true,
      dueAtIso: '2026-05-11T12:00:00.000Z',
      planned: {},
      title: 'Alt'
    } as WorkItem
    const out = filterWorkItemsForMegaTimeline([item], rangeStart, rangeEnd, TZ, nowMs)
    expect(out).toHaveLength(0)
  })
})
