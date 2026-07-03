import { Table } from '@tiptap/extension-table/table'
import { TableCell } from '@tiptap/extension-table/cell'
import { TableHeader } from '@tiptap/extension-table/header'

export type MailTableDesign =
  | 'bordered'
  | 'borderless'
  | 'minimal'
  | 'shadow'
  | 'banded-rows'
  | 'banded-columns'
  | 'header-accent'
  | 'outline'

export type MailTableBorderStyle = 'full' | 'outer' | 'horizontal' | 'none' | 'dashed'

const MAIL_TABLE_DESIGN_CLASS_RE = /^mail-tbl-([\w-]+)$/

function parseCellBg(el: HTMLElement): string | null {
  const fromStyle = (el.style.backgroundColor || '').trim()
  if (
    fromStyle &&
    fromStyle !== 'transparent' &&
    fromStyle !== 'rgba(0, 0, 0, 0)' &&
    fromStyle !== 'rgba(0,0,0,0)'
  ) {
    return fromStyle
  }
  const bg = el.getAttribute('bgcolor')
  return bg && bg.trim() ? bg.trim() : null
}

function parseTableDesign(el: HTMLElement): MailTableDesign {
  for (const cls of el.classList) {
    const match = MAIL_TABLE_DESIGN_CLASS_RE.exec(cls)
    if (!match?.[1] || match[1].startsWith('lines')) continue
    const design = match[1] as MailTableDesign
    if (
      design === 'bordered' ||
      design === 'borderless' ||
      design === 'minimal' ||
      design === 'shadow' ||
      design === 'banded-rows' ||
      design === 'banded-columns' ||
      design === 'header-accent' ||
      design === 'outline'
    ) {
      return design
    }
  }
  return 'bordered'
}

function parseTableBorderStyle(el: HTMLElement): MailTableBorderStyle | null {
  for (const cls of el.classList) {
    if (cls === 'mail-tbl-lines-full') return 'full'
    if (cls === 'mail-tbl-lines-outer') return 'outer'
    if (cls === 'mail-tbl-lines-horizontal') return 'horizontal'
    if (cls === 'mail-tbl-lines-none') return 'none'
    if (cls === 'mail-tbl-lines-dashed') return 'dashed'
  }
  return null
}

function parseTableAlign(el: HTMLElement): 'left' | 'center' | 'right' {
  const a = (el.getAttribute('align') || '').trim().toLowerCase()
  if (a === 'center' || a === 'middle') return 'center'
  if (a === 'right') return 'right'
  const st = (el.style.marginLeft || '').trim()
  if (st === 'auto' && (el.style.marginRight || '').trim() === 'auto') return 'center'
  return 'left'
}

export function mailTableDomClassList(attrs: {
  design?: MailTableDesign
  borderStyle?: MailTableBorderStyle | null
}): string[] {
  const design = attrs.design ?? 'bordered'
  const classes = ['mail-compose-table', `mail-tbl-${design}`]
  if (attrs.borderStyle && attrs.borderStyle !== 'full') {
    classes.push(`mail-tbl-lines-${attrs.borderStyle}`)
  }
  return classes
}

const cellAlignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => {
    const a = element.getAttribute('align')?.trim().toLowerCase()
    if (a === 'center' || a === 'middle') return 'center'
    if (a === 'right') return 'right'
    if (a === 'left') return 'left'
    return null
  },
  renderHTML: (attributes: Record<string, unknown>) => {
    const a = attributes.align as 'left' | 'center' | 'right' | null | undefined
    if (!a || a === 'left') return {}
    return { align: a }
  }
}

const cellBackgroundAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => parseCellBg(element),
  renderHTML: (attributes: Record<string, unknown>) => {
    if (!attributes.backgroundColor) return {}
    return { bgcolor: attributes.backgroundColor }
  }
}

export const MailTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: cellAlignAttribute,
      backgroundColor: cellBackgroundAttribute
    }
  }
})

export const MailTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: cellAlignAttribute,
      backgroundColor: cellBackgroundAttribute
    }
  }
})

export const MailTable = Table.extend({
  addAttributes() {
    return {
      design: {
        default: 'bordered' as MailTableDesign,
        parseHTML: (element) => parseTableDesign(element as HTMLElement),
        renderHTML: (attributes) => {
          const design = (attributes.design ?? 'bordered') as MailTableDesign
          return { class: `mail-compose-table mail-tbl-${design}` }
        }
      },
      borderStyle: {
        default: null as MailTableBorderStyle | null,
        parseHTML: (element) => parseTableBorderStyle(element as HTMLElement),
        renderHTML: (attributes) => {
          const borderStyle = attributes.borderStyle as MailTableBorderStyle | null | undefined
          if (!borderStyle || borderStyle === 'full') return {}
          return { class: `mail-tbl-lines-${borderStyle}` }
        }
      },
      tableAlign: {
        default: 'left' as const,
        parseHTML: (element) => parseTableAlign(element as HTMLElement),
        renderHTML: (attributes) => {
          const a = attributes.tableAlign as 'left' | 'center' | 'right'
          if (!a || a === 'left') return {}
          return { align: a }
        }
      }
    }
  }
})
