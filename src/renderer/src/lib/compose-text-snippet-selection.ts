import type { Editor } from '@tiptap/react'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import {
  loadCustomComposeTextSnippets,
  saveCustomComposeTextSnippets,
  textToComposeSnippetHtml,
  upsertCustomComposeTextSnippet
} from '@/lib/compose-text-snippets'
import { showAppAlert, showAppPrompt } from '@/stores/app-dialog'

/** Markierten Editor-Inhalt als Snippet-HTML (oder null bei leerer Auswahl). */
export function getEditorSelectionSnippetHtml(editor: Editor): string | null {
  const { from, to } = editor.state.selection
  if (from === to) return null
  const slice = editor.state.doc.slice(from, to)
  try {
    const { dom } = editor.view.serializeForClipboard(slice)
    const el = document.createElement('div')
    el.appendChild(dom.cloneNode(true))
    const html = sanitizeComposeHtmlFragment(el.innerHTML)
    return html.trim() ? html : null
  } catch {
    const plain = editor.state.doc.textBetween(from, to, '\n').trim()
    if (!plain) return null
    return textToComposeSnippetHtml(plain)
  }
}

export function snippetHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** Schnellweg: Auswahl speichern (Name-Prompt). */
export async function promptSaveSelectionAsComposeSnippet(editor: Editor): Promise<boolean> {
  const selectedHtml = getEditorSelectionSnippetHtml(editor)
  if (!selectedHtml) {
    void showAppAlert('Bitte zuerst Text im Editor markieren.', { title: 'Textbaustein' })
    return false
  }
  const name = await showAppPrompt('Name des Textbausteins:', {
    title: 'Auswahl speichern',
    defaultValue: 'Mein Baustein',
    placeholder: 'z. B. Standard-Antwort'
  })
  if (name === null) return false
  const trimmed = name.trim()
  if (!trimmed) return false
  const custom = loadCustomComposeTextSnippets()
  const next = upsertCustomComposeTextSnippet(custom, {
    name: trimmed,
    html: selectedHtml
  })
  saveCustomComposeTextSnippets(next)
  return true
}
