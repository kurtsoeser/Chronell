import { hrefForExternalOpen, openExternalUrl } from '@/lib/open-external'
import { parseNoteEntityMentionHref } from '@shared/note-entity-mention-link'
import type { NoteEntityLinkTarget } from '@shared/note-entity-links'
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

function hrefFromAnchor(a: HTMLAnchorElement): string | null {
  const attr = a.getAttribute('href')?.trim()
  if (attr) return attr
  try {
    return new URL(a.href, window.location.href).hash || a.href
  } catch {
    return a.href || null
  }
}

function wikiNoteIdFromAnchor(a: HTMLAnchorElement): number | null {
  const href = hrefFromAnchor(a)
  if (!href) return null
  const id = parseNoteWikiLinkHref(href)
  if (id != null) return id
  try {
    const hash = new URL(a.href, window.location.href).hash
    return parseNoteWikiLinkHref(hash)
  } catch {
    return null
  }
}

function entityMentionFromAnchor(a: HTMLAnchorElement): NoteEntityLinkTarget | null {
  const href = hrefFromAnchor(a)
  return parseNoteEntityMentionHref(href)
}

function externalHrefFromAnchor(a: HTMLAnchorElement): string | null {
  const attr = a.getAttribute('href')?.trim() ?? ''
  let href = hrefForExternalOpen(attr || a.href)
  if (!href && attr && !/^[a-z][a-z0-9+.-]*:/i.test(attr)) {
    href = hrefForExternalOpen(`https://${attr}`)
  }
  return href
}

export interface TipTapLinkClickHandlers {
  onOpenNote?: (noteId: number) => void
  onOpenEntityMention?: (target: NoteEntityLinkTarget) => void
}

/** Klicks auf Links im editierbaren TipTap (Notizen, Verfassen) — per IPC / interne Notiz. */
export function handleTipTapLinkMouse(ev: MouseEvent, handlers?: TipTapLinkClickHandlers): boolean {
  if (ev.defaultPrevented) return false
  if (ev.type === 'auxclick' && ev.button !== 1) return false
  if ((ev.type === 'click' || ev.type === 'mousedown') && ev.button !== 0) return false

  const a = anchorFromEvent(ev)
  if (!a) return false

  const noteId = wikiNoteIdFromAnchor(a)
  if (noteId != null && handlers?.onOpenNote) {
    handlers.onOpenNote(noteId)
    ev.preventDefault()
    ev.stopPropagation()
    return true
  }

  const entity = entityMentionFromAnchor(a)
  if (entity && handlers?.onOpenEntityMention) {
    handlers.onOpenEntityMention(entity)
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
  getHandlers: () => TipTapLinkClickHandlers | undefined
): {
  click: (view: unknown, event: Event) => boolean
  mousedown: (view: unknown, event: Event) => boolean
  auxclick: (view: unknown, event: Event) => boolean
} {
  const handle = (event: Event): boolean =>
    handleTipTapLinkMouse(event as MouseEvent, getHandlers())

  return {
    click: (_view, event) => handle(event),
    mousedown: (_view, event) => handle(event),
    auxclick: (_view, event) => handle(event)
  }
}
