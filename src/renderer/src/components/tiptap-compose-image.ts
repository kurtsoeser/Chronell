import Image from '@tiptap/extension-image'
import { NOTE_INK_HTML_SOURCE_ATTR } from '@shared/note-ink-document'

/** Mail-Composer: Bilder mit Ziehpunkten skalierbar (Breite/Höhe werden im HTML gespeichert). */
export const ComposeImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      inkSourceAttachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute(NOTE_INK_HTML_SOURCE_ATTR),
        renderHTML: (attributes) => {
          if (attributes.inkSourceAttachmentId == null || attributes.inkSourceAttachmentId === '') {
            return {}
          }
          return { [NOTE_INK_HTML_SOURCE_ATTR]: String(attributes.inkSourceAttachmentId) }
        }
      }
    }
  }
}).configure({
  inline: false,
  allowBase64: true,
  HTMLAttributes: {
    class: 'mail-compose-image',
    style: 'max-width:100%;height:auto;'
  },
  resize: {
    enabled: true,
    directions: ['bottom-left', 'bottom-right', 'top-left', 'top-right'],
    minWidth: 48,
    minHeight: 48,
    alwaysPreserveAspectRatio: true
  }
})
