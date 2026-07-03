import { describe, expect, it } from 'vitest'
import { collectNoteEntityMentionsFromHtml } from './note-entity-mentions-from-html'

describe('collectNoteEntityMentionsFromHtml', () => {
  it('findet Kontakt-Erwähnungen', () => {
    const html =
      '<p>Meeting mit <a href="#chronell-contact-12" class="note-entity-mention note-entity-mention--contact">Max Mustermann</a></p>'
    expect(collectNoteEntityMentionsFromHtml(html)).toEqual([
      {
        target: { kind: 'people_contact', contactId: 12 },
        title: 'Max Mustermann'
      }
    ])
  })

  it('dedupliziert gleiche Ziele', () => {
    const html =
      '<a href="#chronell-contact-3">A</a> und <a href="#chronell-contact-3">B</a>'
    expect(collectNoteEntityMentionsFromHtml(html)).toHaveLength(1)
  })

  it('findet Wiki-Notiz-Links', () => {
    const html =
      '<p>Siehe <a href="#chronell-note-9" class="note-wiki-link">Projektnotiz</a></p>'
    expect(collectNoteEntityMentionsFromHtml(html)).toEqual([
      {
        target: { kind: 'note', noteId: 9 },
        title: 'Projektnotiz'
      }
    ])
  })

  it('parst Chronell-Links in vollständigen URLs', () => {
    const html =
      '<a href="http://localhost:5173/#chronell-note-42">Zielseite</a>'
    expect(collectNoteEntityMentionsFromHtml(html)).toEqual([
      {
        target: { kind: 'note', noteId: 42 },
        title: 'Zielseite'
      }
    ])
  })
})
