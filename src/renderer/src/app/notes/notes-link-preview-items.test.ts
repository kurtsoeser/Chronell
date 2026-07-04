import { describe, expect, it } from 'vitest'
import { buildNotesPreviewLinkEntries } from '@/app/notes/notes-link-preview-items'
import type { NoteLinksBundle } from '@shared/note-entity-links'
import type { UserNote } from '@shared/types'

const t = ((key: string): string => key) as import('i18next').TFunction

const editing = {
  id: 1,
  kind: 'standalone',
  title: 'Demo'
} as UserNote

const emptyBundle: NoteLinksBundle = { outgoing: [], incoming: [] }

describe('buildNotesPreviewLinkEntries', () => {
  it('includes people_contact from @-mentions in note body', () => {
    const bodyHtml =
      '<p>Meeting with <a href="#chronell-contact-42">Dave Grohl</a></p>'
    const entries = buildNotesPreviewLinkEntries(editing, emptyBundle, t, bodyHtml)

    expect(entries).toHaveLength(1)
    expect(entries[0]?.target).toEqual({ kind: 'people_contact', contactId: 42 })
    expect(entries[0]?.label).toBe('Dave Grohl')
    expect(entries[0]?.kindLabel).toBe('notes.links.kind.people_contact')
  })

  it('does not duplicate contacts already in outgoing links', () => {
    const bundle: NoteLinksBundle = {
      outgoing: [
        {
          linkId: 7,
          target: { kind: 'people_contact', contactId: 42 },
          title: 'Dave Grohl',
          subtitle: null,
          createdAt: ''
        }
      ],
      incoming: []
    }
    const bodyHtml =
      '<p><a href="#chronell-contact-42">Dave Grohl</a></p>'
    const entries = buildNotesPreviewLinkEntries(editing, bundle, t, bodyHtml)

    expect(entries).toHaveLength(1)
    expect(entries[0]?.direction).toBe('outgoing')
  })
})
