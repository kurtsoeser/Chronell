import { describe, expect, it } from 'vitest'
import {
  flushNotesEditorBeforeLeave,
  registerNotesEditorFlush
} from './notes-editor-flush-bridge'

describe('notes-editor-flush-bridge', () => {
  it('ruft den registrierten Flush vor dem Verlassen auf', async () => {
    let flushed = false
    const unregister = registerNotesEditorFlush(async () => {
      flushed = true
    })
    await flushNotesEditorBeforeLeave()
    expect(flushed).toBe(true)
    unregister()
  })

  it('ist nach dem Abmelden ein No-Op', async () => {
    const unregister = registerNotesEditorFlush(async () => {
      throw new Error('should not run')
    })
    unregister()
    await expect(flushNotesEditorBeforeLeave()).resolves.toBeUndefined()
  })
})
