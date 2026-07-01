import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Columns2,
  LayoutList,
  PaintBucket,
  Rows2,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  Trash2
} from 'lucide-react'
import type { MailTableDesign } from '@/components/tiptap-mail-table'
import { TIPTAP_HIGHLIGHT_COLORS } from '@/components/tiptap/tiptap-editor-colors'
import { useEditorTableState } from '@/components/tiptap/use-editor-table-state'
import { cn } from '@/lib/utils'

function RibbonSep(): JSX.Element {
  return <span className="mx-0.5 h-6 w-px shrink-0 bg-border/70" aria-hidden />
}

function RibbonBtn({
  label,
  onClick,
  icon: Icon,
  disabled,
  active
}: {
  label: string
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
  active?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex shrink-0 flex-col items-center gap-0.5 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        active && 'bg-secondary/90 text-foreground',
        disabled && 'pointer-events-none opacity-35'
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="max-w-[4.5rem] truncate text-[9px] leading-tight">{label}</span>
    </button>
  )
}

function CellAlignMenu({ editor }: { editor: Editor }): JSX.Element {
  const [open, setOpen] = useState(false)
  const cellAlign = (editor.getAttributes('tableCell').align ??
    editor.getAttributes('tableHeader').align ??
    null) as 'left' | 'center' | 'right' | null

  return (
    <div className="relative">
      <RibbonBtn
        label="Ausrichten"
        icon={AlignLeft}
        active={open}
        onClick={(): void => setOpen(!open)}
      />
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Schließen"
            onClick={(): void => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-50 mb-1 flex gap-0.5 rounded-md border border-border bg-card p-1 shadow-lg">
            {(['left', 'center', 'right'] as const).map((a) => {
              const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
              return (
                <button
                  key={a}
                  type="button"
                  title={a === 'left' ? 'Links' : a === 'center' ? 'Mitte' : 'Rechts'}
                  onClick={(): void => {
                    editor.chain().focus().setCellAttribute('align', a).run()
                    setOpen(false)
                  }}
                  className={cn(
                    'rounded p-1.5 hover:bg-secondary',
                    cellAlign === a && 'bg-secondary text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

function CellShadingMenu({ editor }: { editor: Editor }): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <RibbonBtn
        label="Schattierung"
        icon={PaintBucket}
        active={open}
        onClick={(): void => setOpen(!open)}
      />
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Schließen"
            onClick={(): void => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-50 mb-1 rounded-md border border-border bg-card p-2 shadow-lg">
            <div className="grid grid-cols-6 gap-1">
              {TIPTAP_HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  className="h-5 w-5 rounded border border-border/60 hover:scale-110"
                  style={{ backgroundColor: c.value }}
                  onClick={(): void => {
                    editor.chain().focus().setCellAttribute('backgroundColor', c.value).run()
                    setOpen(false)
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="mt-1.5 w-full rounded px-2 py-1 text-2xs text-muted-foreground hover:bg-secondary"
              onClick={(): void => {
                editor.chain().focus().setCellAttribute('backgroundColor', null).run()
                setOpen(false)
              }}
            >
              Farbe entfernen
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function TableStyleMenu({
  editor,
  design,
  tableAlign
}: {
  editor: Editor
  design: MailTableDesign
  tableAlign: 'left' | 'center' | 'right'
}): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <RibbonBtn label="Tabellen-Stil" icon={Table2} active={open} onClick={(): void => setOpen(!open)} />
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Schließen"
            onClick={(): void => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[160px] rounded-md border border-border bg-card p-2 shadow-lg">
            <div className="mb-1 text-2xs uppercase tracking-wide text-muted-foreground">Rahmen</div>
            <div className="mb-2 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={(): void => {
                  editor.chain().focus().updateAttributes('table', { design: 'bordered' }).run()
                }}
                className={cn(
                  'rounded border px-2 py-0.5 text-2xs',
                  design === 'bordered'
                    ? 'border-primary bg-primary/15'
                    : 'border-border/60 hover:bg-secondary'
                )}
              >
                Mit Rahmen
              </button>
              <button
                type="button"
                onClick={(): void => {
                  editor.chain().focus().updateAttributes('table', { design: 'borderless' }).run()
                }}
                className={cn(
                  'rounded border px-2 py-0.5 text-2xs',
                  design === 'borderless'
                    ? 'border-primary bg-primary/15'
                    : 'border-border/60 hover:bg-secondary'
                )}
              >
                Rahmen aus
              </button>
            </div>
            <div className="mb-1 text-2xs uppercase tracking-wide text-muted-foreground">
              Tabelle ausrichten
            </div>
            <div className="flex flex-wrap gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={(): void => {
                    editor.chain().focus().updateAttributes('table', { tableAlign: a }).run()
                  }}
                  className={cn(
                    'rounded border px-2 py-0.5 text-2xs',
                    tableAlign === a
                      ? 'border-primary bg-primary/15'
                      : 'border-border/60 hover:bg-secondary'
                  )}
                >
                  {a === 'left' ? 'Links' : a === 'center' ? 'Mitte' : 'Rechts'}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export function TableContextToolbar({ editor }: { editor: Editor }): JSX.Element | null {
  const { inTable, canMerge, canSplit, design, tableAlign } = useEditorTableState(editor)

  if (!inTable) return null

  return (
    <div
      className="flex items-center gap-0.5 overflow-x-auto border-t border-border/50 bg-card/95 px-1 py-1"
      role="toolbar"
      aria-label="Tabellenformatierung"
    >
      <RibbonBtn
        label="Tabelle löschen"
        icon={Trash2}
        onClick={(): void => {
          editor.chain().focus().deleteTable().run()
        }}
      />
      <RibbonBtn
        label="Spalten löschen"
        icon={Columns2}
        onClick={(): void => {
          editor.chain().focus().deleteColumn().run()
        }}
      />
      <RibbonBtn
        label="Zeilen löschen"
        icon={Rows2}
        onClick={(): void => {
          editor.chain().focus().deleteRow().run()
        }}
      />

      <RibbonSep />

      <RibbonBtn
        label="Zeile oben"
        icon={ArrowUpToLine}
        onClick={(): void => {
          editor.chain().focus().addRowBefore().run()
        }}
      />
      <RibbonBtn
        label="Zeile unten"
        icon={ArrowDownToLine}
        onClick={(): void => {
          editor.chain().focus().addRowAfter().run()
        }}
      />
      <RibbonBtn
        label="Spalte links"
        icon={Columns2}
        onClick={(): void => {
          editor.chain().focus().addColumnBefore().run()
        }}
      />
      <RibbonBtn
        label="Spalte rechts"
        icon={Columns2}
        onClick={(): void => {
          editor.chain().focus().addColumnAfter().run()
        }}
      />

      <RibbonSep />

      <RibbonBtn
        label="Verbinden"
        icon={TableCellsMerge}
        disabled={!canMerge}
        onClick={(): void => {
          editor.chain().focus().mergeCells().run()
        }}
      />
      <RibbonBtn
        label="Teilen"
        icon={TableCellsSplit}
        disabled={!canSplit}
        onClick={(): void => {
          editor.chain().focus().splitCell().run()
        }}
      />

      <RibbonSep />

      <RibbonBtn
        label="Kopfzeile"
        icon={LayoutList}
        onClick={(): void => {
          editor.chain().focus().toggleHeaderRow().run()
        }}
      />

      <RibbonSep />

      <TableStyleMenu editor={editor} design={design} tableAlign={tableAlign} />
      <CellShadingMenu editor={editor} />
      <CellAlignMenu editor={editor} />
    </div>
  )
}
