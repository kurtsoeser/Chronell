import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showAppPrompt } from '@/stores/app-dialog'

const GRID_MAX = 8

export function TableInsertPicker({
  editor,
  onInserted
}: {
  editor: Editor
  onInserted?: () => void
}): JSX.Element {
  const [hover, setHover] = useState({ rows: 0, cols: 0 })
  const [withHeaderRow, setWithHeaderRow] = useState(true)
  const [dragging, setDragging] = useState(false)

  const insert = useCallback(
    (rows: number, cols: number): void => {
      if (rows < 1 || cols < 1) return
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow }).run()
      setHover({ rows: 0, cols: 0 })
      onInserted?.()
    },
    [editor, onInserted, withHeaderRow]
  )

  useEffect(() => {
    if (!dragging) return
    const stop = (): void => {
      if (hover.rows > 0 && hover.cols > 0) {
        insert(hover.rows, hover.cols)
      }
      setDragging(false)
      setHover({ rows: 0, cols: 0 })
    }
    window.addEventListener('mouseup', stop)
    return (): void => window.removeEventListener('mouseup', stop)
  }, [dragging, hover.cols, hover.rows, insert])

  const pickCell = (row: number, col: number): void => {
    setHover({ rows: row, cols: col })
    if (dragging) return
  }

  const label =
    hover.rows > 0 && hover.cols > 0
      ? `${hover.cols}×${hover.rows} Tabelle`
      : 'Größe wählen'

  async function insertCustom(): Promise<void> {
    const raw = await showAppPrompt('Zeilen × Spalten (z. B. 4×3)', {
      title: 'Tabelle einfügen',
      defaultValue: hover.rows > 0 ? `${hover.cols}×${hover.rows}` : '3×3',
      placeholder: 'Spalten×Zeilen'
    })
    if (raw === null) return
    const match = raw.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i)
    if (!match) return
    const cols = Math.min(GRID_MAX, Math.max(1, Number.parseInt(match[1]!, 10)))
    const rows = Math.min(GRID_MAX, Math.max(1, Number.parseInt(match[2]!, 10)))
    insert(rows, cols)
  }

  return (
    <div className="w-[220px]">
      <div className="mb-2 text-sm font-semibold text-foreground">{label}</div>
      <div
        className="inline-grid gap-0.5 rounded border border-border/50 bg-muted/20 p-1.5"
        style={{ gridTemplateColumns: `repeat(${GRID_MAX}, 1fr)` }}
        onMouseLeave={(): void => {
          if (!dragging) setHover({ rows: 0, cols: 0 })
        }}
        onMouseDown={(): void => setDragging(true)}
      >
        {Array.from({ length: GRID_MAX * GRID_MAX }, (_, i) => {
          const row = Math.floor(i / GRID_MAX) + 1
          const col = (i % GRID_MAX) + 1
          const selected = row <= hover.rows && col <= hover.cols
          return (
            <button
              key={i}
              type="button"
              aria-label={`${col}×${row}`}
              className={cn(
                'h-[14px] w-[14px] rounded-[2px] border transition-colors',
                selected
                  ? 'border-primary bg-primary/80'
                  : 'border-border/70 bg-card hover:border-primary/50 hover:bg-primary/15'
              )}
              onMouseEnter={(): void => pickCell(row, col)}
              onMouseDown={(e): void => {
                e.preventDefault()
                setDragging(true)
                pickCell(row, col)
              }}
            />
          )
        })}
      </div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={withHeaderRow}
          onChange={(e): void => setWithHeaderRow(e.target.checked)}
          className="rounded border-border"
        />
        Erste Zeile als Kopfzeile
      </label>
      <button
        type="button"
        className="mt-2 flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        onClick={(): void => void insertCustom()}
      >
        <Table2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          Tabelle einfügen…
        </span>
      </button>
    </div>
  )
}
