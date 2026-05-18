import { describe, expect, it } from 'vitest'
import {
  buildGanttHeaderColumns,
  ganttColumnWidthPx,
  ganttHourDayWidthPx,
  ganttHourSlotColumnWidthPx,
  ganttSnapMs,
  ganttVisibleRange
} from '@/app/calendar/calendar-gantt-scale'

describe('buildGanttHeaderColumns hour scale', () => {
  it('zeigt genau einen Tag mit 15-Minuten-Raster', () => {
    const anchor = new Date('2026-05-18T12:00:00')
    const { start, end } = ganttVisibleRange(anchor, 'hour')
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
    const cols = buildGanttHeaderColumns(start, end, 'hour', 'de-DE', anchor, 15)
    expect(cols).toHaveLength(96)
    expect(cols[0]?.dayLabel).toBeTruthy()
    expect(cols.filter((c) => c.primary.length > 0)).toHaveLength(24)
  })

  it('Tag ist bei 15-Min-Raster mindestens 3400px breit', () => {
    expect(ganttHourDayWidthPx(15)).toBeGreaterThanOrEqual(3400)
    expect(ganttHourSlotColumnWidthPx(60)).toBeGreaterThan(ganttHourSlotColumnWidthPx(15))
  })
})

describe('buildGanttHeaderColumns week scale', () => {
  it('zeigt Kalenderwoche in der Kopfzeile', () => {
    const anchor = new Date('2026-05-18T12:00:00')
    const { start, end } = ganttVisibleRange(anchor, 'week')
    const cols = buildGanttHeaderColumns(start, end, 'week', 'de-DE', anchor)
    expect(cols[0]?.secondary).toMatch(/^KW \d+$/)
  })
})

describe('ganttColumnWidthPx', () => {
  it('Tag- und Wochenspalten sind deutlich breiter als Stunden-Slots', () => {
    expect(ganttColumnWidthPx('day')).toBeGreaterThanOrEqual(520)
    expect(ganttColumnWidthPx('week')).toBeGreaterThanOrEqual(1080)
    expect(ganttColumnWidthPx('month')).toBeGreaterThanOrEqual(1000)
  })

  it('Snap in Stundenansicht folgt dem Raster', () => {
    expect(ganttSnapMs('hour', 15)).toBe(15 * 60 * 1000)
    expect(ganttSnapMs('hour', 5)).toBe(5 * 60 * 1000)
  })
})
