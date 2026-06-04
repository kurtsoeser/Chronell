import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildLayoutStudioPanelGroups,
  getLayoutStudioPanelCatalogEntry,
  layoutStudioPanelFallbackIcon
} from '@/app/layout-studio/layout-studio-panel-catalog'
import {
  layoutStudioPanelTitleKey,
  type LayoutStudioPanelId
} from '@/app/layout-studio/layout-studio-panel-ids'
import { useSearchDropdownPortal } from '@/lib/use-search-dropdown-portal'
import { useLayoutStudioPanelPickerPreview } from '@/app/layout-studio/LayoutStudioPanelPickerPreview'

export function LayoutStudioPanelSelect({
  value,
  onChange,
  className,
  'aria-label': ariaLabel
}: {
  value: LayoutStudioPanelId
  onChange: (panel: LayoutStudioPanelId) => void
  className?: string
  'aria-label'?: string
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  /** Portal-Liste liegt außerhalb von rootRef — sonst schließt mousedown vor dem Klick auf eine Option. */
  const listboxRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const panelStyle = useSearchDropdownPortal(rootRef, open, { width: 280, align: 'left' })
  const { onOptionMouseEnter, onOptionMouseLeave, PreviewPortal } =
    useLayoutStudioPanelPickerPreview()

  const groups = useMemo(
    () => buildLayoutStudioPanelGroups(t, i18n.language),
    [t, i18n.language]
  )

  const selectedEntry = useMemo(() => getLayoutStudioPanelCatalogEntry(value), [value])
  const SelectedIcon = selectedEntry.Icon ?? layoutStudioPanelFallbackIcon()
  const selectedLabel = t(layoutStudioPanelTitleKey(value))

  const close = useCallback((): void => setOpen(false), [])

  const pick = useCallback(
    (id: LayoutStudioPanelId): void => {
      onChange(id)
      close()
    },
    [close, onChange]
  )

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || listboxRef.current?.contains(target)) return
      close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return (): void => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [close, open])

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={(e): void => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cn(
          'flex w-full min-w-0 items-center gap-1 rounded border border-border bg-background px-1 py-0.5 text-left text-[10px] text-foreground',
          'hover:bg-secondary/40'
        )}
      >
        <SelectedIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel ?? t('layoutStudio.panelPickerAria')}
              style={panelStyle}
              className="chronell-smoke flex flex-col overflow-hidden rounded-md border border-border bg-popover shadow-lg"
              onMouseDown={(e): void => e.stopPropagation()}
              onClick={(e): void => e.stopPropagation()}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
                {groups.map((group) => (
                  <div key={group.category} role="group" aria-label={group.categoryLabel}>
                    <p className="sticky top-0 z-[1] bg-popover/95 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      {group.categoryLabel}
                    </p>
                    <ul className="px-0.5 pb-1">
                      {group.items.map(({ id, label, Icon }) => {
                        const active = id === value
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              onMouseEnter={(e): void => onOptionMouseEnter(id, e.currentTarget)}
                              onMouseLeave={onOptionMouseLeave}
                              onClick={(): void => pick(id)}
                              className={cn(
                                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors',
                                active
                                  ? 'bg-primary/15 text-foreground'
                                  : 'text-foreground hover:bg-secondary/70'
                              )}
                            >
                              <Icon
                                className={cn(
                                  'h-3.5 w-3.5 shrink-0',
                                  active ? 'text-primary' : 'text-muted-foreground'
                                )}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate">{label}</span>
                              {active ? (
                                <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                              ) : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
      <PreviewPortal />
    </div>
  )
}
