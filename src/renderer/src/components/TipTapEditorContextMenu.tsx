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
  Strikethrough,
  Underline as UnderlineIcon
} from 'lucide-react'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'

interface Props {
  editor: Editor
  x: number
  y: number
  onClose: () => void
  /** Auswahl als Textbaustein übernehmen (öffnet Snippet-Dialog). */
  onAdoptAsSnippet?: () => void
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
  onAdoptAsSnippet
}: Props): JSX.Element {
  const { t } = useTranslation()
  const hasSelection = !editor.state.selection.empty

  const items = useMemo((): ContextMenuItem[] => {
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

    return formatItems
  }, [editor, hasSelection, onAdoptAsSnippet, t])

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />
}
