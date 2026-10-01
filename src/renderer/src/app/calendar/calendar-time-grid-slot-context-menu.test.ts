/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  buildTimeGridSlotMinutesContextMenuItems,
  isFcTimeGridAxisContextTarget
} from '@/app/calendar/calendar-time-grid-slot-context-menu'

describe('buildTimeGridSlotMinutesContextMenuItems', () => {
  it('markiert die aktuelle Rasterweite und liefert Outlook-Reihenfolge', () => {
    const selected: number[] = []
    const items = buildTimeGridSlotMinutesContextMenuItems({
      current: 15,
      labelForMinutes: (m) => `${m} Minuten`,
      onSelect: (m) => selected.push(m)
    })
    expect(items.map((i) => i.id)).toEqual([
      'time-grid-slot-60',
      'time-grid-slot-30',
      'time-grid-slot-15',
      'time-grid-slot-10',
      'time-grid-slot-6',
      'time-grid-slot-5'
    ])
    expect(items.find((i) => i.id === 'time-grid-slot-15')?.selected).toBe(true)
    expect(items.filter((i) => i.selected)).toHaveLength(1)
    items.find((i) => i.id === 'time-grid-slot-30')?.onSelect?.()
    expect(selected).toEqual([30])
  })

  it('wählt die aktuelle Rasterweite nicht erneut', () => {
    const selected: number[] = []
    const items = buildTimeGridSlotMinutesContextMenuItems({
      current: 15,
      labelForMinutes: (m) => String(m),
      onSelect: (m) => selected.push(m)
    })
    items.find((i) => i.id === 'time-grid-slot-15')?.onSelect?.()
    expect(selected).toEqual([])
  })
})

describe('isFcTimeGridAxisContextTarget', () => {
  it('erkennt Zeitskala-Elemente', () => {
    const label = document.createElement('td')
    label.className = 'fc-timegrid-slot-label'
    const cushion = document.createElement('div')
    cushion.className = 'fc-timegrid-slot-label-cushion'
    label.appendChild(cushion)
    expect(isFcTimeGridAxisContextTarget(cushion)).toBe(true)
    expect(isFcTimeGridAxisContextTarget(document.createElement('div'))).toBe(false)
    expect(isFcTimeGridAxisContextTarget(null)).toBe(false)
  })
})
