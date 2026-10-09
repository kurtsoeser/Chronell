import { useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import {
  Bold,
  ClipboardPaste,
  Copy,
  FileText,
  Italic,
  Scissors,
  SpellCheck,
  Strikethrough,
  Underline as UnderlineIcon
} from 'lucide-react'
import { getLastComposeAutoCorrect } from '@/lib/compose-autocorrect-runtime'
import { wordAtEditorSelection } from '@/lib/tiptap-editor-word-selection'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'

interface Props {
  editor: Editor
  x: number
  y: number
  onClose: () => void
  /** Chromium-Rechtschreibvorschläge (Rechtsklick auf rot markiertes Wort). */
  spelling?: { misspelledWord: string; suggestions: string[] } | null
  /** Auswahl als Textbaustein übernehmen (öffnet Snippet-Dialog). */
  onAdoptAsSnippet?: () => void
  /** Wort zur Autokorrektur-Ausnahmeliste (Compose-Editor). */
  onAddToAutoCorrectBlocklist?: (word: string) => void
}

function runClipboardCommand(editor: Editor, command: 'cut' | 'copy' | 'paste'): void {
  editor.view.focus()
  try {
    document.execCommand(command)
  } catch {
    // Electron / Browser ohne execCommand-Support
  }
}

export function TipTapEditorContextMenu({
  editor,
  x,
  y,
  onClose,
  onAdoptAsSnippet,
  onAddToAutoCorrectBlocklist,
  spelling
}: Props): JSX.Element {
  const { t } = useTranslation()
  const hasSelection = !editor.state.selection.empty

  const items = useMemo((): ContextMenuItem[] => {
    const spellingItems: ContextMenuItem[] = []
    if (spelling && spelling.suggestions.length > 0) {
      spellingItems.push({
        id: 'spell-label',
        label: t('editorContextMenu.spellingHeading', { word: spelling.misspelledWord }),
        disabled: true
      })
      for (const [index, suggestion] of spelling.suggestions.slice(0, 8)) {
        spellingItems.push({
          id: `spell-suggestion-${index}`,
          label: suggestion,
          icon: SpellCheck,
          onSelect: (): void => {
            editor.view.focus()
            const replace = window.mailClient?.spellcheck?.replaceMisspelling
            if (typeof replace === 'function') {
              void replace({ suggestion })
            }
          }
        })
      }
      spellingItems.push({
        id: 'spell-add-dictionary',
        label: t('editorContextMenu.addToSpellingDictionary', { word: spelling.misspelledWord }),
        onSelect: (): void => {
          editor.view.focus()
          const add = window.mailClient?.spellcheck?.addWordToDictionary
          if (typeof add === 'function') {
            void add({ word: spelling.misspelledWord })
          }
        }
      })
      spellingItems.push({ id: 'sep-spell', label: '', separator: true })
    }

    const formatItems: ContextMenuItem[] = [
      {
        id: 'bold',
        label: t('editorContextMenu.bold'),
        icon: Bold,
        selected: editor.isActive('bold'),
        onSelect: (): void => {
          editor.chain().focus().toggleBold().run()
        }
      },
      {
        id: 'italic',
        label: t('editorContextMenu.italic'),
        icon: Italic,
        selected: editor.isActive('italic'),
        onSelect: (): void => {
          editor.chain().focus().toggleItalic().run()
        }
      },
      {
        id: 'underline',
        label: t('editorContextMenu.underline'),
        icon: UnderlineIcon,
        selected: editor.isActive('underline'),
        onSelect: (): void => {
          editor.chain().focus().toggleUnderline().run()
        }
      },
      {
        id: 'strike',
        label: t('editorContextMenu.strikethrough'),
        icon: Strikethrough,
        selected: editor.isActive('strike'),
        onSelect: (): void => {
          editor.chain().focus().toggleStrike().run()
        }
      },
      { id: 'sep-format', label: '', separator: true },
      {
        id: 'cut',
        label: t('editorContextMenu.cut'),
        icon: Scissors,
        disabled: !hasSelection,
        onSelect: (): void => runClipboardCommand(editor, 'cut')
      },
      {
        id: 'copy',
        label: t('common.copy'),
        icon: Copy,
        disabled: !hasSelection,
        onSelect: (): void => runClipboardCommand(editor, 'copy')
      },
      {
        id: 'paste',
        label: t('editorContextMenu.paste'),
        icon: ClipboardPaste,
        onSelect: (): void => runClipboardCommand(editor, 'paste')
      },
      {
        id: 'select-all',
        label: t('editorContextMenu.selectAll'),
        onSelect: (): void => {
          editor.chain().focus().selectAll().run()
        }
      }
    ]

    if (onAdoptAsSnippet) {
      formatItems.push(
        { id: 'sep-snippet', label: '', separator: true },
        {
          id: 'adopt-snippet',
          label: t('editorContextMenu.adoptAsSnippet'),
          icon: FileText,
          disabled: !hasSelection,
          onSelect: onAdoptAsSnippet
        }
      )
    }

    if (onAddToAutoCorrectBlocklist) {
      const word = wordAtEditorSelection(editor)
      const last = getLastComposeAutoCorrect()
      const blockOriginal =
        last &&
        word &&
        word.toLowerCase() === last.to.toLowerCase() &&
        last.from.toLowerCase() !== last.to.toLowerCase()
          ? last.from
          : null
      const blockTarget = blockOriginal ?? word
      if (blockTarget) {
        formatItems.push(
          { id: 'sep-autocorrect', label: '', separator: true },
          {
            id: 'autocorrect-blocklist',
            label: blockOriginal
              ? t('editorContextMenu.autoCorrectBlocklistTypo', { word: blockOriginal })
              : t('editorContextMenu.autoCorrectBlocklistWord', { word: blockTarget }),
            icon: SpellCheck,
            onSelect: (): void => onAddToAutoCorrectBlocklist(blockTarget)
          }
        )
      }
    }

    return [...spellingItems, ...formatItems]
  }, [editor, hasSelection, onAdoptAsSnippet, onAddToAutoCorrectBlocklist, spelling, t])

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />
}
