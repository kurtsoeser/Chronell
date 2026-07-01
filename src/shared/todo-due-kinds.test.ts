import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_TODO_MERGE_BUCKETS,
  isOpenTodoDueKind,
  OPEN_TODO_KIND_ORDER,
  OPEN_TODO_KIND_SET
} from './todo-due-kinds'

describe('todo-due-kinds', () => {
  it('OPEN_TODO_KIND_ORDER enthaelt alle offenen Buckets', () => {
    expect(OPEN_TODO_KIND_ORDER).toEqual(['today', 'tomorrow', 'this_week', 'later'])
    expect(OPEN_TODO_KIND_SET.size).toBe(4)
  })

  it('DASHBOARD_TODO_MERGE_BUCKETS beginnt mit overdue', () => {
    expect(DASHBOARD_TODO_MERGE_BUCKETS[0]).toBe('overdue')
    expect(DASHBOARD_TODO_MERGE_BUCKETS).toContain('today')
  })

  it('isOpenTodoDueKind erkennt gueltige Werte', () => {
    expect(isOpenTodoDueKind('today')).toBe(true)
    expect(isOpenTodoDueKind('done')).toBe(false)
  })
})
