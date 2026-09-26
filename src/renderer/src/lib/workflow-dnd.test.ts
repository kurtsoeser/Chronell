import { describe, expect, it } from 'vitest'
import {
  MIME_TODO_ANCHOR_IDS,
  MIME_THREAD_IDS,
  readDraggedTodoAnchorMessageIds,
  readDraggedWorkflowMessageIds,
  writeMailDragPayload
} from '@/lib/workflow-dnd'

function mockDataTransfer(): DataTransfer {
  const store = new Map<string, string>()
  return {
    setData: (type: string, data: string): void => {
      store.set(type, data)
    },
    getData: (type: string): string => store.get(type) ?? '',
    effectAllowed: 'uninitialized' as DataTransfer['effectAllowed']
  } as DataTransfer
}

describe('writeMailDragPayload / todo anchors', () => {
  it('stores all thread ids and separate todo anchors', () => {
    const dt = mockDataTransfer()
    writeMailDragPayload(dt, [10, 11, 12], { todoAnchorIds: [12] })
    expect(readDraggedWorkflowMessageIds(dt)).toEqual([10, 11, 12])
    expect(readDraggedTodoAnchorMessageIds(dt)).toEqual([12])
    expect(dt.getData(MIME_THREAD_IDS)).toContain('10')
    expect(dt.getData(MIME_TODO_ANCHOR_IDS)).toBe('[12]')
  })

  it('defaults todo anchors to all ids', () => {
    const dt = mockDataTransfer()
    writeMailDragPayload(dt, [5, 6])
    expect(readDraggedTodoAnchorMessageIds(dt)).toEqual([5, 6])
  })
})
