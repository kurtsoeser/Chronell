import { describe, expect, it } from 'vitest'
import { timeGridFcSnapOptions, timeGridSlotMinutesToDuration } from '@/app/calendar/calendar-shell-storage'

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
