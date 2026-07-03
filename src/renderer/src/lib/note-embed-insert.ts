import type { Editor } from '@tiptap/react'
import {
  findNoteEmbedInsertTarget,
  type NoteEmbedInsertTarget
} from '@shared/note-embed-insert'
import { isResolvableNoteEmbedUrl } from '@shared/note-embed-registry'
import { safeTiptapGetHtml } from '@/lib/tiptap-editor-html'

async function resolveEmbedUrl(input: string): Promise<string | null> {
  try {
    return await window.mailClient.notes.resolveEmbedUrl(input)
  } catch {
    return null
  }
}

export async function resolveNoteEmbedInsertTarget(
  url: string
): Promise<NoteEmbedInsertTarget | null> {
  const trimmed = url.trim()
  if (!trimmed) return null

  const direct = findNoteEmbedInsertTarget(trimmed)
  if (direct) return direct

  if (!isResolvableNoteEmbedUrl(trimmed)) return null
  const resolved = await resolveEmbedUrl(trimmed)
  if (!resolved) return null
  return findNoteEmbedInsertTarget(resolved)
}

export function insertNoteEmbedInEditor(
  editor: Editor,
  target: NoteEmbedInsertTarget,
  onChangeHtml?: (html: string) => void
): boolean {
  const nodeType = editor.schema.nodes[target.extensionName]
  if (!nodeType) return false

  editor
    .chain()
    .focus()
    .insertContent({
      type: target.extensionName,
      attrs: target.attrs
    })
    .run()

  if (onChangeHtml) {
    const out = safeTiptapGetHtml(editor)
    if (out !== null) onChangeHtml(out)
  }

  return true
}
