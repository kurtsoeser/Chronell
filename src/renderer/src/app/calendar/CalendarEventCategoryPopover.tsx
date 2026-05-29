import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Plus, Tag, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MailMasterCategory } from '@shared/types'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'
import { cn } from '@/lib/utils'

export interface CalendarEventCategoryPopoverProps {
  categoryNames: string[]
  selected: string[]
  categoryColorByName: Map<string, string>
  mastersLoading: boolean
  disabled?: boolean
  onToggle: (name: string) => void
}

export function CalendarEventCategoryPopover({
  categoryNames,
  selected,
  categoryColorByName,
  mastersLoading,
  disabled,
  onToggle
}: CalendarEventCategoryPopoverProps): JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const update = (): void => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(360, window.innerWidth - 16)
      let left = r.left
      if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width
      if (left < 8) left = 8
      setPos({ top: r.bottom + 4, left, width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return (): void => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const openPicker = (): void => {
    if (disabled) return
    setOpen((o) => !o)
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-14 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('calendar.eventDialog.categories')}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto',
            '[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1'
          )}
        >
          {selected.length === 0 ? (
            <button
              ref={anchorRef}
              type="button"
              disabled={disabled}
              aria-label={t('calendar.eventDialog.categoriesPickerAria')}
              aria-expanded={open}
              onClick={openPicker}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-border/80 bg-secondary/15 px-2 py-1 text-xs text-muted-foreground transition-colors',
                'hover:border-border hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                open && 'border-primary/40 bg-primary/10 text-foreground'
              )}
            >
              {mastersLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span>{t('calendar.eventDialog.categoriesAdd')}</span>
            </button>
          ) : (
            selected.map((name) => {
              const dotClass = outlookCategoryDotClass(categoryColorByName.get(name))
              return (
                <span
                  key={name}
                  className="inline-flex max-w-[11rem] shrink-0 items-center gap-1 rounded-full border border-border/70 bg-secondary/25 py-0.5 pl-1.5 pr-1 text-xs text-foreground"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />
                  <span className="truncate" title={name}>
                    {name}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={t('calendar.eventDialog.categoryRemoveAria', { name })}
                    onClick={(): void => onToggle(name)}
                    className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground disabled:opacity-50"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              )
            })
          )}
        </div>

        {selected.length > 0 ? (
          <button
            ref={anchorRef}
            type="button"
            disabled={disabled}
            title={t('calendar.eventDialog.categoriesPickerAria')}
            aria-label={t('calendar.eventDialog.categoriesPickerAria')}
            aria-expanded={open}
            onClick={openPicker}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-secondary/20 px-2 text-xs text-muted-foreground transition-colors',
              'hover:bg-secondary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
              open && 'border-primary/40 bg-primary/10 text-foreground'
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('calendar.eventDialog.categoriesAddShort')}</span>
          </button>
        ) : null}
      </div>

      {open && pos
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={t('calendar.eventDialog.categories')}
              className="chronell-acrylic-popover fixed z-[250] max-h-[min(320px,50vh)] overflow-y-auto p-2"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {mastersLoading && categoryNames.length === 0 ? (
                <span className="inline-flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('calendar.eventDialog.loadingShort')}
                </span>
              ) : categoryNames.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  {t('calendar.eventDialog.categoriesEmptyOutlook')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {categoryNames.map((name) => {
                    const on = selected.includes(name)
                    const dotClass = outlookCategoryDotClass(categoryColorByName.get(name))
                    return (
                      <button
                        key={name}
                        type="button"
                        disabled={disabled}
                        onClick={(): void => onToggle(name)}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                          on
                            ? 'border-primary/40 bg-primary/15 text-foreground'
                            : 'border-border/80 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                        )}
                      >
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />
                        <span className="truncate">{name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
