import { describe, expect, it } from 'vitest'
import {
  NOTE_INK_DOCUMENT_VERSION,
  createNoteInkDocument,
  isNoteInkDocument,
  parseNoteInkDocument
} from './note-ink-document'

const sampleStroke = {
  id: 's1',
  tool: 'pen' as const,
  color: '#111827',
  size: 4,
  points: [{ x: 10, y: 20, pressure: 0.5 }]
}

describe('createNoteInkDocument', () => {
  it('filtert leere und Radierer-Striche', () => {
    const doc = createNoteInkDocument(
      [
        sampleStroke,
        {
          ...sampleStroke,
          id: 'h1',
          tool: 'highlighter',
          points: [{ x: 1, y: 2, pressure: 0.5 }]
        },
        { ...sampleStroke, id: 'e1', tool: 'eraser', points: [{ x: 1, y: 2, pressure: 0.5 }] },
        { ...sampleStroke, id: 'empty', points: [] }
      ],
      800,
      600,
      '2026-07-02T12:00:00.000Z'
    )
    expect(doc.version).toBe(NOTE_INK_DOCUMENT_VERSION)
    expect(doc.strokes).toHaveLength(2)
    expect(doc.canvasWidth).toBe(800)
    expect(doc.canvasHeight).toBe(600)
  })
})

describe('parseNoteInkDocument', () => {
  it('parst gültiges JSON', () => {
    const doc = createNoteInkDocument([sampleStroke], 400, 300)
    const parsed = parseNoteInkDocument(JSON.stringify(doc))
    expect(parsed).toEqual(doc)
  })

  it('lehnt ungültiges JSON ab', () => {
    expect(() => parseNoteInkDocument('{')).toThrow(/Ungültiges Ink-JSON/)
    expect(() => parseNoteInkDocument('{"version":99}')).toThrow(/unbekanntes Format/)
  })
})

describe('isNoteInkDocument', () => {
  it('erkennt gültige Dokumente', () => {
    expect(isNoteInkDocument(createNoteInkDocument([sampleStroke], 100, 100))).toBe(true)
  })

  it('lehnt ungültige Werte ab', () => {
    expect(isNoteInkDocument(null)).toBe(false)
    expect(isNoteInkDocument({ version: 1, canvasWidth: 0, canvasHeight: 10, strokes: [], createdAt: '' })).toBe(
      false
    )
  })
})
