import { describe, expect, it } from 'vitest'
import { isNoteWikiLinkHref, noteWikiLinkHref, parseNoteWikiLinkHref } from './note-wiki-link'

describe('noteWikiLinkHref', () => {
  it('erzeugt Hash-Anker', () => {
    expect(noteWikiLinkHref(42)).toBe('#chronell-note-42')
  })
})

describe('parseNoteWikiLinkHref', () => {
  it('parst Hash-Anker', () => {
    expect(parseNoteWikiLinkHref('#chronell-note-7')).toBe(7)
  })

  it('parst Chronell-Hash in vollständiger URL', () => {
    expect(parseNoteWikiLinkHref('http://localhost:5173/#chronell-note-7')).toBe(7)
  })

  it('parst Legacy-Schema', () => {
    expect(parseNoteWikiLinkHref('chronell-note:3')).toBe(3)
  })

  it('lehnt ungültige Werte ab', () => {
    expect(parseNoteWikiLinkHref('https://example.com')).toBeNull()
    expect(parseNoteWikiLinkHref('#chronell-note-0')).toBeNull()
  })
})

describe('isNoteWikiLinkHref', () => {
  it('erkennt interne Links', () => {
    expect(isNoteWikiLinkHref('#chronell-note-1')).toBe(true)
    expect(isNoteWikiLinkHref('mailto:a@b.de')).toBe(false)
  })
})
