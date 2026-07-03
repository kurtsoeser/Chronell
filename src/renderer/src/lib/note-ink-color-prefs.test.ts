import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addNoteInkCustomColor,
  readNoteInkCustomColorPrefs,
  removeNoteInkCustomColor
} from './note-ink-color-prefs'

describe('note-ink-color-prefs', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem(key: string): string | null {
        return store[key] ?? null
      },
      setItem(key: string, value: string): void {
        store[key] = value
      }
    })
    vi.stubGlobal('window', {
      localStorage,
      dispatchEvent: vi.fn()
    })
  })

  it('speichert und liest eigene Stiftfarben', () => {
    const saved = addNoteInkCustomColor('pen', '#abcdef')
    expect(saved).toBe('#abcdef')
    expect(readNoteInkCustomColorPrefs().pen).toEqual(['#abcdef'])
  })

  it('entfernt eigene Farben', () => {
    addNoteInkCustomColor('pen', '#abcdef')
    removeNoteInkCustomColor('pen', '#abcdef')
    expect(readNoteInkCustomColorPrefs().pen).toEqual([])
  })
})
