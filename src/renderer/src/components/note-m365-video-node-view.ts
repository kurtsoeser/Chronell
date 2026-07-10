import { ResizableNodeView, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import {
  NOTE_M365_VIDEO_EMBED_CLASS,
  canUseM365NativePlayback,
  isM365VideoEmbedReady,
  parseM365VideoEmbedRef,
  serializeM365VideoEmbedRef,
  type NoteM365VideoEmbedRef
} from '@shared/note-m365-video-embed'
import { noteM365VideoUrl } from '@shared/note-m365-video-url'
import i18n from '@/i18n'
import { openExternalUrl } from '@/lib/open-external'

const EXTENSION_NAME = 'noteM365VideoEmbed'

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

function createChromeButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
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

function createFallbackButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'note-m365-video-embed__button'
  button.textContent = label
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return button
}

function readRef(node: ProseMirrorNode): NoteM365VideoEmbedRef | null {
  return parseM365VideoEmbedRef(String(node.attrs.ref ?? ''))
}

function streamExternalUrl(ref: NoteM365VideoEmbedRef): string {
  return ref.streamEmbedSrc ?? ref.webUrl ?? ref.shareUrl
}

function renderFallback(
  panel: HTMLElement,
  ref: NoteM365VideoEmbedRef,
  options: {
    onConnect: () => void
    onRetry?: () => void
    messageKey?: string
  }
): void {
  panel.replaceChildren()

  if (ref.thumbnailUrl) {
    const thumb = document.createElement('img')
    thumb.className = 'note-m365-video-embed__thumb'
    thumb.src = ref.thumbnailUrl
    thumb.alt = ref.title ?? ''
    thumb.loading = 'lazy'
    panel.appendChild(thumb)
  }

  const title = document.createElement('p')
  title.className = 'note-m365-video-embed__title'
  title.textContent =
    ref.title ??
    i18n.t('notes.m365Video.fallbackTitle', { defaultValue: 'SharePoint-Video' })
  panel.appendChild(title)

  const message = document.createElement('p')
  message.className = 'note-m365-video-embed__message'
  if (options.messageKey) {
    message.textContent = i18n.t(options.messageKey, {
      defaultValue: i18n.t('notes.m365Video.error.unknown', {
        defaultValue: 'Wiedergabe nicht möglich.'
      })
    })
  } else {
    message.textContent = i18n.t(`notes.m365Video.error.${ref.error ?? 'unknown'}`, {
      defaultValue: i18n.t('notes.m365Video.error.unknown', {
        defaultValue: 'Wiedergabe nicht möglich.'
      })
    })
  }
  panel.appendChild(message)

  const actions = document.createElement('div')
  actions.className = 'note-m365-video-embed__actions'

  actions.appendChild(
    createFallbackButton(
      i18n.t('notes.m365Video.openExternal', { defaultValue: 'In SharePoint öffnen' }),
      () => {
        void openExternalUrl(streamExternalUrl(ref)).catch(() => undefined)
      }
    )
  )

  if (options.onRetry) {
    actions.appendChild(
      createFallbackButton(
        i18n.t('notes.m365Video.retryResolve', { defaultValue: 'Erneut laden' }),
        options.onRetry
      )
    )
  }

  if (ref.error === 'no_account' || ref.error === 'forbidden') {
    actions.appendChild(
      createFallbackButton(
        i18n.t('notes.m365Video.connectAccount', { defaultValue: 'Mit Konto verbinden' }),
        options.onConnect
      )
    )
  }

  panel.appendChild(actions)
}

