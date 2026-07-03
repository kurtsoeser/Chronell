import { Node, mergeAttributes, nodePasteRule } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { NoteEmbedThemeOptions } from '@shared/note-embed-theme'
import { createNoteEmbedResizableNodeView } from '@/components/note-embed-resizable-node-view'

export interface NoteIframeEmbedExtensionConfig {
  name: string
  dataAttr: string
  className: string
  title: string
  parseInput: (input: string) => string | null
  buildIframeSrc: (storedValue: string, options?: NoteEmbedThemeOptions) => string
  parseIframeSrc: (src: string) => string | null
  pasteRegex: RegExp
  iframeAllow?: string
  iframeExtras?: Record<string, string>
  iframeSelector?: string
  usesEditorTheme?: boolean
}

function parseEmbedDimension(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function parseStyleDimension(element: HTMLElement, property: 'width' | 'height'): number | null {
  const inline = element.style[property]
  if (inline) {
    const match = /^(\d+(?:\.\d+)?)px$/.exec(inline.trim())
    if (match?.[1]) return parseEmbedDimension(match[1])
  }
  return parseEmbedDimension(element.getAttribute(property))
}

export const noteEmbedSizeAttributes = {
  width: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => parseStyleDimension(element, 'width'),
    renderHTML: (attributes: { width?: number | null }) =>
      attributes.width ? { 'data-note-embed-width': String(attributes.width) } : {}
  },
  height: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => parseStyleDimension(element, 'height'),
    renderHTML: (attributes: { height?: number | null }) =>
      attributes.height ? { 'data-note-embed-height': String(attributes.height) } : {}
  }
}

export function createNoteIframeEmbedExtension(config: NoteIframeEmbedExtensionConfig) {
  const iframeClass = `${config.className}__iframe`

  function iframeAttrs(storedValue: string, width?: number | null, height?: number | null): Record<string, string> {
    const style = [
      width ? `width:${width}px` : 'width:100%',
      height ? `height:${height}px` : 'height:100%'
    ].join(';')
    return {
      src: config.buildIframeSrc(storedValue),
      title: config.title,
      class: iframeClass,
      style,
      loading: 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin',
      allowfullscreen: 'true',
      ...config.iframeExtras,
      ...(config.iframeAllow ? { allow: config.iframeAllow } : {})
    }
  }

  function wrapperStyle(width?: number | null, height?: number | null): string | undefined {
    const parts: string[] = []
    if (width) parts.push(`width:${width}px`)
    if (height) parts.push(`height:${height}px`)
    return parts.length > 0 ? parts.join(';') : undefined
  }

  return Node.create({
    name: config.name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addAttributes() {
      return {
        value: {
          default: null as string | null,
          parseHTML: (element) => element.getAttribute(config.dataAttr),
          renderHTML: (attributes) => {
            if (!attributes.value) return {}
            return { [config.dataAttr]: String(attributes.value) }
          }
        },
        ...noteEmbedSizeAttributes
      }
    },

    parseHTML() {
      const rules: Array<{
        tag: string
        getAttrs?: (element: HTMLElement) => false | Record<string, string | number>
      }> = [
        {
          tag: `div[${config.dataAttr}]`,
          getAttrs: (element) => {
            const value = element.getAttribute(config.dataAttr)
            if (!value) return false
            const width = parseStyleDimension(element, 'width')
            const height = parseStyleDimension(element, 'height')
            return {
              value,
              ...(width ? { width } : {}),
              ...(height ? { height } : {})
            }
          }
        }
      ]
      if (config.iframeSelector) {
        rules.push({
          tag: config.iframeSelector,
          getAttrs: (element) => {
            const stored = config.parseIframeSrc(element.getAttribute('src') ?? '')
            return stored ? { value: stored } : false
          }
        })
      }
      return rules
    },

    renderHTML({ HTMLAttributes }) {
      const storedValue = HTMLAttributes[config.dataAttr] ?? HTMLAttributes.value
      const width = parseEmbedDimension(String(HTMLAttributes.width ?? HTMLAttributes['data-note-embed-width'] ?? ''))
      const height = parseEmbedDimension(String(HTMLAttributes.height ?? HTMLAttributes['data-note-embed-height'] ?? ''))
      if (!storedValue) {
        return [
          'div',
          mergeAttributes(HTMLAttributes, {
            class: config.className,
            contenteditable: 'false'
          })
        ]
      }
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          class: config.className,
          [config.dataAttr]: String(storedValue),
          contenteditable: 'false',
          style: wrapperStyle(width, height)
        }),
        ['iframe', iframeAttrs(String(storedValue), width, height)]
      ]
    },

    addNodeView() {
      return ({ node, getPos, editor }) => {
        let currentValue = String(node.attrs.value ?? '')

        return createNoteEmbedResizableNodeView(
          {
            extensionName: config.name,
            className: config.className,
            dataAttr: config.dataAttr,
            title: config.title,
            iframeAllow: config.iframeAllow,
            iframeExtras: config.iframeExtras,
            usesEditorTheme: config.usesEditorTheme,
            readStoredValue: (sourceNode) => String(sourceNode.attrs.value ?? ''),
            onValueChange: (nextValue) => {
              currentValue = nextValue
            },
            buildIframeSrc: (options) => config.buildIframeSrc(currentValue, options)
          },
          { node, getPos, editor }
        )
      }
    },

    addPasteRules() {
      return [
        nodePasteRule({
          find: config.pasteRegex,
          type: this.type,
          getAttributes: (match) => {
            const value = config.parseInput(match[0])
            return value ? { value } : false
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
              const value = config.parseInput(text)
              if (!value) return false
              const node = nodeType.create({ value })
              const { tr } = view.state
              view.dispatch(tr.replaceSelectionWith(node))
              return true
            }
          }
        })
      ]
    }
  })
}
