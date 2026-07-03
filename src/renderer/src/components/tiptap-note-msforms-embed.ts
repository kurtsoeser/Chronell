import { Node, mergeAttributes, nodePasteRule } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { createNoteEmbedResizableNodeView } from '@/components/note-embed-resizable-node-view'
import { noteEmbedSizeAttributes } from '@/components/tiptap-note-iframe-embed-factory'
import {
  NOTE_MSFORMS_EMBED_ATTR,
  NOTE_MSFORMS_EMBED_CLASS,
  NOTE_MSFORMS_EMBED_HOST_ATTR,
  buildMsFormsEmbedUrl,
  parseMsFormsUrl,
  type MsFormsEmbedRef
} from '@shared/note-msforms-embed'

const MSFORMS_URL_PASTE_RE =
  /https?:\/\/forms\.(?:office\.com|cloud\.microsoft)\/Pages\/ResponsePage\.aspx\?[^\s]*/gi

function msFormsEmbedIframeAttrs(ref: MsFormsEmbedRef): Record<string, string> {
  return {
    src: buildMsFormsEmbedUrl(ref),
    title: 'Microsoft Forms',
    class: `${NOTE_MSFORMS_EMBED_CLASS}__iframe`,
    loading: 'lazy',
    referrerpolicy: 'strict-origin-when-cross-origin'
  }
}

/** Eingebettetes Microsoft-Formular als atomarer Block in Notizen. */
export const NoteMsFormsEmbed = Node.create({
  name: 'noteMsFormsEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      formId: {
        default: null as string | null,
        parseHTML: (element) => element.getAttribute(NOTE_MSFORMS_EMBED_ATTR),
        renderHTML: (attributes) => {
          if (!attributes.formId) return {}
          return { [NOTE_MSFORMS_EMBED_ATTR]: String(attributes.formId) }
        }
      },
      host: {
        default: 'forms.office.com' as MsFormsEmbedRef['host'],
        parseHTML: (element) =>
          element.getAttribute(NOTE_MSFORMS_EMBED_HOST_ATTR) ?? 'forms.office.com',
        renderHTML: (attributes) => {
          if (!attributes.formId) return {}
          return { [NOTE_MSFORMS_EMBED_HOST_ATTR]: String(attributes.host ?? 'forms.office.com') }
        }
      },
      ...noteEmbedSizeAttributes
    }
  },

  parseHTML() {
    return [
      {
        tag: `div[${NOTE_MSFORMS_EMBED_ATTR}]`
      },
      {
        tag: 'iframe[src*="forms.office.com/Pages/ResponsePage.aspx"], iframe[src*="forms.cloud.microsoft/Pages/ResponsePage.aspx"]',
        getAttrs: (element) => {
          const ref = parseMsFormsUrl((element as HTMLElement).getAttribute('src') ?? '')
          return ref ? { formId: ref.formId, host: ref.host } : false
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const formId = HTMLAttributes[NOTE_MSFORMS_EMBED_ATTR] ?? HTMLAttributes.formId
    const host = HTMLAttributes[NOTE_MSFORMS_EMBED_HOST_ATTR] ?? HTMLAttributes.host
    if (!formId) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          class: NOTE_MSFORMS_EMBED_CLASS,
          contenteditable: 'false'
        })
      ]
    }
    const ref: MsFormsEmbedRef = {
      formId: String(formId),
      host: host === 'forms.cloud.microsoft' ? 'forms.cloud.microsoft' : 'forms.office.com'
    }
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: NOTE_MSFORMS_EMBED_CLASS,
        [NOTE_MSFORMS_EMBED_ATTR]: ref.formId,
        [NOTE_MSFORMS_EMBED_HOST_ATTR]: ref.host,
        contenteditable: 'false'
      }),
      ['iframe', msFormsEmbedIframeAttrs(ref)]
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let ref: MsFormsEmbedRef = {
        formId: String(node.attrs.formId ?? ''),
        host: node.attrs.host === 'forms.cloud.microsoft' ? 'forms.cloud.microsoft' : 'forms.office.com'
      }

      return createNoteEmbedResizableNodeView(
        {
          extensionName: 'noteMsFormsEmbed',
          className: NOTE_MSFORMS_EMBED_CLASS,
          dataAttr: NOTE_MSFORMS_EMBED_ATTR,
          title: 'Microsoft Forms',
          readStoredValue: (sourceNode) => String(sourceNode.attrs.formId ?? ''),
          syncContainerAttrs: (container, sourceNode) => {
            ref = {
              formId: String(sourceNode.attrs.formId ?? ''),
              host:
                sourceNode.attrs.host === 'forms.cloud.microsoft'
                  ? 'forms.cloud.microsoft'
                  : 'forms.office.com'
            }
            container.setAttribute(NOTE_MSFORMS_EMBED_HOST_ATTR, ref.host)
          },
          buildIframeSrc: () => buildMsFormsEmbedUrl(ref)
        },
        { node, getPos, editor }
      )
    }
  },

  addCommands() {
    return {
      insertNoteMsFormsEmbed:
        (ref: MsFormsEmbedRef) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { formId: ref.formId, host: ref.host }
          })
    }
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: MSFORMS_URL_PASTE_RE,
        type: this.type,
        getAttributes: (match) => {
          const ref = parseMsFormsUrl(match[0])
          return ref ? { formId: ref.formId, host: ref.host } : false
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
            const ref = parseMsFormsUrl(text)
            if (!ref) return false
            const node = nodeType.create({ formId: ref.formId, host: ref.host })
            const { tr } = view.state
            view.dispatch(tr.replaceSelectionWith(node))
            return true
          }
        }
      })
    ]
  }
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteMsFormsEmbed: {
      insertNoteMsFormsEmbed: (ref: MsFormsEmbedRef) => ReturnType
    }
  }
}
