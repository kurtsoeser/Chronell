import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CALENDAR_SHELL_COLUMN_ORDER,
  moveCalendarShellColumn,
  normalizeCalendarShellColumnOrder
} from '@/app/calendar/calendar-shell-column-order'

describe('normalizeCalendarShellColumnOrder', () => {
  it('accepts valid permutations', () => {
    expect(
      normalizeCalendarShellColumnOrder(['zeitliste', 'calendar', 'preview', 'context'])
    ).toEqual(['zeitliste', 'calendar', 'preview', 'context'])
  })

  it('falls back on invalid input', () => {
    expect(normalizeCalendarShellColumnOrder(['calendar', 'zeitliste'])).toEqual([
      ...DEFAULT_CALENDAR_SHELL_COLUMN_ORDER
    ])
  })
})

describe('moveCalendarShellColumn', () => {
  it('swaps adjacent columns', () => {
    const start = ['calendar', 'zeitliste', 'preview', 'context'] as const
    expect(moveCalendarShellColumn(start, 'zeitliste', -1)).toEqual([
      'zeitliste',
      'calendar',
      'preview',
      'context'
    ])
  })
})
