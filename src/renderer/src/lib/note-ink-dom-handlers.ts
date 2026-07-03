import { NOTE_INK_HTML_SOURCE_ATTR } from '@shared/note-ink-document'

export function inkAttachmentIdFromEventTarget(target: EventTarget | null): number | null {
  if (!target || typeof target !== 'object') return null
  const element = target as HTMLElement
  if (typeof element.closest !== 'function') return null
  const img = element.closest('img')
  if (!img || typeof img.getAttribute !== 'function') return null
  const raw = img.getAttribute(NOTE_INK_HTML_SOURCE_ATTR)
  if (!raw) return null
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

export function createNoteInkDomEventHandlers(
  getOnInkEdit: () => ((attachmentId: number) => void) | undefined
): {
  dblclick: (view: unknown, event: Event) => boolean
} {
  return {
    dblclick: (_view, event): boolean => {
      const handler = getOnInkEdit()
      if (!handler) return false
      const attachmentId = inkAttachmentIdFromEventTarget(event.target)
      if (attachmentId == null) return false
      handler(attachmentId)
      event.preventDefault()
      return true
    }
  }
}
