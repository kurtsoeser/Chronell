import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sanitize-compose-html', () => ({
  prepareComposeEditorHtml: (html: string): string => html
}))

import {
  hasNoteBodyContent,
  isLikelyNoteHtml,
  markdownToNoteHtml,
  noteBodiesEqual,
  notePreviewText,
  prepareNoteBodyForEditor,
  storedBodyFromEditorHtml
} from './note-body-html'

describe('isLikelyNoteHtml', () => {
  it('erkennt TipTap-HTML', () => {
    expect(isLikelyNoteHtml('<p>Hallo</p>')).toBe(true)
    expect(isLikelyNoteHtml('<h2>Titel</h2><p>Text</p>')).toBe(true)
  })

  it('leerer Body gilt als HTML', () => {
    expect(isLikelyNoteHtml('')).toBe(true)
    expect(isLikelyNoteHtml('   ')).toBe(true)
  })

  it('Markdown wird nicht als HTML erkannt', () => {
    expect(isLikelyNoteHtml('# Überschrift')).toBe(false)
    expect(isLikelyNoteHtml('- Punkt eins')).toBe(false)
    expect(isLikelyNoteHtml('**fett** und _kursiv_')).toBe(false)
  })

  it('Klartext ohne Tags ist kein HTML', () => {
    expect(isLikelyNoteHtml('2 < 3 ist wahr')).toBe(false)
  })
})

describe('markdownToNoteHtml', () => {
  it('wandelt Überschriften und Listen um', () => {
    const html = markdownToNoteHtml('# Titel\n\n- eins\n- zwei')
    expect(html).toContain('<h1')
    expect(html).toContain('Titel')
    expect(html).toContain('<ul')
    expect(html).toContain('eins')
  })
})

describe('prepareNoteBodyForEditor', () => {
  it('migriert Markdown', () => {
    const result = prepareNoteBodyForEditor('## Notiz\n\nInhalt')
    expect(result.migratedFromMarkdown).toBe(true)
    expect(result.html).toContain('Notiz')
    expect(result.html).toContain('Inhalt')
  })

  it('belässt HTML unverändert (migriert: false)', () => {
    const body = '<p>Bereits HTML</p>'
    const result = prepareNoteBodyForEditor(body)
    expect(result.migratedFromMarkdown).toBe(false)
    expect(result.html).toContain('Bereits HTML')
  })
})

describe('storedBodyFromEditorHtml', () => {
  it('normalisiert leeren Editor', () => {
    expect(storedBodyFromEditorHtml('<p></p>')).toBe('')
  })
})

describe('noteBodiesEqual', () => {
  it('behandelt leeren Editor und leere DB gleich', () => {
    expect(noteBodiesEqual('<p></p>', '')).toBe(true)
  })
})

describe('hasNoteBodyContent', () => {
  it('erkennt Inhalt in HTML', () => {
    expect(hasNoteBodyContent('<p>Text</p>')).toBe(true)
    expect(hasNoteBodyContent('<p></p>')).toBe(false)
  })
})

describe('notePreviewText', () => {
  it('extrahiert Text aus HTML', () => {
    expect(notePreviewText('<p>Hallo <strong>Welt</strong></p>')).toBe('Hallo Welt')
  })

  it('verarbeitet Markdown weiterhin', () => {
    expect(notePreviewText('**fett** Text')).toBe('fett Text')
  })
})
