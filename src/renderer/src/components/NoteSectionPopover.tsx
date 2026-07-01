import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, X } from 'lucide-react'
import type { NoteSection } from '@shared/types'
import {
  buildNoteSectionTree,
  flattenSectionTree,
  formatSectionOptionLabel
} from '@/lib/notes-section-tree'
import { cn } from '@/lib/utils'

export interface NoteSectionPopoverProps {
  open: boolean
  anchor: { x: number; y: number }
  noteId: number
  sections: NoteSection[]
  currentSectionId: number | null
  onClose: () => void
  onMoved?: () => void
}

export function NoteSectionPopover({
  open,
  anchor,
  noteId,
  sections,
  currentSectionId,
  onClose,
  onMoved
}: NoteSectionPopoverProps): JSX.Element | null {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sectionEntries = useMemo(() => {
    const tree = buildNoteSectionTree(sections, [])
    return flattenSectionTree(tree.roots)
  }, [sections])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent): void {
      const el = rootRef.current
      if (!el || el.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return (): void => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open, onClose])

  if (!open) return null

  async function selectSection(sectionId: number | null): Promise<void> {
    if ((currentSectionId ?? null) === sectionId) {
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.mailClient.notes.moveToSection({ noteId, sectionId })
      onMoved?.()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'chronell-acrylic-popover fixed z-[200] w-[min(20rem,calc(100vw-1.5rem))] p-3 text-xs',
        'text-popover-foreground'
      )}
      style={{ left: anchor.x, top: anchor.y }}
      role="dialog"
      aria-label={t('notes.onenote.sectionPickerAria')}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{t('notes.sections.moveTo')}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('common.close')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error ? (
        <div className="mb-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-[10px] text-destructive">
          {error}
        </div>
      ) : null}

      {busy ? (
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-0.5">
          <li>
            <button
              type="button"
              onClick={(): void => void selectSection(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                currentSectionId == null
                  ? 'bg-primary/15 text-foreground'
                  : 'hover:bg-secondary/80'
              )}
              aria-pressed={currentSectionId == null}
            >
              <span className="min-w-0 flex-1 truncate">{t('notes.sections.ungrouped')}</span>
              {currentSectionId == null ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              ) : null}
            </button>
          </li>
          {sectionEntries.length === 0 ? (
            <li className="px-2 py-2 text-[10px] text-muted-foreground">
              {t('notes.shell.noSectionsYet')}
            </li>
          ) : (
            sectionEntries.map(({ section, depth }) => {
              const selected = currentSectionId === section.id
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={(): void => void selectSection(section.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                      selected ? 'bg-primary/15 text-foreground' : 'hover:bg-secondary/80'
                    )}
                    aria-pressed={selected}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {formatSectionOptionLabel(section.name, depth)}
                    </span>
                    {selected ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    ) : null}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
