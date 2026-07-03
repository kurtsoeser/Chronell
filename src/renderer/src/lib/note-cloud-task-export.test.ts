// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  NOTE_CLOUD_TASK_ACCOUNT_ATTR,
  NOTE_CLOUD_TASK_ID_ATTR,
  NOTE_CLOUD_TASK_ITEM_CLASS
} from '@shared/note-cloud-task'
import { buildNoteCloudTaskInsertHtml } from './note-cloud-task-export'
import { syncNoteCloudTasksInHtml } from './note-cloud-task-sync'

describe('buildNoteCloudTaskInsertHtml', () => {
  it('erzeugt verknüpften TaskList-Eintrag', () => {
    const html = buildNoteCloudTaskInsertHtml({
      title: 'Einkaufen',
      ref: { accountId: 'a1', listId: 'l1', taskId: 't1' },
      dueIso: '2026-07-02T14:00:00.000Z',
      dueLabel: '02.07.2026, 14:00'
    })
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain(NOTE_CLOUD_TASK_ITEM_CLASS)
    expect(html).toContain(`${NOTE_CLOUD_TASK_ACCOUNT_ATTR}="a1"`)
    expect(html).toContain(`${NOTE_CLOUD_TASK_ID_ATTR}="t1"`)
    expect(html).toContain('Einkaufen')
    expect(html).toContain('02.07.2026, 14:00')
  })
})

describe('syncNoteCloudTasksInHtml', () => {
  it('aktualisiert data-checked aus Task-Status', () => {
    const html = buildNoteCloudTaskInsertHtml({
      title: 'Test',
      completed: false,
      ref: { accountId: 'a1', listId: 'l1', taskId: 't1' }
    })
    const next = syncNoteCloudTasksInHtml(
      html,
      new Map([
        [
          'a1:l1:t1',
          {
            accountId: 'a1',
            listId: 'l1',
            taskId: 't1',
            completed: true,
            title: 'Test',
            dueIso: null
          }
        ]
      ])
    )
    expect(next).toContain('data-checked="true"')
  })
})
