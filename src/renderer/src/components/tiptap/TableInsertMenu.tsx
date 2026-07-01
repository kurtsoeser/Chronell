import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Table2 } from 'lucide-react'
import { TableInsertPicker } from '@/components/tiptap/TableInsertPicker'
import { useEditorTableState } from '@/components/tiptap/use-editor-table-state'
import { cn } from '@/lib/utils'

/** Toolbar-Button mit Dropdown: Raster zum Einfügen per Maus-Drag. */
export function TableInsertMenu({ editor }: { editor: Editor }): JSX.Element {
  const [open, setOpen] = useState(false)
  const { inTable } = useEditorTableState(editor)

  return (
    <div className="relative">
      <button
        type="button"
        title="Tabelle"
        aria-label="Tabelle"
        aria-expanded={open}
        onClick={(): void => setOpen(!open)}
        className={cn(
          'rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          (inTable || open) && 'bg-secondary/80 text-foreground'
        )}
      >
        <Table2 className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Schließen"
            onClick={(): void => setOpen(false)}
          />
          <div className="absolute left-0 top-7 z-40 rounded-md border border-border bg-card p-3 shadow-xl">
            <TableInsertPicker editor={editor} onInserted={(): void => setOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  )
}
