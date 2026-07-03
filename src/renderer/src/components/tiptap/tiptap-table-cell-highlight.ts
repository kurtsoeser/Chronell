import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { mailTableDomClassList } from '@/components/tiptap-mail-table'

const TABLE_CELL_HIGHLIGHT_KEY = new PluginKey('mailTableCellHighlight')
const TABLE_DOM_SYNC_KEY = new PluginKey('mailTableDomSync')

const CELL_HIGHLIGHT_CLASS = 'mail-tbl-cell-active'

type CellSelectionLike = {
  forEachCell: (fn: (node: PMNode, pos: number) => void) => void
}

function isCellSelection(selection: unknown): selection is CellSelectionLike {
  return (
    !!selection &&
    typeof selection === 'object' &&
    'forEachCell' in selection &&
    typeof (selection as CellSelectionLike).forEachCell === 'function'
  )
}

function tableCellDecorationRange($from: {
  depth: number
  node: (depth: number) => PMNode
  before: (depth: number) => number
  after: (depth: number) => number
}): { from: number; to: number } | null {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      return { from: $from.before(depth), to: $from.after(depth) }
    }
  }
  return null
}

function tableCellDecorations(doc: PMNode, selection: unknown): DecorationSet {
  const decorations: Decoration[] = []

  if (isCellSelection(selection)) {
    selection.forEachCell((node, pos) => {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { class: CELL_HIGHLIGHT_CLASS })
      )
    })
    return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty
  }

  if (!selection || typeof selection !== 'object' || !('$from' in selection)) {
    return DecorationSet.empty
  }

  const range = tableCellDecorationRange(
    (selection as { $from: Parameters<typeof tableCellDecorationRange>[0] }).$from
  )
  if (!range) return DecorationSet.empty

  decorations.push(
    Decoration.node(range.from, range.to, { class: CELL_HIGHLIGHT_CLASS })
  )
  return DecorationSet.create(doc, decorations)
}

export function syncMailTableElement(
  table: HTMLTableElement,
  attrs: Record<string, unknown>
): void {
  table.className = mailTableDomClassList({
    design: attrs.design as Parameters<typeof mailTableDomClassList>[0]['design'],
    borderStyle: attrs.borderStyle as Parameters<typeof mailTableDomClassList>[0]['borderStyle']
  }).join(' ')

  const align = attrs.tableAlign as 'left' | 'center' | 'right' | undefined
  if (align === 'center' || align === 'right') {
    table.setAttribute('align', align)
  } else {
    table.removeAttribute('align')
  }
}

function resolveTableElement(nodeDom: HTMLElement): HTMLTableElement | null {
  if (nodeDom.classList.contains('tableWrapper')) {
    return nodeDom.querySelector('table')
  }
  if (nodeDom instanceof HTMLTableElement) {
    return nodeDom
  }
  return nodeDom.querySelector('table')
}

function syncAllMailTableDom(view: EditorView): void {
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return
    const nodeDom = view.nodeDOM(pos)
    if (!(nodeDom instanceof HTMLElement)) return false
    const table = resolveTableElement(nodeDom)
    if (table) syncMailTableElement(table, node.attrs as Record<string, unknown>)
    return false
  })
}

const cellHighlightPlugin = new Plugin({
  key: TABLE_CELL_HIGHLIGHT_KEY,
  props: {
    decorations(state) {
      return tableCellDecorations(state.doc, state.selection)
    }
  }
})

const tableDomSyncPlugin = new Plugin({
  key: TABLE_DOM_SYNC_KEY,
  view(view) {
    const sync = (): void => {
      syncAllMailTableDom(view)
    }
    sync()
    return { update: sync }
  }
})

/** Zellauswahl hervorheben + Tabellenklassen im Live-Editor mit Attributen synchronisieren. */
export const TableCellHighlight = Extension.create({
  name: 'tableCellHighlight',

  addProseMirrorPlugins() {
    return [cellHighlightPlugin, tableDomSyncPlugin]
  }
})
