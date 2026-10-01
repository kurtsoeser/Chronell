/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  persistTimeGridSlotMinutes,
  timeGridFcSnapOptions,
  timeGridSlotMinutesToDuration,
  TIME_GRID_SLOT_MINUTES_CHANGED_EVENT
} from '@/app/calendar/calendar-shell-storage'

describe('timeGridSlotMinutesToDuration', () => {
  it('formatiert Minuten als ISO-Dauer', () => {
    expect(timeGridSlotMinutesToDuration(5)).toBe('00:05:00')
    expect(timeGridSlotMinutesToDuration(15)).toBe('00:15:00')
    expect(timeGridSlotMinutesToDuration(60)).toBe('01:00:00')
  })
})

describe('timeGridFcSnapOptions', () => {
  it('setzt slotDuration und snapDuration gleich', () => {
    expect(timeGridFcSnapOptions(10)).toEqual({
      slotDuration: '00:10:00',
      snapDuration: '00:10:00'
    })
  })
})

describe('persistTimeGridSlotMinutes', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('schreibt und feuert CustomEvent nur bei Änderung', () => {
    const handler = vi.fn()
    window.addEventListener(TIME_GRID_SLOT_MINUTES_CHANGED_EVENT, handler)
    persistTimeGridSlotMinutes(15)
    expect(handler).toHaveBeenCalledTimes(1)
    persistTimeGridSlotMinutes(15)
    expect(handler).toHaveBeenCalledTimes(1)
    persistTimeGridSlotMinutes(30)
    expect(handler).toHaveBeenCalledTimes(2)
    window.removeEventListener(TIME_GRID_SLOT_MINUTES_CHANGED_EVENT, handler)
  })
})
