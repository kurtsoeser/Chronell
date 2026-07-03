import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

/** Beendet den Embed-Interaktionsmodus mit Escape. */
export const NoteEmbedInteractiveEscape = Extension.create({
  name: 'noteEmbedInteractiveEscape',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: (_view, event) => {
            if (event.key !== 'Escape') return false
            const active = document.querySelector('.note-embed-resizable.note-embed--interactive')
            if (!active) return false
            active.classList.remove('note-embed--interactive')
            return true
          }
        }
      })
    ]
  }
})
