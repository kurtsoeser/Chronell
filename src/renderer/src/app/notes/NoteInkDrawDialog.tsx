import { useCallback, useMemo, useState } from 'react'
import { Eraser, Highlighter, PenLine, Redo2, Trash2, Undo2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { createNoteInkDocument, isDrawableInkTool, type NoteInkDocument } from '@shared/note-ink-document'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { strokeToSvgRender } from '@/lib/note-ink-export'
import { NoteInkColorPalette } from '@/app/notes/NoteInkColorPalette'
import { cn } from '@/lib/utils'
import { useNoteInkCanvas } from '@/app/notes/use-note-ink-canvas'
import '@/app/notes/note-ink-canvas.css'

export interface NoteInkDrawInsertPayload {
  document: NoteInkDocument
}

export function NoteInkDrawDialog({
  open,
  initialDocument,
  onClose,
  onInsert
}: {
  open: boolean
  initialDocument?: NoteInkDocument | null
  onClose: () => void
  /** Speichert Anhänge und fügt Vorschaubild in den Editor ein. */
  onInsert?: (payload: NoteInkDrawInsertPayload) => void | Promise<void>
}): JSX.Element | null {
  const { t } = useTranslation()
  const [inserting, setInserting] = useState(false)

  const ink = useNoteInkCanvas({ initialDocument })

  const strokeLimits =
    ink.tool === 'highlighter' ? { min: 8, max: 32 } : { min: 2, max: 24 }

  const renderedStrokes = useMemo(() => {
    const all = ink.activeStroke ? [...ink.strokes, ink.activeStroke] : ink.strokes
    return all.filter((stroke) => isDrawableInkTool(stroke.tool) && stroke.points.length > 0)
  }, [ink.activeStroke, ink.strokes])

  const handleInsert = useCallback(async (): Promise<void> => {
    if (!ink.hasDrawableContent || ink.canvasWidth <= 0 || ink.canvasHeight <= 0) return
    setInserting(true)
    try {
      const exportStrokes = ink.getExportStrokes()
      const document = createNoteInkDocument(exportStrokes, ink.canvasWidth, ink.canvasHeight)
      await onInsert?.({ document })
      onClose()
    } finally {
      setInserting(false)
    }
  }, [ink, onClose, onInsert])

  if (!open) return null

  return (
    <ModalRoot open={open} onBackdropClick={inserting ? undefined : onClose} zIndex={300}>
      <ModalPanel
        className="flex h-[min(92vh,900px)] w-[min(96vw,1200px)] max-w-none flex-col overflow-hidden p-0"
        onClick={(e): void => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-ink-draw-title"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id="note-ink-draw-title" className="text-base font-semibold">
            {t('notes.ink.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={inserting}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={t('notes.ink.tool.pen')}
              aria-label={t('notes.ink.tool.pen')}
              aria-pressed={ink.tool === 'pen'}
              onClick={(): void => ink.setTool('pen')}
              className={cn(
                'rounded-md p-2 hover:bg-secondary',
                ink.tool === 'pen' && 'bg-secondary text-primary'
              )}
            >
              <PenLine className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              title={t('notes.ink.tool.highlighter')}
              aria-label={t('notes.ink.tool.highlighter')}
              aria-pressed={ink.tool === 'highlighter'}
              onClick={(): void => ink.setTool('highlighter')}
              className={cn(
                'rounded-md p-2 hover:bg-secondary',
                ink.tool === 'highlighter' && 'bg-secondary text-primary'
              )}
            >
              <Highlighter className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              title={t('notes.ink.tool.eraser')}
              aria-label={t('notes.ink.tool.eraser')}
              aria-pressed={ink.tool === 'eraser'}
              onClick={(): void => ink.setTool('eraser')}
              className={cn(
                'rounded-md p-2 hover:bg-secondary',
                ink.tool === 'eraser' && 'bg-secondary text-primary'
              )}
            >
              <Eraser className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <NoteInkColorPalette
            tool={ink.tool}
            activeColor={ink.color}
            disabled={inserting}
            onColorChange={ink.setColor}
          />

          <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">{t('notes.ink.strokeSize')}</span>
            <input
              type="range"
              min={strokeLimits.min}
              max={strokeLimits.max}
              value={ink.strokeSize}
              onChange={(e): void => ink.setStrokeSize(Number(e.target.value))}
              disabled={ink.tool === 'eraser'}
              className="w-full"
            />
            <span className="w-6 shrink-0 tabular-nums">{ink.strokeSize}</span>
          </label>

          <div className="flex items-center gap-1">
            <button
              type="button"
              title={t('notes.ink.undo')}
              aria-label={t('notes.ink.undo')}
              onClick={ink.undo}
              disabled={!ink.canUndo || inserting}
              className="rounded-md p-2 hover:bg-secondary disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              title={t('notes.ink.redo')}
              aria-label={t('notes.ink.redo')}
              onClick={ink.redo}
              disabled={!ink.canRedo || inserting}
              className="rounded-md p-2 hover:bg-secondary disabled:opacity-40"
            >
              <Redo2 className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              title={t('notes.ink.clear')}
              aria-label={t('notes.ink.clear')}
              onClick={ink.clearAll}
              disabled={!ink.hasDrawableContent || inserting}
              className="rounded-md p-2 hover:bg-secondary disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-4">
          <div
            ref={ink.containerRef}
            className={cn(
              'note-ink-canvas-surface note-ink-canvas-paper relative h-full min-h-[320px] overflow-hidden rounded-md border border-border',
              ink.tool === 'eraser' && 'note-ink-canvas-surface--eraser',
              ink.activeStroke &&
                (ink.tool === 'pen' || ink.tool === 'highlighter') &&
                'note-ink-canvas-surface--drawing'
            )}
            onPointerDown={ink.onPointerDown}
            onPointerMove={ink.onPointerMove}
            onPointerUp={ink.onPointerUp}
            onPointerCancel={ink.onPointerCancel}
          >
            {ink.canvasWidth > 0 && ink.canvasHeight > 0 ? (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${ink.canvasWidth} ${ink.canvasHeight}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {renderedStrokes.map((stroke) => {
                  const rendered = strokeToSvgRender(stroke)
                  if (!rendered) return null
                  return (
                    <path
                      key={stroke.id}
                      d={rendered.d}
                      fill={rendered.fill}
                      fillOpacity={rendered.fillOpacity}
                    />
                  )
                })}
              </svg>
            ) : null}
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={inserting}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={(): void => void handleInsert()}
            disabled={inserting || !ink.hasDrawableContent}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t('notes.ink.insert')}
          </button>
        </footer>
      </ModalPanel>
    </ModalRoot>
  )
}
