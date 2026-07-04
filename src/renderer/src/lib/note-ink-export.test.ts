import { describe, expect, it } from 'vitest'
import {
  buildNoteInkInsertHtml,
  createNoteInkDocument,
  getSvgPathFromStrokeOutline,
  parseNoteInkDocument,
  strokeToSvgPath,
  strokeToSvgRender,
  strokesToSvgMarkup
} from './note-ink-export'
import { NOTE_INK_HTML_SOURCE_ATTR } from '@shared/note-ink-document'

const penStroke = {
  id: 'p1',
  tool: 'pen' as const,
  color: '#111827',
  size: 8,
  points: [
    { x: 20, y: 20, pressure: 0.5 },
    { x: 80, y: 40, pressure: 0.6 },
    { x: 140, y: 30, pressure: 0.5 }
  ]
}

describe('getSvgPathFromStrokeOutline', () => {
  it('liefert leeren Pfad ohne Punkte', () => {
    expect(getSvgPathFromStrokeOutline([])).toBe('')
  })

  it('erzeugt geschlossenen SVG-Pfad', () => {
    const path = getSvgPathFromStrokeOutline([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ])
    expect(path.startsWith('M 0 0')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
  })
})

describe('strokeToSvgPath', () => {
  it('erzeugt Pfad für Stift-Striche', () => {
    const path = strokeToSvgPath(penStroke)
    expect(path.length).toBeGreaterThan(10)
    expect(path).toContain('M')
  })

  it('ignoriert Radierer-Striche', () => {
    expect(strokeToSvgPath({ ...penStroke, tool: 'eraser' })).toBe('')
    expect(strokeToSvgPath({ ...penStroke, points: [] })).toBe('')
  })

  it('rendert Textmarker halbtransparent', () => {
    const rendered = strokeToSvgRender({ ...penStroke, tool: 'highlighter', color: '#facc15' })
    expect(rendered?.fillOpacity).toBeCloseTo(0.35)
  })
})

describe('strokesToSvgMarkup', () => {
  it('enthält SVG mit Hintergrund und Pfad', () => {
    const svg = strokesToSvgMarkup([penStroke], 200, 100)
    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox="0 0 200 100"')
    expect(svg).toContain('<path')
    expect(svg).toContain('fill="#111827"')
  })
})

describe('buildNoteInkInsertHtml', () => {
  it('baut img-Tag mit data-Attribut', () => {
    const html = buildNoteInkInsertHtml('note-media://attachment/5/12', 7)
    expect(html).toContain('note-media://attachment/5/12')
    expect(html).toContain('note-ink-snapshot')
    expect(html).toContain(`${NOTE_INK_HTML_SOURCE_ATTR}="7"`)
  })

  it('escaped Anführungszeichen in URLs', () => {
    const html = buildNoteInkInsertHtml('note-media://attachment/1/"x"', 1)
    expect(html).not.toContain('attachment/1/"x"')
    expect(html).toContain('&quot;')
  })
})

describe('parseNoteInkDocument', () => {
  it('roundtrip über createNoteInkDocument', () => {
    const doc = createNoteInkDocument([penStroke], 320, 240, '2026-07-02T10:00:00.000Z')
    expect(parseNoteInkDocument(JSON.stringify(doc))).toEqual(doc)
  })
})
