import { describe, expect, it } from 'vitest'
import { noteBodyFtsText } from './note-body-fts-text'

describe('noteBodyFtsText', () => {
  it('extrahiert Text aus HTML', () => {
    expect(noteBodyFtsText('<p>Hallo <strong>Welt</strong></p>')).toBe('Hallo Welt')
  })

  it('entfernt Style-Blöcke', () => {
    expect(noteBodyFtsText('<style>.x{}</style><p>Text</p>')).toBe('Text')
  })

  it('vereinfacht Markdown', () => {
    expect(noteBodyFtsText('**fett** und normal')).toBe('fett und normal')
  })

  it('gibt leeren String für leeren Input zurück', () => {
    expect(noteBodyFtsText('   ')).toBe('')
  })
})
