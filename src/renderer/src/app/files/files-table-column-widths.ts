import { useCallback, useMemo, useState } from 'react'

export type FilesMailTableColumnId = 'name' | 'subject' | 'date' | 'size' | 'type'

const STORAGE_KEY = 'mailclient.filesMailTableColumnWidths.v1'
export const FILES_MAIL_TABLE_ACTIONS_WIDTH_PX = 88

const MIN: Record<FilesMailTableColumnId, number> = {
  name: 120,
  subject: 100,
  date: 96,
  size: 56,
  type: 72
}

const MAX: Record<FilesMailTableColumnId, number> = {
  name: 640,
  subject: 640,
  date: 220,
  size: 120,
  type: 200
}

export const FILES_MAIL_TABLE_DEFAULT_WIDTHS: Record<FilesMailTableColumnId, number> = {
  name: 260,
  subject: 240,
  date: 128,
  size: 72,
  type: 96
}

function clamp(col: FilesMailTableColumnId, n: number): number {
  return Math.min(MAX[col], Math.max(MIN[col], Math.round(n)))
}

function readWidths(): Record<FilesMailTableColumnId, number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...FILES_MAIL_TABLE_DEFAULT_WIDTHS }
    const parsed = JSON.parse(raw) as Partial<Record<FilesMailTableColumnId, number>>
    return {
      name: clamp('name', parsed.name ?? FILES_MAIL_TABLE_DEFAULT_WIDTHS.name),
      subject: clamp('subject', parsed.subject ?? FILES_MAIL_TABLE_DEFAULT_WIDTHS.subject),
      date: clamp('date', parsed.date ?? FILES_MAIL_TABLE_DEFAULT_WIDTHS.date),
      size: clamp('size', parsed.size ?? FILES_MAIL_TABLE_DEFAULT_WIDTHS.size),
      type: clamp('type', parsed.type ?? FILES_MAIL_TABLE_DEFAULT_WIDTHS.type)
    }
  } catch {
    return { ...FILES_MAIL_TABLE_DEFAULT_WIDTHS }
  }
}

function persistWidths(widths: Record<FilesMailTableColumnId, number>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
  } catch {
    // ignore
  }
}

export function buildFilesMailTableGridTemplate(
  widths: Record<FilesMailTableColumnId, number>
): string {
  return `${widths.name}px ${widths.subject}px ${widths.date}px ${widths.size}px ${widths.type}px ${FILES_MAIL_TABLE_ACTIONS_WIDTH_PX}px`
}

export function useFilesMailTableColumnWidths(): {
  gridTemplate: string
  resizeColumn: (column: FilesMailTableColumnId, delta: number) => void
} {
  const [widths, setWidths] = useState(readWidths)

  const resizeColumn = useCallback((column: FilesMailTableColumnId, delta: number) => {
    if (delta === 0) return
    setWidths((prev) => {
      const next = { ...prev, [column]: clamp(column, prev[column] + delta) }
      persistWidths(next)
      return next
    })
  }, [])

  const gridTemplate = useMemo(() => buildFilesMailTableGridTemplate(widths), [widths])

  return { gridTemplate, resizeColumn }
}
