// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  NOTE_CLOUD_TASK_ACCOUNT_ATTR,
  NOTE_CLOUD_TASK_ID_ATTR,
  NOTE_CLOUD_TASK_LIST_ATTR,
  noteCloudTaskRefKey,
  parseNoteCloudTaskRefFromElement
} from './note-cloud-task'

describe('noteCloudTaskRefKey', () => {
  it('bildet stabilen Schlüssel', () => {
    expect(
      noteCloudTaskRefKey({ accountId: 'a1', listId: 'l1', taskId: 't1' })
    ).toBe('task:a1:l1:t1')
  })
})

describe('parseNoteCloudTaskRefFromElement', () => {
  it('liest Referenz aus li-Element', () => {
    const el = document.createElement('li')
    el.setAttribute(NOTE_CLOUD_TASK_ACCOUNT_ATTR, 'acc')
    el.setAttribute(NOTE_CLOUD_TASK_LIST_ATTR, 'list')
    el.setAttribute(NOTE_CLOUD_TASK_ID_ATTR, 'task-1')
    expect(parseNoteCloudTaskRefFromElement(el)).toEqual({
      accountId: 'acc',
      listId: 'list',
      taskId: 'task-1'
    })
  })

  it('gibt null bei unvollständigen Attributen', () => {
    const el = document.createElement('li')
    el.setAttribute(NOTE_CLOUD_TASK_ACCOUNT_ATTR, 'acc')
    expect(parseNoteCloudTaskRefFromElement(el)).toBeNull()
  })
})
