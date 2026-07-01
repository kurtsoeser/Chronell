import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { MailTableDesign } from '@/components/tiptap-mail-table'

export function useEditorTableState(editor: Editor | null): {
  inTable: boolean
  canMerge: boolean
  canSplit: boolean
  design: MailTableDesign
  tableAlign: 'left' | 'center' | 'right'
} {
  const [, bump] = useState(0)

  useEffect(() => {
    if (!editor) return
    const update = (): void => bump((n) => n + 1)
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return (): void => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  if (!editor) {
    return {
      inTable: false,
      canMerge: false,
      canSplit: false,
      design: 'bordered',
      tableAlign: 'left'
    }
  }

  const tableAttrs = editor.getAttributes('table') as {
    design?: MailTableDesign
    tableAlign?: 'left' | 'center' | 'right'
  }

  return {
    inTable: editor.isActive('table'),
    canMerge: editor.can().mergeCells(),
    canSplit: editor.can().splitCell(),
    design: tableAttrs.design ?? 'bordered',
    tableAlign: tableAttrs.tableAlign ?? 'left'
  }
}
