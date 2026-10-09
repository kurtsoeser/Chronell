import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { ResolvedPos } from '@tiptap/pm/model'
import { pickConservativeAutoCorrect } from '@shared/compose-hunspell-autocorrect'
import {
  getComposeAutoCorrectBlocklist,
  isComposeAutoCorrectEnabled,
  setLastComposeAutoCorrect
} from '@/lib/compose-autocorrect-runtime'

function wordRangeBeforeCursor($from: ResolvedPos): { from: number; to: number; word: string } | null {
  if (!$from.parent.isTextblock) return null
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
  const match = /([\p{L}][\p{L}'-]*)$/u.exec(text)
  if (!match) return null
  const word = match[1]
  const from = $from.pos - word.length
  return { from, to: $from.pos, word }
}

function insertSpaceAt(view: import('@tiptap/pm/view').EditorView, pos: number): void {
  const tr = view.state.tr.insertText(' ', pos, pos)
  view.dispatch(tr)
}

function replaceWordWithText(
  view: import('@tiptap/pm/view').EditorView,
  from: number,
  to: number,
  text: string
): void {
  const tr = view.state.tr.insertText(text, from, to)
  view.dispatch(tr)
}

export const ComposeAutoCorrectExtension = Extension.create({
  name: 'composeAutoCorrect',
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            if (event.key !== ' ' || event.ctrlKey || event.altKey || event.metaKey) return false
            if (!isComposeAutoCorrectEnabled()) return false
            if (!view.state.selection.empty) return false

            const range = wordRangeBeforeCursor(view.state.selection.$from)
            if (!range) return false

            event.preventDefault()

            void (async (): Promise<void> => {
              const suggest = window.mailClient?.spellcheck?.suggest
              if (typeof suggest !== 'function') {
                insertSpaceAt(view, range.to)
                return
              }
              try {
                const res = await suggest({ word: range.word })
                const correction = pickConservativeAutoCorrect(
                  range.word,
                  res.suggestions,
                  getComposeAutoCorrectBlocklist()
                )
                if (!correction) {
                  setLastComposeAutoCorrect(null)
                  insertSpaceAt(view, range.to)
                  return
                }
                setLastComposeAutoCorrect({ from: range.word, to: correction })
                replaceWordWithText(view, range.from, range.to, `${correction} `)
              } catch {
                insertSpaceAt(view, range.to)
              }
            })()

            return true
          }
        }
      })
    ]
  }
})
