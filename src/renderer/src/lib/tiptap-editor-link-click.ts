import { hrefForExternalOpen, openExternalUrl } from '@/lib/open-external'
import { parseNoteWikiLinkHref } from '@shared/note-wiki-link'

function anchorFromEvent(ev: Event): HTMLAnchorElement | null {
  for (const node of ev.composedPath()) {
    if (node instanceof HTMLAnchorElement) return node
  }
  const target = ev.target
  if (!(target instanceof Element)) return null
  const closest = target.closest('a')
  return closest instanceof HTMLAnchorElement ? closest : null
}

function wikiNoteIdFromAnchor(a: HTMLAnchorElement): number | null {
  const attr = a.getAttribute('href')
  if (attr) {
    const id = parseNoteWikiLinkHref(attr)
    if (id != null) return id
  }
  try {
    const hash = new URL(a.href, window.location.href).hash
    const fromHash = parseNoteWikiLinkHref(hash)
    if (fromHash != null) return fromHash
  } catch {
    // ignore
  }
  return null
}

function externalHrefFromAnchor(a: HTMLAnchorElement): string | null {
  const attr = a.getAttribute('href')?.trim() ?? ''
  let href = hrefForExternalOpen(attr || a.href)
  if (!href && attr && !/^[a-z][a-z0-9+.-]*:/i.test(attr)) {
    href = hrefForExternalOpen(`https://${attr}`)
  }
  return href
}

/** Klicks auf Links im editierbaren TipTap (Notizen, Verfassen) — per IPC / interne Notiz. */
export function handleTipTapLinkMouse(
  ev: MouseEvent,
  onOpenNote?: (noteId: number) => void
): boolean {
  if (ev.defaultPrevented) return false
  if (ev.type === 'auxclick' && ev.button !== 1) return false
  if ((ev.type === 'click' || ev.type === 'mousedown') && ev.button !== 0) return false

  const a = anchorFromEvent(ev)
  if (!a) return false

  const noteId = wikiNoteIdFromAnchor(a)
  if (noteId != null && onOpenNote) {
    onOpenNote(noteId)
    ev.preventDefault()
    ev.stopPropagation()
    return true
  }

  const href = externalHrefFromAnchor(a)
  if (!href) return false

  void openExternalUrl(href).catch((err) => console.warn('[tiptap] Link extern:', err))
  ev.preventDefault()
  ev.stopPropagation()
  return true
}

export function createTipTapLinkDomEventHandlers(
  getOnOpenNote: () => ((noteId: number) => void) | undefined
): {
  click: (view: unknown, event: Event) => boolean
  mousedown: (view: unknown, event: Event) => boolean
  auxclick: (view: unknown, event: Event) => boolean
} {
  const handle = (event: Event): boolean =>
    handleTipTapLinkMouse(event as MouseEvent, getOnOpenNote())

  return {
    click: (_view, event) => handle(event),
    mousedown: (_view, event) => handle(event),
    auxclick: (_view, event) => handle(event)
  }
}
