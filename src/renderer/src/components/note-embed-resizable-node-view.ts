import { ResizableNodeView, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import i18n from '@/i18n'
import { normalizeNoteEmbedTheme } from '@shared/note-embed-theme'

export interface NoteEmbedResizableNodeViewConfig {
  extensionName: string
  className: string
  dataAttr: string
  title: string
  iframeAllow?: string
  iframeExtras?: Record<string, string>
  buildIframeSrc: (options?: { theme?: ReturnType<typeof normalizeNoteEmbedTheme> }) => string
  usesEditorTheme?: boolean
  onValueChange?: (nextValue: string) => void
  readStoredValue: (node: ProseMirrorNode) => string
  syncContainerAttrs?: (container: HTMLElement, node: ProseMirrorNode) => void
}

function readEditorTheme(editor: Editor) {
  const root = editor.view.dom.closest('[data-compose-theme]')
  return normalizeNoteEmbedTheme(root?.getAttribute('data-compose-theme'))
}

function createToolbarButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'note-embed-chrome__button'
  button.textContent = label
  button.title = title
  button.setAttribute('aria-label', title)
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return button
}

function applyEmbedChromeSize(
  container: HTMLElement,
  width?: number | null,
  height?: number | null
): void {
  const wrapper = container.querySelector<HTMLElement>('[data-resize-wrapper]')
  const hasCustom = Boolean(width || height)
  container.classList.toggle('note-embed-resizable--custom-size', hasCustom)

  if (width) {
    const w = `${width}px`
    container.style.width = w
    if (wrapper) wrapper.style.width = w
  } else {
    container.style.width = ''
    if (wrapper) wrapper.style.width = ''
  }

  if (height) {
    const h = `${height}px`
    container.style.height = h
    if (wrapper) wrapper.style.height = h
  } else {
    container.style.height = ''
    if (wrapper) wrapper.style.height = ''
  }
}

export function createNoteEmbedResizableNodeView(
  config: NoteEmbedResizableNodeViewConfig,
  context: {
    node: ProseMirrorNode
    getPos: () => number | undefined
    editor: Editor
  }
) {
  const { node, getPos, editor } = context
  let currentValue = config.readStoredValue(node)
  let interactive = false
  let themeObserver: MutationObserver | null = null
  let container: HTMLElement

  const frame = document.createElement('div')
  frame.className = `${config.className}__frame`

  const iframe = document.createElement('iframe')
  iframe.className = `${config.className}__iframe`
  iframe.title = config.title
  iframe.loading = 'lazy'
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  iframe.allowFullscreen = true
  if (config.iframeAllow) iframe.setAttribute('allow', config.iframeAllow)
  if (config.iframeExtras) {
    for (const [key, value] of Object.entries(config.iframeExtras)) {
      iframe.setAttribute(key, value)
    }
  }
  frame.appendChild(iframe)

  const applySrc = () => {
    iframe.src = config.buildIframeSrc(
      config.usesEditorTheme ? { theme: readEditorTheme(editor) } : undefined
    )
  }

  const setInteractive = (next: boolean) => {
    interactive = next
    container.classList.toggle('note-embed--interactive', interactive)
  }

  applySrc()

  if (config.usesEditorTheme) {
    const themeRoot = editor.view.dom.closest('[data-compose-theme]')
    if (themeRoot) {
      themeObserver = new MutationObserver(() => applySrc())
      themeObserver.observe(themeRoot, { attributes: true, attributeFilter: ['data-compose-theme'] })
    }
  }

  const nodeView = new ResizableNodeView({
    element: frame,
    editor,
    node,
    getPos,
    onResize: (width, height) => {
      frame.style.width = `${width}px`
      frame.style.height = `${height}px`
      applyEmbedChromeSize(container, width, height)
    },
    onCommit: (width, height) => {
      const pos = getPos()
      if (pos === undefined) return
      editor
        .chain()
        .focus()
        .setNodeSelection(pos)
        .updateAttributes(config.extensionName, { width, height })
        .run()
    },
    onUpdate: (updatedNode) => {
      if (updatedNode.type.name !== config.extensionName) return false
      const nextValue = config.readStoredValue(updatedNode)
      if (nextValue !== currentValue) {
        currentValue = nextValue
        container.setAttribute(config.dataAttr, currentValue)
        config.syncContainerAttrs?.(container, updatedNode)
        config.onValueChange?.(nextValue)
        applySrc()
      }
      const width = updatedNode.attrs.width as number | null | undefined
      const height = updatedNode.attrs.height as number | null | undefined
      if (width) frame.style.width = `${width}px`
      if (height) frame.style.height = `${height}px`
      applyEmbedChromeSize(container, width, height)
      return true
    },
    options: {
      directions: ['bottom-left', 'bottom-right', 'top-left', 'top-right'],
      min: { width: 160, height: 100 },
      className: {
        container: `${config.className} note-embed-resizable`,
        wrapper: 'note-embed-resizable__wrapper'
      }
    }
  })

  container = nodeView.dom
  container.setAttribute(config.dataAttr, currentValue)
  config.syncContainerAttrs?.(container, node)
  container.contentEditable = 'false'
  applyEmbedChromeSize(
    container,
    node.attrs.width as number | null | undefined,
    node.attrs.height as number | null | undefined
  )

  const chrome = document.createElement('div')
  chrome.className = 'note-embed-chrome'
  chrome.contentEditable = 'false'

  const interactButton = createToolbarButton(
    '▶',
    i18n.t('notes.embed.interact', { defaultValue: 'Mit Inhalt interagieren' }),
    () => {
      setInteractive(!interactive)
      const interactLabel = interactive
        ? i18n.t('notes.embed.stopInteract', { defaultValue: 'Interaktion beenden' })
        : i18n.t('notes.embed.interact', { defaultValue: 'Mit Inhalt interagieren' })
      interactButton.title = interactLabel
      interactButton.setAttribute('aria-label', interactLabel)
      interactButton.textContent = interactive ? '■' : '▶'
    }
  )

  const deleteButton = createToolbarButton(
    '×',
    i18n.t('notes.embed.remove', { defaultValue: 'Einbettung entfernen' }),
    () => {
      const pos = getPos()
      if (pos === undefined) return
      editor.chain().focus().setNodeSelection(pos).deleteSelection().run()
    }
  )

  chrome.append(interactButton, deleteButton)
  container.appendChild(chrome)

  const originalDestroy = nodeView.destroy.bind(nodeView)
  nodeView.destroy = () => {
    themeObserver?.disconnect()
    chrome.remove()
    originalDestroy()
  }

  return nodeView
}
