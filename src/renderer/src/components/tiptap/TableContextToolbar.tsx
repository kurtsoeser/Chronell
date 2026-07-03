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
import type { MailTableBorderStyle, MailTableDesign } from '@/components/tiptap-mail-table'
import {
  MAIL_TABLE_BORDER_OPTIONS,
  MAIL_TABLE_PRESETS,
  type MailTablePreset
} from '@/components/mail-table-presets'
import { TIPTAP_HIGHLIGHT_COLORS } from '@/components/tiptap/tiptap-editor-colors'
import { useEditorTableState } from '@/components/tiptap/use-editor-table-state'
import { cn } from '@/lib/utils'

const TABLE_MENU_BACKDROP_CLASS = 'fixed inset-0 z-[90] cursor-default'
const TABLE_MENU_PANEL_CLASS =
  'absolute left-0 top-full z-[100] mt-1 rounded-md border border-border bg-card shadow-lg'

function RibbonSep(): JSX.Element {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border/60" aria-hidden />
}

function TableMenuBackdrop({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className={TABLE_MENU_BACKDROP_CLASS}
      aria-label="Schließen"
      onMouseDown={(e): void => {
        e.preventDefault()
      }}
      onClick={onClose}
    />
  )
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
      onMouseDown={(e): void => {
        e.preventDefault()
      }}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        active && 'bg-secondary text-foreground',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function CellAlignMenu({ editor }: { editor: Editor }): JSX.Element {
  const [open, setOpen] = useState(false)
  const cellAlign = (editor.getAttributes('tableCell').align ??
    editor.getAttributes('tableHeader').align ??
    null) as 'left' | 'center' | 'right' | null

  return (
    <div className={cn('relative', open && 'z-[100]')}>
      <RibbonBtn
        label="Ausrichten"
        icon={AlignLeft}
        active={open}
        onClick={(): void => setOpen(!open)}
      />
      {open ? (
        <>
          <TableMenuBackdrop onClose={(): void => setOpen(false)} />
          <div className={cn(TABLE_MENU_PANEL_CLASS, 'flex gap-0.5 p-1')}>
            {(['left', 'center', 'right'] as const).map((a) => {
              const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
              return (
                <button
                  key={a}
                  type="button"
                  title={a === 'left' ? 'Links' : a === 'center' ? 'Mitte' : 'Rechts'}
                  onMouseDown={(e): void => {
                    e.preventDefault()
                  }}
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
    <div className={cn('relative', open && 'z-[100]')}>
      <RibbonBtn
        label="Schattierung"
        icon={PaintBucket}
        active={open}
        onClick={(): void => setOpen(!open)}
      />
      {open ? (
        <>
          <TableMenuBackdrop onClose={(): void => setOpen(false)} />
          <div className={cn(TABLE_MENU_PANEL_CLASS, 'p-3')}>
            <div className="grid grid-cols-3 gap-2.5">
              {TIPTAP_HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  className="h-7 w-7 rounded-md border border-border/60 transition-transform hover:scale-105 hover:border-border"
                  style={{ backgroundColor: c.value }}
                  onMouseDown={(e): void => {
                    e.preventDefault()
                  }}
                  onClick={(): void => {
                    editor.chain().focus().setCellAttribute('backgroundColor', c.value).run()
                    setOpen(false)
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded px-2 py-1.5 text-2xs text-muted-foreground hover:bg-secondary"
              onMouseDown={(e): void => {
                e.preventDefault()
              }}
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

function TablePresetPreview({ presetId }: { presetId: MailTableDesign }): JSX.Element {
  const bandedRow = presetId === 'banded-rows'
  const bandedCol = presetId === 'banded-columns'
  const headerAccent = presetId === 'header-accent'
  const outline = presetId === 'outline'
  const borderless = presetId === 'borderless'
  const minimal = presetId === 'minimal'
  const shadow = presetId === 'shadow'

  return (
    <div
      className={cn(
        'grid h-8 w-10 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded border border-border/70 bg-card p-px',
        shadow && 'shadow-sm',
        outline && 'border-2 border-foreground/30',
        borderless && 'border-transparent'
      )}
    >
      {Array.from({ length: 4 }, (_, i) => {
        const row = Math.floor(i / 2)
        const col = i % 2
        const isHeader = row === 0
        return (
          <span
            key={i}
            className={cn(
              'block min-h-0 min-w-0',
              !borderless && !outline && !minimal && 'border border-border/50',
              minimal && row > 0 && 'border-t border-border/50',
              isHeader && 'bg-muted/70',
              headerAccent && isHeader && 'bg-sky-500/30',
              bandedRow && !isHeader && row === 1 && 'bg-muted/45',
              bandedCol && col === 1 && 'bg-muted/40'
            )}
          />
        )
      })}
    </div>
  )
}

function applyTablePreset(editor: Editor, preset: MailTablePreset): void {
  const attrs: { design: MailTableDesign; borderStyle: MailTableBorderStyle | null } = {
    design: preset.id,
    borderStyle: preset.id === 'borderless' ? 'none' : null
  }
  editor.chain().focus().updateAttributes('table', attrs).run()
}

function applyTableBorderStyle(editor: Editor, borderStyle: MailTableBorderStyle): void {
  editor
    .chain()
    .focus()
    .updateAttributes('table', {
      borderStyle: borderStyle === 'full' ? null : borderStyle
    })
    .run()
}

function TableStyleMenu({
  editor,
  design,
  borderStyle,
  tableAlign
}: {
  editor: Editor
  design: MailTableDesign
  borderStyle: MailTableBorderStyle
  tableAlign: 'left' | 'center' | 'right'
}): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('relative', open && 'z-[100]')}>
      <RibbonBtn label="Tabellen-Stil" icon={Table2} active={open} onClick={(): void => setOpen(!open)} />
      {open ? (
        <>
          <TableMenuBackdrop onClose={(): void => setOpen(false)} />
          <div className={cn(TABLE_MENU_PANEL_CLASS, 'w-[280px] p-2')}>
            <div className="mb-1.5 text-2xs uppercase tracking-wide text-muted-foreground">Vorlagen</div>
            <div className="mb-3 grid grid-cols-4 gap-1">
              {MAIL_TABLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.description}
                  onMouseDown={(e): void => {
                    e.preventDefault()
                  }}
                  onClick={(): void => {
                    applyTablePreset(editor, preset)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded border border-transparent px-1 py-1.5 hover:bg-secondary',
                    design === preset.id && 'border-primary/60 bg-primary/10'
                  )}
                >
                  <TablePresetPreview presetId={preset.id} />
                  <span className="max-w-full truncate text-[9px] leading-tight text-muted-foreground">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-1.5 text-2xs uppercase tracking-wide text-muted-foreground">Rahmenlinien</div>
            <div className="mb-3 flex flex-wrap gap-1">
              {MAIL_TABLE_BORDER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onMouseDown={(e): void => {
                    e.preventDefault()
                  }}
                  onClick={(): void => {
                    applyTableBorderStyle(editor, option.id)
                  }}
                  className={cn(
                    'rounded border px-2 py-0.5 text-2xs',
                    borderStyle === option.id
                      ? 'border-primary bg-primary/15'
                      : 'border-border/60 hover:bg-secondary'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mb-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
              Tabelle ausrichten
            </div>
            <div className="flex flex-wrap gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onMouseDown={(e): void => {
                    e.preventDefault()
                  }}
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

export function TableContextToolbar({
  editor,
  inEditorSurface = false
}: {
  editor: Editor
  inEditorSurface?: boolean
}): JSX.Element | null {
  const { inTable, canMerge, canSplit, hasHeaderRow, design, borderStyle, tableAlign } =
    useEditorTableState(editor)

  if (!inTable) return null

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-0.5 overflow-visible border-t px-2 py-1',
        inEditorSurface
          ? 'compose-editor-toolbar-zone border-[hsl(var(--compose-surface-border)/0.5)]'
          : 'border-border/50 bg-secondary/30'
      )}
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
        active={hasHeaderRow}
        onClick={(): void => {
          editor.chain().focus().toggleHeaderRow().run()
        }}
      />

      <RibbonSep />

      <TableStyleMenu editor={editor} design={design} borderStyle={borderStyle} tableAlign={tableAlign} />
      <CellShadingMenu editor={editor} />
      <CellAlignMenu editor={editor} />
    </div>
  )
}
