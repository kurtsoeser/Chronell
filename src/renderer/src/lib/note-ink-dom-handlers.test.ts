import { describe, expect, it, vi } from 'vitest'
import { NOTE_INK_HTML_SOURCE_ATTR } from '@shared/note-ink-document'
import { createNoteInkDomEventHandlers, inkAttachmentIdFromEventTarget } from './note-ink-dom-handlers'

function mockImg(attachmentId: string): HTMLImageElement {
  return {
    getAttribute: (name: string): string | null =>
      name === NOTE_INK_HTML_SOURCE_ATTR ? attachmentId : null,
    closest: function (selector: string): Element | null {
      return selector === 'img' ? (this as HTMLImageElement) : null
    }
  } as unknown as HTMLImageElement
}

describe('inkAttachmentIdFromEventTarget', () => {
  it('liest die Anhang-ID aus dem Bild', () => {
    expect(inkAttachmentIdFromEventTarget(mockImg('42'))).toBe(42)
  })

  it('lehnt ungültige Werte ab', () => {
    expect(
      inkAttachmentIdFromEventTarget({
        closest: (): null => null
      } as unknown as HTMLElement)
    ).toBeNull()
  })
})

describe('createNoteInkDomEventHandlers', () => {
  it('ruft den Handler bei Doppelklick auf Ink-Bild auf', () => {
    const handler = vi.fn()
    const event = {
      target: mockImg('9'),
      preventDefault: vi.fn()
    } as unknown as Event

    const handled = createNoteInkDomEventHandlers(() => handler).dblclick(null, event)
    expect(handled).toBe(true)
    expect(handler).toHaveBeenCalledWith(9)
  })
})
