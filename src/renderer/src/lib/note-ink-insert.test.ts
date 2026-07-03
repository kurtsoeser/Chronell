import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  NOTE_INK_CONTENT_TYPE,
  NOTE_INK_DOCUMENT_VERSION,
  NOTE_INK_HTML_SOURCE_ATTR
} from '@shared/note-ink-document'

vi.mock('i18next', () => ({
  default: {
    t: (key: string): string => {
      if (key === 'notes.ink.defaultName') return 'Freihand'
      if (key === 'notes.ink.emptyInsert') return 'Noch nichts gezeichnet.'
      return key
    }
  }
}))

vi.mock('./note-ink-export', () => ({
  strokesToPngBlob: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
  buildNoteInkInsertHtml: vi.fn(
    (dataUrl: string, id: number): string =>
      `<img src="${dataUrl}" class="note-ink-snapshot" ${NOTE_INK_HTML_SOURCE_ATTR}="${id}" />`
  )
}))

import { buildInkAttachmentBaseName, appendInkDrawingToNote } from './note-ink-insert'

const sampleDocument = {
  version: NOTE_INK_DOCUMENT_VERSION,
  canvasWidth: 400,
  canvasHeight: 300,
  createdAt: '2026-07-02T10:00:00.000Z',
  strokes: [
    {
      id: 's1',
      tool: 'pen' as const,
      color: '#111827',
      size: 6,
      points: [
        { x: 10, y: 10, pressure: 0.5 },
        { x: 100, y: 50, pressure: 0.5 }
      ]
    }
  ]
}

describe('buildInkAttachmentBaseName', () => {
  it('enthält lokalisierten Namen und Zeitstempel', () => {
    const name = buildInkAttachmentBaseName(new Date('2026-07-02T14:30:00'))
    expect(name).toBe('Freihand 2026-07-02 14-30')
  })
})

describe('appendInkDrawingToNote', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T14:30:00'))
    class MockFileReader {
      result = 'data:image/png;base64,AQID'
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL(): void {
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('legt JSON- und PNG-Anhang an und fügt HTML ein', async () => {
    const addLocal = vi
      .fn()
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce({ id: 12 })
    vi.stubGlobal('window', {
      mailClient: {
        notes: {
          attachments: { addLocal }
        }
      }
    })

    const inserted: string[] = []
    await appendInkDrawingToNote(5, sampleDocument, (html) => {
      inserted.push(html)
    })

    expect(addLocal).toHaveBeenCalledTimes(2)
    expect(addLocal.mock.calls[0]?.[0]).toMatchObject({
      noteId: 5,
      name: 'Freihand 2026-07-02 14-30.ink.json',
      contentType: NOTE_INK_CONTENT_TYPE
    })
    expect(addLocal.mock.calls[1]?.[0]).toMatchObject({
      noteId: 5,
      contentType: 'image/png'
    })
    expect(inserted[0]).toContain('note-ink-snapshot')
    expect(inserted[0]).toContain(`${NOTE_INK_HTML_SOURCE_ATTR}="11"`)
  })

  it('lehnt leere Zeichnungen ab', async () => {
    await expect(
      appendInkDrawingToNote(
        1,
        { ...sampleDocument, strokes: [] },
        (): void => undefined
      )
    ).rejects.toThrow(/Noch nichts gezeichnet/)
  })
})
