import { useMemo, useState } from 'react'
import { format, parseISO, startOfDay } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { MiniMonthGrid } from '@/app/calendar/MiniMonthGrid'
import { cn } from '@/lib/utils'

function ymdFromDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function isYmdInRange(ymd: string, min?: string, max?: string): boolean {
  if (min && ymd < min) return false
  if (max && ymd > max) return false
  return true
}

export interface ChronellDatePickerPanelProps {
  /** `yyyy-MM-dd` oder leer. */
  value: string
  onChange: (ymd: string) => void
  min?: string
  max?: string
  disabled?: boolean
  /** Nach Tag-Auswahl (z. B. Popover schliessen). */
  onPick?: (ymd: string) => void
  className?: string
}

/**
 * Kompakter Monatskalender (rem-Typografie) statt nativem Chromium-Datepicker.
 */
export function ChronellDatePickerPanel({
  value,
  onChange,
  min,
  max,
  disabled = false,
  onPick,
  className
}: ChronellDatePickerPanelProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const dfLocale = i18n.language.startsWith('de') ? deFns : enUSFns

  const selectedDay = useMemo(() => {
    const v = value.trim()
    if (!v) return null
    try {
      const d = parseISO(`${v}T12:00:00`)
      return Number.isNaN(d.getTime()) ? null : startOfDay(d)
    } catch {
      return null
    }
  }, [value])

  const [monthAnchor, setMonthAnchor] = useState<Date>(() => selectedDay ?? new Date())

  const selectedRange = useMemo(() => {
    if (!selectedDay) return null
    return { startInclusive: selectedDay, endInclusive: selectedDay }
  }, [selectedDay])

  function pickDay(d: Date): void {
    if (disabled) return
    const ymd = ymdFromDate(d)
    if (!isYmdInRange(ymd, min, max)) return
    onChange(ymd)
    onPick?.(ymd)
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <MiniMonthGrid
        compact
        monthAnchor={monthAnchor}
        selectedRange={selectedRange}
        onPrevMonth={(): void => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        onNextMonth={(): void => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        onDayClick={pickDay}
      />
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/60 px-1 pt-1.5">
        <button
          type="button"
          disabled={disabled}
          className="text-2xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
          onClick={(): void => {
            onChange('')
            onPick?.('')
          }}
        >
          {t('calendar.datePicker.clear')}
        </button>
        <button
          type="button"
          disabled={disabled}
          className="text-2xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
          onClick={(): void => pickDay(startOfDay(new Date()))}
        >
          {t('calendar.datePicker.today')}
        </button>
      </div>
      {selectedDay ? (
        <p className="sr-only">
          {format(selectedDay, 'PPP', { locale: dfLocale })}
        </p>
      ) : null}
    </div>
  )
}
