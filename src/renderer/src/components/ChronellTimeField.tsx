import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChronellTimePickerPanel } from '@/components/ChronellTimePickerPanel'
import { chronellDateFieldInputClass } from '@/components/ChronellDateField'
import { normalizeHm } from '@/lib/calendar-time-select'
import { cn } from '@/lib/utils'

export interface ChronellTimeFieldProps {
  value: string
  onChange: (hm: string) => void
  disabled?: boolean
  className?: string
  id?: string
  /** Minuten-Schritt in der Auswahlliste (Standard: 15). */
  step?: number
  'aria-label'?: string
  /** `field`: volles Eingabefeld; `inline`: Textlink (OneNote-Seitenzeit). */
  variant?: 'field' | 'inline'
}

/**
 * Zeitfeld mit App-Popover (manuelle Eingabe + Liste) statt nativem `input[type=time]`.
 */
export function ChronellTimeField({
  value,
  onChange,
  disabled,
  className,
  id: idProp,
  step = 15,
  'aria-label': ariaLabel,
  variant = 'field'
}: ChronellTimeFieldProps): JSX.Element {
  const { t } = useTranslation()
  const autoId = useId()
  const id = idProp ?? autoId
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ top: 0, left: 0, width: 176 })

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent): void {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return (): void => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  function openPopover(): void {
    if (disabled) return
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = 176
    const margin = 8
    let left = r.left
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin
    }
    left = Math.max(margin, left)
    let top = r.bottom + 4
    const estH = 280
    if (top + estH > window.innerHeight - margin) {
      top = Math.max(margin, r.top - estH - 4)
    }
    setAnchor({ top, left, width })
    setOpen(true)
  }

  const inline = variant === 'inline'
  const display = normalizeHm(value.trim()) ?? t('calendar.timePicker.placeholder')

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
        className={cn(
          inline
            ? 'inline-flex w-auto items-center border-0 bg-transparent p-0 text-sm tabular-nums text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50'
            : cn(
                chronellDateFieldInputClass,
                'flex items-center justify-between gap-2 text-left tabular-nums',
                !value.trim() && 'text-muted-foreground'
              ),
          className
        )}
        onClick={(): void => {
          if (open) setOpen(false)
          else openPopover()
        }}
      >
        <span className="min-w-0 truncate">{display}</span>
        {!inline ? <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </button>
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={t('calendar.timePicker.dialogAria')}
              className="chronell-acrylic-popover fixed z-[260] overflow-hidden rounded-lg p-1.5 text-popover-foreground shadow-lg"
              style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
              onMouseDown={(e): void => e.stopPropagation()}
            >
              <ChronellTimePickerPanel
                value={value}
                step={step}
                disabled={disabled}
                onChange={onChange}
                onPick={(): void => setOpen(false)}
              />
            </div>,
            document.body
          )
        : null}
    </>
  )
}