export function createNoteM365VideoNodeView(context: {
  node: ProseMirrorNode
  getPos: () => number | undefined
  editor: Editor
}) {
  const { node, getPos, editor } = context
  let currentRef = readRef(node)
  let resolving = false
  let container: HTMLElement

  const frame = document.createElement('div')
  frame.className = `${NOTE_M365_VIDEO_EMBED_CLASS}__frame`

  const video = document.createElement('video')
  video.className = `${NOTE_M365_VIDEO_EMBED_CLASS}__video`
  video.controls = true
  video.preload = 'metadata'
  video.playsInline = true

  const fallback = document.createElement('div')
  fallback.className = `${NOTE_M365_VIDEO_EMBED_CLASS}__fallback`
  fallback.hidden = true

  frame.append(video, fallback)

  const connectAccount = (): void => {
    void (async () => {
      try {
        await window.mailClient.auth.addMicrosoft()
        if (currentRef?.shareUrl) await resolveRef(currentRef.shareUrl)
      } catch {
        // Konto-Dialog abgebrochen
      }
    })()
  }

  const syncPlayback = (ref: NoteM365VideoEmbedRef | null): void => {
    video.removeAttribute('src')
    video.hidden = true
    video.onerror = null

    if (!ref) {
      fallback.hidden = true
      fallback.replaceChildren()
      updateChromeButtons(ref)
      return
    }

    if (canUseM365NativePlayback(ref)) {
      fallback.hidden = true
      fallback.replaceChildren()
      video.src = noteM365VideoUrl(ref.accountId!, ref.driveId!, ref.itemId!)
      video.hidden = false
      video.onerror = (): void => {
        video.onerror = null
        video.hidden = true
        video.removeAttribute('src')
        renderFallback(fallback, ref, {
          onConnect: connectAccount,
          onRetry: (): void => void resolveRef(ref.shareUrl),
          messageKey: ref.streamEmbedSrc
            ? 'notes.m365Video.streamAuthHint'
            : 'notes.m365Video.error.playback'
        })
        fallback.hidden = false
        updateChromeButtons(ref)
      }
      updateChromeButtons(ref)
      return
    }

    video.hidden = true
    fallback.hidden = false
    if (ref.error) {
      renderFallback(fallback, ref, {
        onConnect: connectAccount,
        onRetry: ref.shareUrl ? (): void => void resolveRef(ref.shareUrl) : undefined
      })
    } else if (ref.streamEmbedSrc) {
      renderFallback(fallback, ref, {
        onConnect: connectAccount,
        onRetry: (): void => void resolveRef(ref.shareUrl),
        messageKey: 'notes.m365Video.streamAuthHint'
      })
    } else if (resolving) {
      fallback.replaceChildren()
      const loading = document.createElement('p')
      loading.className = 'note-m365-video-embed__message'
      loading.textContent = i18n.t('notes.m365Video.resolving', {
        defaultValue: 'Video wird vorbereitet …'
      })
      fallback.appendChild(loading)
    } else {
      renderFallback(fallback, ref, {
        onConnect: connectAccount,
        onRetry: (): void => void resolveRef(ref.shareUrl)
      })
    }

    updateChromeButtons(ref)
  }

  const persistRef = (ref: NoteM365VideoEmbedRef): void => {
    const pos = getPos()
    if (pos === undefined) return
    editor
      .chain()
      .setNodeSelection(pos)
      .updateAttributes(EXTENSION_NAME, { ref: serializeM365VideoEmbedRef(ref) })
      .run()
  }

  const resolveRef = async (shareUrl: string): Promise<void> => {
    if (resolving) return
    resolving = true
    syncPlayback(currentRef)
    try {
      const result = await window.mailClient.notes.resolveM365Video({ shareUrl })
      currentRef = result.ref
      if (currentRef.playback === 'stream') {
        currentRef = { ...currentRef, playback: 'native' }
      }
      container.setAttribute('data-note-m365-video-ref', serializeM365VideoEmbedRef(currentRef))
      syncPlayback(currentRef)
      persistRef(currentRef)
    } finally {
      resolving = false
      if (currentRef && !isM365VideoEmbedReady(currentRef)) {
        syncPlayback(currentRef)
      }
    }
  }

  const streamButton = createChromeButton(
    '☁',
    i18n.t('notes.m365Video.openStreamExternal', {
      defaultValue: 'Stream mit Untertiteln im Browser öffnen'
    }),
    () => {
      if (!currentRef) return
      void openExternalUrl(streamExternalUrl(currentRef)).catch(() => undefined)
    }
  )

  const deleteButton = createChromeButton(
    '×',
    i18n.t('notes.embed.remove', { defaultValue: 'Einbettung entfernen' }),
    () => {
      const pos = getPos()
      if (pos === undefined) return
      editor.chain().focus().setNodeSelection(pos).deleteSelection().run()
    }
  )

  function updateChromeButtons(ref: NoteM365VideoEmbedRef | null): void {
    streamButton.hidden = !ref?.streamEmbedSrc?.trim()
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
        .updateAttributes(EXTENSION_NAME, { width, height })
        .run()
    },
    onUpdate: (updatedNode) => {
      if (updatedNode.type.name !== EXTENSION_NAME) return false
      const nextRef = readRef(updatedNode)
      if (JSON.stringify(nextRef) !== JSON.stringify(currentRef)) {
        currentRef = nextRef
        if (currentRef) {
          container.setAttribute('data-note-m365-video-ref', serializeM365VideoEmbedRef(currentRef))
        }
        syncPlayback(currentRef)
        if (currentRef && !isM365VideoEmbedReady(currentRef) && !currentRef.error) {
          void resolveRef(currentRef.shareUrl)
        }
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
      min: { width: 240, height: 135 },
      className: {
        container: `${NOTE_M365_VIDEO_EMBED_CLASS} note-embed-resizable`,
        wrapper: 'note-embed-resizable__wrapper'
      }
    }
  })

  container = nodeView.dom
  if (currentRef) {
    container.setAttribute('data-note-m365-video-ref', serializeM365VideoEmbedRef(currentRef))
  }
  container.contentEditable = 'false'
  applyEmbedChromeSize(
    container,
    node.attrs.width as number | null | undefined,
    node.attrs.height as number | null | undefined
  )

  const chrome = document.createElement('div')
  chrome.className = 'note-embed-chrome'
  chrome.contentEditable = 'false'
  chrome.append(streamButton, deleteButton)
  container.appendChild(chrome)

  syncPlayback(currentRef)
  if (currentRef && !currentRef.error && !isM365VideoEmbedReady(currentRef)) {
    void resolveRef(currentRef.shareUrl)
  }

  const originalDestroy = nodeView.destroy.bind(nodeView)
  nodeView.destroy = () => {
    video.removeAttribute('src')
    chrome.remove()
    originalDestroy()
  }

  return nodeView
}
