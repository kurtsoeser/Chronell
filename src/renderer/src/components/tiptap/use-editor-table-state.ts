import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { MailTableBorderStyle, MailTableDesign } from '@/components/tiptap-mail-table'

export function tableHasHeaderRow(editor: Editor): boolean {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'table') continue
    const firstRow = node.firstChild
    const firstCell = firstRow?.firstChild
    return firstCell?.type.name === 'tableHeader'
  }
  return false
}

export function useEditorTableState(editor: Editor | null): {
  inTable: boolean
  canMerge: boolean
  canSplit: boolean
  hasHeaderRow: boolean
  design: MailTableDesign
  borderStyle: MailTableBorderStyle
  tableAlign: 'left' | 'center' | 'right'
} {
  const [, bump] = useState(0)

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const update = (): void => bump((n) => n + 1)
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return (): void => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  if (!editor || editor.isDestroyed) {
    return {
      inTable: false,
      canMerge: false,
      canSplit: false,
      hasHeaderRow: false,
      design: 'bordered',
      borderStyle: 'full',
      tableAlign: 'left'
    }
  }

  const tableAttrs = editor.getAttributes('table') as {
    design?: MailTableDesign
    borderStyle?: MailTableBorderStyle | null
    tableAlign?: 'left' | 'center' | 'right'
  }

  return {
    inTable: editor.isActive('table'),
    canMerge: editor.can().mergeCells(),
    canSplit: editor.can().splitCell(),
    hasHeaderRow: tableHasHeaderRow(editor),
    design: tableAttrs.design ?? 'bordered',
    borderStyle: tableAttrs.borderStyle ?? 'full',
    tableAlign: tableAttrs.tableAlign ?? 'left'
  }
}
