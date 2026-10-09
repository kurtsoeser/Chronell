import { describe, expect, it, vi } from 'vitest'
import { resizeCalendarDockBetweenColumns } from '@/app/calendar/calendar-shell-dock-resize'

describe('resizeCalendarDockBetweenColumns', () => {
  it('vergroessert die linke feste Spalte vor dem Kalender', () => {
    const setInbox = vi.fn((fn: (w: number) => number) => fn(300))
    resizeCalendarDockBetweenColumns('zeitliste', 'calendar', 12, {
      zeitliste: setInbox,
      preview: vi.fn(),
      context: vi.fn()
    })
    expect(setInbox).toHaveBeenCalled()
    expect(setInbox.mock.results[0]?.value).toBe(312)
  })

  it('verkleinert die rechte feste Spalte nach dem Kalender', () => {
    const setPreview = vi.fn((fn: (w: number) => number) => fn(280))
    resizeCalendarDockBetweenColumns('calendar', 'preview', 10, {
      zeitliste: vi.fn(),
      preview: setPreview,
      context: vi.fn()
    })
    expect(setPreview.mock.results[0]?.value).toBe(270)
  })
})
