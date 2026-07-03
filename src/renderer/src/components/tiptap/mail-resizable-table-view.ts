import { TableView } from '@tiptap/pm/tables'
import type { Node as PMNode } from '@tiptap/pm/model'
import { syncMailTableElement } from '@/components/tiptap/tiptap-table-cell-highlight'

/** Resizable table node view with mail-compose CSS classes on the live <table>. */
export class MailResizableTableView extends TableView {
  constructor(node: PMNode, defaultCellMinWidth: number) {
    super(node, defaultCellMinWidth)
    syncMailTableElement(this.table, node.attrs as Record<string, unknown>)
  }

  update(node: PMNode): boolean {
    if (!super.update(node)) return false
    syncMailTableElement(this.table, node.attrs as Record<string, unknown>)
    return true
  }
}
