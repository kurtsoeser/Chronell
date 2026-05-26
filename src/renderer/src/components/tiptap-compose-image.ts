import Image from '@tiptap/extension-image'

/** Mail-Composer: Bilder mit Ziehpunkten skalierbar (Breite/Höhe werden im HTML gespeichert). */
export const ComposeImage = Image.configure({
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
