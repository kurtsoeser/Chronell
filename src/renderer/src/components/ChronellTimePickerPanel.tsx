import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { normalizeHm, timeOptionsForStep } from '@/lib/calendar-time-select'
import { cn } from '@/lib/utils'

export interface ChronellTimePickerPanelProps {
  /** `HH:mm` */
  value: string
  onChange: (hm: string) => void
  disabled?: boolean
  step?: number
  onPick?: (hm: string) => void
  className?: string
}

export function ChronellTimePickerPanel({
  value,
  onChange,
  disabled = false,
  step = 15,
  onPick,
  className
}: ChronellTimePickerPanelProps): JSX.Element {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  const normalizedValue = normalizeHm(value.trim()) ?? ''
  const options = useMemo(
    () => timeOptionsForStep(step, normalizedValue || undefined),
    [step, normalizedValue]
  )

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [normalizedValue, options.length])

  function commitDraft(raw: string, close = false): void {
    const next = normalizeHm(raw)
    if (!next) {
      setDraft(value)
      return
    }
    onChange(next)
    setDraft(next)
    if (close) onPick?.(next)
  }

  function pickTime(hm: string): void {
    if (disabled) return
    onChange(hm)
    setDraft(hm)
    onPick?.(hm)
  }

  function pickNow(): void {
    const now = format(new Date(), 'HH:mm')
    pickTime(now)
  }

  return (
    <div className={cn('flex w-[11rem] flex-col', className)}>
      <div className="px-1 pb-1.5">
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={draft}
          placeholder={t('calendar.timePicker.placeholder')}
          aria-label={t('calendar.timePicker.manualAria')}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
          onChange={(e): void => setDraft(e.target.value)}
          onBlur={(): void => commitDraft(draft)}
          onKeyDown={(e): void => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            commitDraft(draft, true)
          }}
        />
      </div>
      <div
        ref={listRef}
        className="max-h-52 overflow-y-auto rounded-md border border-border/60 bg-background/80 py-0.5"
        role="listbox"
        aria-label={t('calendar.timePicker.listAria')}
      >
        {options.map((hm) => {
          const selected = hm === normalizedValue
          return (
            <button
              key={hm}
              ref={selected ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              className={cn(
                'flex w-full px-2.5 py-1.5 text-left text-xs tabular-nums transition-colors',
                selected
                  ? 'bg-primary/15 font-medium text-primary'
                  : 'text-foreground hover:bg-secondary/80'
              )}
              onClick={(): void => pickTime(hm)}
            >
              {hm}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-2 border-t border-border/60 px-1 pt-1.5">
        <button
          type="button"
          disabled={disabled}
          className="text-2xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
          onClick={pickNow}
        >
          {t('calendar.timePicker.now')}
        </button>
      </div>
    </div>
  )
}
