import { describe, expect, it } from 'vitest'
import {
  MAIN_CALENDAR_VIEW_ZOOM_LADDER,
  stepCalendarViewInZoomLadder
} from '@/app/calendar/calendar-view-zoom-ladder'

describe('stepCalendarViewInZoomLadder', () => {
  it('zoomt von Woche zu Tag und zurück', () => {
    expect(stepCalendarViewInZoomLadder('timeGridWeek', 'in')).toBe('timeGridDay')
    expect(stepCalendarViewInZoomLadder('timeGridDay', 'out')).toBe('timeGridWeek')
  })

  it('zoomt von Monat zu Jahr', () => {
    expect(stepCalendarViewInZoomLadder('dayGridMonth', 'out')).toBe('multiMonthYear')
  })

  it('behandelt timeGridNDay wie Woche', () => {
    expect(stepCalendarViewInZoomLadder('timeGrid5Day', 'in')).toBe('timeGridDay')
    expect(stepCalendarViewInZoomLadder('timeGrid5Day', 'out')).toBe('dayGridMonth')
  })

  it('stoppt an den Enden der Leiter', () => {
    expect(stepCalendarViewInZoomLadder('timeGridDay', 'in')).toBeNull()
    expect(
      stepCalendarViewInZoomLadder(
        MAIN_CALENDAR_VIEW_ZOOM_LADDER[MAIN_CALENDAR_VIEW_ZOOM_LADDER.length - 1]!,
        'out'
      )
    ).toBeNull()
  })
})
