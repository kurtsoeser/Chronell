import { describe, expect, it } from 'vitest'
import {
  isNoteEntityMentionHref,
  noteCalendarEventMentionHref,
  noteCloudTaskMentionHref,
  noteContactMentionHref,
  noteEntityMentionLinkClass,
  noteMailMentionHref,
  noteWikiReferenceLinkClass,
  parseNoteCalendarEventMentionHref,
  parseNoteCloudTaskMentionHref,
  parseNoteContactMentionHref,
  parseNoteEntityMentionHref,
  parseNoteMailMentionHref
} from './note-entity-mention-link'

describe('noteContactMentionHref', () => {
  it('baut und parst Kontakt-Href', () => {
    const href = noteContactMentionHref(42)
    expect(parseNoteContactMentionHref(href)).toBe(42)
    expect(parseNoteEntityMentionHref(href)).toEqual({ kind: 'people_contact', contactId: 42 })
    expect(isNoteEntityMentionHref(href)).toBe(true)
  })
})

describe('noteMailMentionHref', () => {
  it('baut und parst E-Mail-Href', () => {
    const href = noteMailMentionHref(128)
    expect(parseNoteMailMentionHref(href)).toBe(128)
    expect(parseNoteEntityMentionHref(href)).toEqual({ kind: 'mail', messageId: 128 })
    expect(isNoteEntityMentionHref(href)).toBe(true)
    expect(noteEntityMentionLinkClass('mail')).toContain('note-entity-mention--mail')
  })
})

describe('noteCloudTaskMentionHref', () => {
  it('baut und parst Aufgaben-Href', () => {
    const href = noteCloudTaskMentionHref('acc/1', 'list=2', 'task:id')
    expect(parseNoteCloudTaskMentionHref(href)).toEqual({
      accountId: 'acc/1',
      listId: 'list=2',
      taskId: 'task:id'
    })
    expect(parseNoteEntityMentionHref(href)).toEqual({
      kind: 'cloud_task',
      accountId: 'acc/1',
      listId: 'list=2',
      taskId: 'task:id'
    })
    expect(noteEntityMentionLinkClass('cloud_task')).toContain('note-entity-mention--task')
  })
})

describe('noteCalendarEventMentionHref', () => {
  it('baut und parst Termin-Href mit Sonderzeichen', () => {
    const href = noteCalendarEventMentionHref('acc/1', 'evt=id:abc')
    expect(parseNoteCalendarEventMentionHref(href)).toEqual({
      accountId: 'acc/1',
      graphEventId: 'evt=id:abc'
    })
    expect(parseNoteEntityMentionHref(href)).toEqual({
      kind: 'calendar_event',
      accountId: 'acc/1',
      graphEventId: 'evt=id:abc'
    })
  })
})

describe('noteWikiReferenceLinkClass', () => {
  it('enthält Wiki- und Notiz-Klassen', () => {
    expect(noteWikiReferenceLinkClass()).toContain('note-wiki-link')
    expect(noteWikiReferenceLinkClass()).toContain('note-entity-mention--note')
  })
})

describe('noteEntityMentionLinkClass', () => {
  it('liefert Notiz-Klassen inkl. Wiki-Link', () => {
    expect(noteEntityMentionLinkClass('note')).toContain('note-wiki-link')
    expect(noteEntityMentionLinkClass('note')).toContain('note-entity-mention--note')
  })
})
