import { Extension, type Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { noteWikiLinkHref } from '@shared/note-wiki-link'
import { noteWikiReferenceLinkClass } from '@shared/note-entity-mention-link'
import { linkNoteEntityMention } from '@/lib/note-entity-mention-insert'
import {
  NoteWikiLinkSuggestionList,
  type NoteWikiLinkSuggestionItem,
  type NoteWikiLinkSuggestionListRef
} from '@/components/NoteWikiLinkSuggestionList'

export interface NoteWikiLinkExtensionOptions {
  currentNoteId?: number
  onLinkAdded?: () => void
  onLinkError?: (message: string) => void
}

const NOTE_WIKI_LINK_PLUGIN_KEY = new PluginKey('noteWikiLinkSuggestion')
const WIKI_LINK_OPEN_RE = /\[\[([^\]]*)$/

export function findNoteWikiLinkSuggestionMatch($position: {
  pos: number
  nodeBefore?: { isText?: boolean; text?: string } | null
}): { range: { from: number; to: number }; query: string; text: string } | null {
  const text = $position.nodeBefore?.isText ? ($position.nodeBefore.text ?? '') : ''
  if (!text) return null
  const match = WIKI_LINK_OPEN_RE.exec(text)
  if (!match) return null
  const from = $position.pos - match[0].length
  return {
    range: { from, to: $position.pos },
    query: match[1] ?? '',
    text: match[0]
  }
}

async function searchNoteWikiTargets(
  query: string,
  excludeNoteId?: number
): Promise<NoteWikiLinkSuggestionItem[]> {
  const q = query.trim()
  try {
    const targets = await window.mailClient.notes.links.searchTargets({
      query: q,
      excludeNoteId,
      limit: 12
    })
    return targets
      .filter((row): row is typeof row & { target: { kind: 'note'; noteId: number } } =>
        row.target.kind === 'note' && typeof row.target.noteId === 'number'
      )
      .map((row) => ({
        id: row.target.noteId,
        title: row.title?.trim() || `Notiz #${row.target.noteId}`
      }))
  } catch {
    return []
  }
}

function createSuggestionOptions(
  options: NoteWikiLinkExtensionOptions
): Omit<SuggestionOptions<NoteWikiLinkSuggestionItem>, 'editor'> {
  let popup: HTMLDivElement | null = null
  let component: ReactRenderer<NoteWikiLinkSuggestionListRef> | null = null

  const positionPopup = (clientRect?: (() => DOMRect | null) | null): void => {
    if (!popup || !clientRect) return
    const rect = clientRect()
    if (!rect) return
    popup.style.left = `${Math.round(rect.left)}px`
    popup.style.top = `${Math.round(rect.bottom + 4)}px`
  }

  return {
    pluginKey: NOTE_WIKI_LINK_PLUGIN_KEY,
    char: '[',
    allowSpaces: true,
    allowedPrefixes: null,
    findSuggestionMatch: ({ $position }) => findNoteWikiLinkSuggestionMatch($position),
    items: async ({ query }): Promise<NoteWikiLinkSuggestionItem[]> =>
      searchNoteWikiTargets(query, options.currentNoteId),
    command: ({ editor, range, props }): void => {
      const title = props.title.trim() || `Notiz #${props.id}`
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
                href: noteWikiLinkHref(props.id),
                class: noteWikiReferenceLinkClass(),
                target: null,
                rel: null
              }
            }
          ]
        })
        .insertContent(' ')
        .run()
      if (options.currentNoteId != null) {
        void linkNoteEntityMention(options.currentNoteId, { kind: 'note', noteId: props.id })
          .then(() => options.onLinkAdded?.())
          .catch((e) => {
            options.onLinkError?.(e instanceof Error ? e.message : String(e))
          })
      }
    },
    render: () => ({
      onStart: (props): void => {
        component = new ReactRenderer(NoteWikiLinkSuggestionList, {
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

export function createNoteWikiLinkExtension(
  options: NoteWikiLinkExtensionOptions
): Extension {
  return Extension.create({
    name: 'noteWikiLinkSuggestion',
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
