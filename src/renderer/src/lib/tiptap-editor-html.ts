import type { Editor } from '@tiptap/react'

/**
 * Liest Editor-HTML nur wenn der Editor noch vollstaendig initialisiert ist.
 * Waehrend React Strict Mode / destroy() kann `schema` bereits null sein,
 * obwohl die Editor-Referenz noch existiert — dann wuerde getHTML() werfen.
 */
export function safeTiptapGetHtml(editor: Editor | null): string | null {
  if (!editor || editor.isDestroyed) return null
  const schema = (editor as Editor & { schema?: unknown }).schema
  if (!schema) return null
  try {
    return editor.getHTML()
  } catch {
    return null
  }
}
