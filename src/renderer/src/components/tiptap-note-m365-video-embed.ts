import { Node, mergeAttributes, nodePasteRule } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import {
  buildM365VideoEmbedRefFromInput,
  M365_VIDEO_URL_PASTE_RE,
  NOTE_M365_VIDEO_EMBED_ATTR,
  NOTE_M365_VIDEO_EMBED_CLASS,
  serializeM365VideoEmbedRef
} from '@shared/note-m365-video-embed'
import { noteEmbedSizeAttributes } from '@/components/tiptap-note-iframe-embed-factory'
import { createNoteM365VideoNodeView } from '@/components/note-m365-video-node-view'

/** SharePoint/OneDrive-Video als natives `<video>` (Graph-Stream via Custom-Protocol). */
export const NoteM365VideoEmbed = Node.create({
  name: 'noteM365VideoEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      ref: {
        default: null as string | null,
        parseHTML: (element) => element.getAttribute(NOTE_M365_VIDEO_EMBED_ATTR),
        renderHTML: (attributes) => {
          if (!attributes.ref) return {}
          return { [NOTE_M365_VIDEO_EMBED_ATTR]: String(attributes.ref) }
        }
      },
      ...noteEmbedSizeAttributes
    }
  },

  parseHTML() {
    return [{ tag: `div[${NOTE_M365_VIDEO_EMBED_ATTR}]` }]
  },

  renderHTML({ HTMLAttributes }) {
    const ref = HTMLAttributes[NOTE_M365_VIDEO_EMBED_ATTR] ?? HTMLAttributes.ref
    if (!ref) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          class: NOTE_M365_VIDEO_EMBED_CLASS,
          contenteditable: 'false'
        })
      ]
    }
    const width = HTMLAttributes['data-note-embed-width']
    const height = HTMLAttributes['data-note-embed-height']
    const style = [
      width ? `width:${width}px` : '',
      height ? `height:${height}px` : ''
    ]
      .filter(Boolean)
      .join(';')
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: NOTE_M365_VIDEO_EMBED_CLASS,
        [NOTE_M365_VIDEO_EMBED_ATTR]: String(ref),
        contenteditable: 'false',
        ...(style ? { style } : {})
      })
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => createNoteM365VideoNodeView({ node, getPos, editor })
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: M365_VIDEO_URL_PASTE_RE,
        type: this.type,
        getAttributes: (match) => {
          const ref = buildM365VideoEmbedRefFromInput(match[0])
          return ref ? { ref: serializeM365VideoEmbedRef(ref) } : false
        }
      })
    ]
  },

  addProseMirrorPlugins() {
    const nodeType = this.type
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData('text/plain')?.trim()
            if (!text) return false
            const ref = buildM365VideoEmbedRefFromInput(text)
            if (!ref) return false
            const node = nodeType.create({
              ref: serializeM365VideoEmbedRef(ref)
            })
            view.dispatch(view.state.tr.replaceSelectionWith(node))
            return true
          }
        }
      })
    ]
  }
})
