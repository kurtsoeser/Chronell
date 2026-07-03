import { describe, expect, it } from 'vitest'
import { buildNoteEntityMentionHtml } from './note-entity-mention-export'

describe('buildNoteEntityMentionHtml', () => {
  it('baut Kontakt-Link', () => {
    const html = buildNoteEntityMentionHtml('Max Mustermann', {
      kind: 'people_contact',
      contactId: 3
    })
    expect(html).toContain('#chronell-contact-3')
    expect(html).toContain('note-entity-mention--contact')
    expect(html).toContain('Max Mustermann')
  })

  it('baut Termin-Link', () => {
    const html = buildNoteEntityMentionHtml('Standup', {
      kind: 'calendar_event',
      accountId: 'a1',
      graphEventId: 'evt1'
    })
    expect(html).toContain('#chronell-event-')
    expect(html).toContain('note-entity-mention--calendar')
    expect(html).toContain('Standup')
  })

  it('baut Notiz-Link', () => {
    const html = buildNoteEntityMentionHtml('Projektnotiz', {
      kind: 'note',
      noteId: 9
    })
    expect(html).toContain('#chronell-note-9')
    expect(html).toContain('note-wiki-link')
    expect(html).toContain('note-entity-mention--note')
  })

  it('baut E-Mail-Link', () => {
    const html = buildNoteEntityMentionHtml('Rechnung Q1', {
      kind: 'mail',
      messageId: 55
    })
    expect(html).toContain('#chronell-mail-55')
    expect(html).toContain('note-entity-mention--mail')
    expect(html).toContain('Rechnung Q1')
  })

  it('baut Aufgaben-Link', () => {
    const html = buildNoteEntityMentionHtml('Follow-up', {
      kind: 'cloud_task',
      accountId: 'a1',
      listId: 'l1',
      taskId: 't1'
    })
    expect(html).toContain('#chronell-task-')
    expect(html).toContain('note-entity-mention--task')
    expect(html).toContain('Follow-up')
  })
})
