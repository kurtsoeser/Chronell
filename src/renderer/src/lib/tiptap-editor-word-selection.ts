import type { Editor } from '@tiptap/react'

const SINGLE_WORD_RE = /^[\p{L}][\p{L}'-]*$/u

/** Ein einzelnes Wort aus der Markierung oder am Cursor (Compose-Autokorrektur-Blockliste). */
export function wordAtEditorSelection(editor: Editor): string | null {
  const { from, to, empty } = editor.state.selection
  if (!empty) {
    const text = editor.state.doc.textBetween(from, to, ' ').trim()
    if (!text || !SINGLE_WORD_RE.test(text)) return null
    return text
  }
  const $from = editor.state.selection.$from
  if (!$from.parent.isTextblock) return null
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
  const after = $from.parent.textBetween($from.parentOffset, $from.parent.content.size, undefined, '\ufffc')
  const left = /[\p{L}'-]*$/u.exec(before)?.[0] ?? ''
  const right = /^[\p{L}'-]*/u.exec(after)?.[0] ?? ''
  const word = `${left}${right}`
  if (!word || !SINGLE_WORD_RE.test(word)) return null
  return word
}
