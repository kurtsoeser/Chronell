import { Extension, type Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import type { NoteEntityLinkTarget } from '@shared/note-entity-links'
import {
  noteCalendarEventMentionHref,
  noteCloudTaskMentionHref,
  noteContactMentionHref,
  noteEntityMentionLinkClass,
  noteMailMentionHref
} from '@shared/note-entity-mention-link'
import { noteWikiLinkHref } from '@shared/note-wiki-link'
import {
  NoteEntityMentionSuggestionList,
  type NoteEntityMentionSuggestionItem,
  type NoteEntityMentionSuggestionListRef
} from '@/components/NoteEntityMentionSuggestionList'
import { linkNoteEntityMention } from '@/lib/note-entity-mention-insert'

export interface NoteEntityMentionExtensionOptions {
  noteId?: number
  onLinkAdded?: () => void
  onLinkError?: (message: string) => void
}

const NOTE_ENTITY_MENTION_PLUGIN_KEY = new PluginKey('noteEntityMentionSuggestion')

async function searchEntityMentionTargets(
  query: string,
  excludeNoteId?: number
): Promise<NoteEntityMentionSuggestionItem[]> {
  const q = query.trim()
  try {
    const targets = await window.mailClient.notes.links.searchTargets({
      query: q,
      excludeNoteId,
      limit: 32
    })
    return targets
      .filter(
        (row): row is typeof row & {
          target:
            | { kind: 'note'; noteId: number }
            | { kind: 'mail'; messageId: number }
            | { kind: 'cloud_task'; accountId: string; listId: string; taskId: string }
            | { kind: 'people_contact'; contactId: number }
            | { kind: 'calendar_event'; accountId: string; graphEventId: string }
        } =>
          row.target.kind === 'note' ||
          row.target.kind === 'mail' ||
          row.target.kind === 'cloud_task' ||
          row.target.kind === 'people_contact' ||
          row.target.kind === 'calendar_event'
      )
      .map((row) => {
        if (row.target.kind === 'note') {
          return {
            kind: 'note' as const,
            noteId: row.target.noteId,
            title: row.title?.trim() || `Notiz #${row.target.noteId}`,
            subtitle: row.subtitle
          }
        }
        if (row.target.kind === 'mail') {
          return {
            kind: 'mail' as const,
            messageId: row.target.messageId,
            title: row.title?.trim() || `E-Mail #${row.target.messageId}`,
            subtitle: row.subtitle
          }
        }
        if (row.target.kind === 'cloud_task') {
          return {
            kind: 'cloud_task' as const,
            accountId: row.target.accountId,
            listId: row.target.listId,
            taskId: row.target.taskId,
            title: row.title?.trim() || 'Aufgabe',
            subtitle: row.subtitle
          }
        }
        if (row.target.kind === 'people_contact') {
          return {
            kind: 'people_contact' as const,
            contactId: row.target.contactId,
            title: row.title?.trim() || `Kontakt #${row.target.contactId}`,
            subtitle: row.subtitle
          }
        }
        return {
          kind: 'calendar_event' as const,
          accountId: row.target.accountId,
          graphEventId: row.target.graphEventId,
          title: row.title?.trim() || 'Termin',
          subtitle: row.subtitle
        }
      })
  } catch {
    return []
  }
}

function mentionTargetFromItem(item: NoteEntityMentionSuggestionItem): NoteEntityLinkTarget | null {
  if (item.kind === 'note' && item.noteId != null) {
    return { kind: 'note', noteId: item.noteId }
  }
  if (item.kind === 'mail' && item.messageId != null) {
    return { kind: 'mail', messageId: item.messageId }
  }
  if (
    item.kind === 'cloud_task' &&
    item.accountId &&
    item.listId &&
    item.taskId
  ) {
    return {
      kind: 'cloud_task',
      accountId: item.accountId,
      listId: item.listId,
      taskId: item.taskId
    }
  }
  if (item.kind === 'people_contact' && item.contactId != null) {
    return { kind: 'people_contact', contactId: item.contactId }
  }
  if (item.kind === 'calendar_event' && item.accountId && item.graphEventId) {
    return { kind: 'calendar_event', accountId: item.accountId, graphEventId: item.graphEventId }
  }
  return null
}

function mentionHrefAndClass(
  target: NoteEntityLinkTarget
): { href: string; linkClass: string } | null {
  if (target.kind === 'note') {
    return {
      href: noteWikiLinkHref(target.noteId),
      linkClass: noteEntityMentionLinkClass('note')
    }
  }
  if (target.kind === 'mail') {
    return {
      href: noteMailMentionHref(target.messageId),
      linkClass: noteEntityMentionLinkClass('mail')
    }
  }
  if (target.kind === 'cloud_task') {
    return {
      href: noteCloudTaskMentionHref(target.accountId, target.listId, target.taskId),
      linkClass: noteEntityMentionLinkClass('cloud_task')
    }
  }
  if (target.kind === 'people_contact') {
    return {
      href: noteContactMentionHref(target.contactId),
      linkClass: noteEntityMentionLinkClass('people_contact')
    }
  }
  if (target.kind === 'calendar_event') {
    return {
      href: noteCalendarEventMentionHref(target.accountId, target.graphEventId),
      linkClass: noteEntityMentionLinkClass('calendar_event')
    }
  }
  return null
}

function createSuggestionOptions(
  options: NoteEntityMentionExtensionOptions
): Omit<SuggestionOptions<NoteEntityMentionSuggestionItem>, 'editor'> {
  let popup: HTMLDivElement | null = null
  let component: ReactRenderer<NoteEntityMentionSuggestionListRef> | null = null

  const positionPopup = (clientRect?: (() => DOMRect | null) | null): void => {
    if (!popup || !clientRect) return
    const rect = clientRect()
    if (!rect) return
    popup.style.left = `${Math.round(rect.left)}px`
    popup.style.top = `${Math.round(rect.bottom + 4)}px`
  }

  return {
    pluginKey: NOTE_ENTITY_MENTION_PLUGIN_KEY,
    char: '@',
    allowSpaces: true,
    allowedPrefixes: [' ', '\n'],
    items: async ({ query }): Promise<NoteEntityMentionSuggestionItem[]> =>
      searchEntityMentionTargets(query, options.noteId),
    command: ({ editor, range, props }): void => {
      const target = mentionTargetFromItem(props)
      if (!target) return
      const link = mentionHrefAndClass(target)
      if (!link) return
      const title = props.title.trim() || '—'
      editor
        .chain()
        .focus()
        .insertContentAt(range, {
          type: 'text',
          text: title,
          marks: [
            {
              type: 'link',
              attrs: {
                href: link.href,
                class: link.linkClass,
                target: null,
                rel: 'noopener noreferrer'
              }
            }
          ]
        })
        .insertContent(' ')
        .run()
      if (options.noteId != null) {
        void linkNoteEntityMention(options.noteId, target)
          .then(() => options.onLinkAdded?.())
          .catch((e) => {
            options.onLinkError?.(e instanceof Error ? e.message : String(e))
          })
      }
    },
    render: () => ({
      onStart: (props): void => {
        component = new ReactRenderer(NoteEntityMentionSuggestionList, {
          props,
          editor: props.editor as Editor
        })
        popup = document.createElement('div')
        popup.style.position = 'fixed'
        popup.style.zIndex = '2000'
        popup.appendChild(component.element)
        document.body.appendChild(popup)
        positionPopup(props.clientRect)
      },
      onUpdate: (props): void => {
        component?.updateProps(props)
        positionPopup(props.clientRect)
      },
      onKeyDown: (props): boolean => component?.ref?.onKeyDown(props.event) ?? false,
      onExit: (): void => {
        popup?.remove()
        popup = null
        component?.destroy()
        component = null
      }
    })
  }
}

export function createNoteEntityMentionExtension(
  options: NoteEntityMentionExtensionOptions
): Extension {
  return Extension.create({
    name: 'noteEntityMentionSuggestion',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...createSuggestionOptions(options)
        })
      ]
    }
  })
}
