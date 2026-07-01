import { describe, expect, it } from 'vitest'
import { findNoteWikiLinkSuggestionMatch } from '@/components/tiptap-note-wiki-link'

function pos(textBeforeCursor: string) {
  return {
    pos: textBeforeCursor.length,
    nodeBefore: { isText: true, text: textBeforeCursor }
  }
}

describe('findNoteWikiLinkSuggestionMatch', () => {
  it('erkennt [[ mit Leerzeichen als leere Suche', () => {
    const match = findNoteWikiLinkSuggestionMatch(pos('Vor [[ '))
    expect(match?.query).toBe(' ')
    expect(match?.text).toBe('[[ ')
  })

  it('erkennt [[ am Wortende', () => {
    const match = findNoteWikiLinkSuggestionMatch(pos('Vor [['))
    expect(match).toEqual({
      range: { from: 4, to: 6 },
      query: '',
      text: '[['
    })
  })

  it('erkennt [[ mit Suchtext', () => {
    const match = findNoteWikiLinkSuggestionMatch(pos('Siehe [[Meet'))
    expect(match).toEqual({
      range: { from: 6, to: 12 },
      query: 'Meet',
      text: '[[Meet'
    })
  })

  it('ignoriert einzelne Klammer', () => {
    expect(findNoteWikiLinkSuggestionMatch(pos('nur ['))).toBeNull()
  })

  it('ignoriert geschlossene Wiki-Links', () => {
    expect(findNoteWikiLinkSuggestionMatch(pos('[[fertig]] danach'))).toBeNull()
  })
})
