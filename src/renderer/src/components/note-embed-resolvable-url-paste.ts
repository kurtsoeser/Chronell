import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { isResolvableNoteEmbedUrl } from '@shared/note-embed-registry'
import { findNoteEmbedInsertTarget } from '@shared/note-embed-insert'

async function resolveEmbedUrl(input: string): Promise<string | null> {
  try {
    return await window.mailClient.notes.resolveEmbedUrl(input)
  } catch {
    return null
  }
}

/** Löst Kurzlinks (z. B. maps.app.goo.gl) asynchron auf und fügt dann das passende Embed ein. */
export const NoteEmbedResolvableUrlPaste = Extension.create({
  name: 'noteEmbedResolvableUrlPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData('text/plain')?.trim()
            if (!text || !isResolvableNoteEmbedUrl(text)) return false

            event.preventDefault()
            void (async () => {
              const resolved = await resolveEmbedUrl(text)
              if (!resolved) return

              const target = findNoteEmbedInsertTarget(resolved)
              if (!target) return
              const nodeType = view.state.schema.nodes[target.extensionName]
              if (!nodeType) return
              const node = nodeType.create(target.attrs)
              view.dispatch(view.state.tr.replaceSelectionWith(node))
              return
            })()

            return true
          }
        }
      })
    ]
  }
})
