import { describe, expect, it } from 'vitest'
import { normalizeQuickStepAction, parseQuickStepActionsJson } from './quicksteps'

describe('quicksteps', () => {
  it('normalizes legacy JSON actions', () => {
    const json = '[{"type":"markRead"},{"type":"archive"},{"type":"addTodo","dueKind":"today"}]'
    const actions = parseQuickStepActionsJson(json)
    expect(actions).toEqual([
      { type: 'mark_read' },
      { type: 'archive' },
      { type: 'add_todo', dueKind: 'today' }
    ])
  })

  it('normalizes moveToTrash to delete', () => {
    expect(normalizeQuickStepAction({ type: 'moveToTrash' })).toEqual({ type: 'delete' })
  })
})
