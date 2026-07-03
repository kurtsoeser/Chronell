import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import type { Locale } from 'date-fns'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChronellDatePickerPanel } from '@/components/ChronellDatePickerPanel'
import { cn } from '@/lib/utils'

export const chronellDateFieldInputClass =
  'w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60'

function formatYmdForDisplay(ymd: string, locale: Locale, variant: 'field' | 'inline'): string {
  try {
    const d = parseISO(`${ymd}T12:00:00`)
    if (Number.isNaN(d.getTime())) return ymd
    return variant === 'inline'
      ? format(d, 'EEEE, d. MMMM yyyy', { locale })
      : format(d, 'dd.MM.yyyy', { locale })
  } catch {
    return ymd
  }
}

export interface ChronellDateFieldProps {
  value: string
  onChange: (ymd: string) => void
  min?: string
  max?: string
  disabled?: boolean
  className?: string
  id?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>
  'aria-label'?: string
  /** `field`: volles Eingabefeld; `inline`: Textlink (OneNote-Seitendatum). */
  variant?: 'field' | 'inline'
  /** z-index des Kalender-Popovers (z. B. über Modals mit zIndex 320). */
  popoverZIndex?: number
}

/**
 * Datumsfeld mit App-Kalender-Popover (rem) statt nativem `input[type=date]`.
 */
export function ChronellDateField({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  id: idProp,
  onKeyDown,
  'aria-label': ariaLabel,
  variant = 'field',
  popoverZIndex = 260
}: ChronellDateFieldProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const autoId = useId()
  const id = idProp ?? autoId
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ top: 0, left: 0, width: 240 })

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent): void {
      const t = e.target as Node
      if (popoverRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return (): void => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  function openPopover(): void {
    if (disabled) return
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(248, Math.max(220, r.width))
    const margin = 8
    let left = r.left
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin
    }
    left = Math.max(margin, left)
    let top = r.bottom + 4
    const estH = 300
    if (top + estH > window.innerHeight - margin) {
      top = Math.max(margin, r.top - estH - 4)
    }
    setAnchor({ top, left, width })
    setOpen(true)
  }

  const inline = variant === 'inline'

  const display =
    value.trim().length > 0
      ? formatYmdForDisplay(value.trim(), dfLocale, variant)
      : t('calendar.datePicker.placeholder')

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className={cn(
          inline
            ? 'inline-flex w-auto items-center gap-1 border-0 bg-transparent p-0 text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50'
            : cn(
                chronellDateFieldInputClass,
                'flex items-center justify-between gap-2 text-left',
                !value.trim() && 'text-muted-foreground'
              ),
          className
        )}
        onClick={(): void => {
          if (open) setOpen(false)
          else openPopover()
        }}
      >
        <span className="min-w-0 truncate tabular-nums">{display}</span>
        {!inline ? (
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </button>
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={t('calendar.datePicker.dialogAria')}
              className="chronell-acrylic-popover fixed overflow-hidden rounded-lg p-1.5 text-popover-foreground shadow-lg"
              style={{ top: anchor.top, left: anchor.left, width: anchor.width, zIndex: popoverZIndex }}
              onMouseDown={(e): void => e.stopPropagation()}
            >
              <ChronellDatePickerPanel
                value={value}
                min={min}
                max={max}
                disabled={disabled}
                onChange={onChange}
                onPick={(): void => {
                  setOpen(false)
                }}
              />
            </div>,
            document.body
          )
        : null}
    </>
  )
}
